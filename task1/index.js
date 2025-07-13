const { ethers } = require('ethers');
const { AaveV3Polygon } = require('@bgd-labs/aave-address-book');
const PoolV3Artifact = require('@aave/core-v3/artifacts/contracts/protocol/pool/Pool.sol/Pool.json');

class AaveV3Protocol {
    constructor(providerUrl = 'https://polygon-rpc.com', chainId = 137) {
        this.provider = new ethers.providers.JsonRpcProvider(providerUrl);
        this.chainId = chainId;

        this.contracts = {
            pool: AaveV3Polygon.POOL,
            poolDataProvider: AaveV3Polygon.AAVE_PROTOCOL_DATA_PROVIDER,
            priceOracle: AaveV3Polygon.ORACLE
        };

        this.poolAbi = PoolV3Artifact.abi;

        this.dataProviderAbi = [
            'function getReserveData(address asset) view returns (uint256 unbacked, uint256 accruedToTreasuryScaled, uint256 totalAToken, uint256 totalStableDebt, uint256 totalVariableDebt, uint256 liquidityRate, uint256 variableBorrowRate, uint256 stableBorrowRate, uint256 averageStableBorrowRate, uint256 liquidityIndex, uint256 variableBorrowIndex, uint40 lastUpdateTimestamp)',
            'function getUserReserveData(address asset, address user) view returns (uint256 currentATokenBalance, uint256 currentStableDebt, uint256 currentVariableDebt, uint256 principalStableDebt, uint256 scaledVariableDebt, uint256 stableBorrowRate, uint256 liquidityRate, uint40 stableRateLastUpdated, bool usageAsCollateralEnabled)'
        ];

        this.priceOracleAbi = [
            'function getAssetPrice(address asset) view returns (uint256)'
        ];

        this.poolContract = new ethers.Contract(this.contracts.pool, this.poolAbi, this.provider);
        this.dataProviderContract = new ethers.Contract(this.contracts.poolDataProvider, this.dataProviderAbi, this.provider);
        this.priceOracleContract = new ethers.Contract(this.contracts.priceOracle, this.priceOracleAbi, this.provider);
    }

    // Get current on-chain state for a user and asset
    async getOnChainState(userAddress, assetAddress) {
        try {
            const [
                userAccountData,
                reserveData,
                userReserveData,
                assetPrice
            ] = await Promise.all([
                this.poolContract.getUserAccountData(userAddress),
                this.poolContract.getReserveData(assetAddress),
                this.dataProviderContract.getUserReserveData(assetAddress, userAddress),
                this.priceOracleContract.getAssetPrice(assetAddress)
            ]);

            return {
                userAccountData: {
                    totalCollateralBase: BigInt(userAccountData.totalCollateralBase || userAccountData[0]),
                    totalDebtBase: BigInt(userAccountData.totalDebtBase || userAccountData[1]),
                    availableBorrowsBase: BigInt(userAccountData.availableBorrowsBase || userAccountData[2]),
                    currentLiquidationThreshold: BigInt(userAccountData.currentLiquidationThreshold || userAccountData[3]),
                    ltv: BigInt(userAccountData.ltv || userAccountData[4]),
                    healthFactor: BigInt(userAccountData.healthFactor || userAccountData[5])
                },
                reserveData: {
                    liquidityRate: BigInt(reserveData.currentLiquidityRate || reserveData[2]),
                    variableBorrowRate: BigInt(reserveData.currentVariableBorrowRate || reserveData[4]),
                    stableBorrowRate: BigInt(reserveData.currentStableBorrowRate || reserveData[5]),
                    liquidityIndex: BigInt(reserveData.liquidityIndex || reserveData[1]),
                    variableBorrowIndex: BigInt(reserveData.variableBorrowIndex || reserveData[3])
                },
                userReserveData: {
                    currentATokenBalance: BigInt(userReserveData.currentATokenBalance || userReserveData[0]),
                    currentStableDebt: BigInt(userReserveData.currentStableDebt || userReserveData[1]),
                    currentVariableDebt: BigInt(userReserveData.currentVariableDebt || userReserveData[2]),
                    usageAsCollateralEnabled: userReserveData.usageAsCollateralEnabled !== undefined ? 
                        userReserveData.usageAsCollateralEnabled : userReserveData[8]
                },
                assetPrice: BigInt(assetPrice),
            };
        } catch (error) {
            throw new Error(`Failed to fetch on-chain state: ${error.message}`);
        }
    }

    // Calculate expected outcome for supply transaction
    async simulateSupply(userAddress, assetAddress, amount) {
        const state = await this.getOnChainState(userAddress, assetAddress);
        
        // Calculate expected aToken amount (1:1 ratio with supplied amount)
        const expectedATokens = amount;
        
        // Calculate new collateral value
        const assetPriceInBase = state.assetPrice;
        const collateralIncrease = (amount * assetPriceInBase) / BigInt(10**18);
        const newTotalCollateral = state.userAccountData.totalCollateralBase + collateralIncrease;
        
        // Calculate new health factor
        const newHealthFactor = state.userAccountData.totalDebtBase > 0 
            ? (newTotalCollateral * state.userAccountData.currentLiquidationThreshold) / (state.userAccountData.totalDebtBase * BigInt(10000))
            : BigInt(2**256 - 1); // Max value when no debt
        
        const actualATokens = (amount * BigInt(1e27)) / state.reserveData.liquidityIndex;

        return {
            action: 'supply',
            asset: assetAddress,
            amount: amount.toString(),
            expectedOutcome: {
                aTokensReceived: expectedATokens.toString(),
                newCollateralValue: newTotalCollateral.toString(),
                newHealthFactor: newHealthFactor.toString(),
                estimatedAPY: this.calculateAPY(state.reserveData.liquidityRate),
                slippageBps: this.calculateSlippage(amount, actualATokens)    
            },
            fees: {
                protocolFee: '0', // Aave doesn't charge supply fees
                gasFee: 'estimated_gas_fee' // Would need gas estimation
            }
        };
    }

    // Calculate expected outcome for withdraw transaction
    async simulateWithdraw(userAddress, assetAddress, amount) {
        const state = await this.getOnChainState(userAddress, assetAddress);
        
        // Check if user has enough aTokens
        const availableToWithdraw = state.userReserveData.currentATokenBalance;
        const actualWithdrawAmount = amount > availableToWithdraw ? availableToWithdraw : amount;
        
        // Calculate collateral decrease
        const assetPriceInBase = state.assetPrice;
        const collateralDecrease = (BigInt(actualWithdrawAmount) * assetPriceInBase) / BigInt(10**18);
        const newTotalCollateral = state.userAccountData.totalCollateralBase - collateralDecrease;
        
        // Calculate new health factor
        const newHealthFactor = state.userAccountData.totalDebtBase > 0 
            ? (newTotalCollateral * state.userAccountData.currentLiquidationThreshold) / (state.userAccountData.totalDebtBase * BigInt(10000))
            : BigInt(2**256 - 1);
        
        // Check if withdrawal would cause liquidation
        const wouldCauseLiquidation = newHealthFactor < BigInt(10**18) && state.userAccountData.totalDebtBase > 0;
        
        return {
            action: 'withdraw',
            asset: assetAddress,
            requestedAmount: amount.toString(),
            expectedOutcome: {
                actualWithdrawAmount: actualWithdrawAmount.toString(),
                aTokensBurned: actualWithdrawAmount.toString(),
                newCollateralValue: newTotalCollateral.toString(),
                newHealthFactor: newHealthFactor.toString(),
                wouldCauseLiquidation,
                slippageBps: this.calculateSlippage(amount, actualWithdrawAmount)
            },
            fees: {
                protocolFee: '0',
                gasFee: 'estimated_gas_fee'
            }
        };
    }

    // Calculate expected outcome for borrow transaction
    async simulateBorrow(userAddress, assetAddress, amount, interestRateMode = 2) {
        const state = await this.getOnChainState(userAddress, assetAddress);
        
        // Check available borrowing capacity
        const availableToBorrow = state.userAccountData.availableBorrowsBase;
        const assetPriceInBase = state.assetPrice;
        const requestedBorrowInBase = (BigInt(amount) * assetPriceInBase) / BigInt(10**18);
        
        const canBorrow = requestedBorrowInBase <= availableToBorrow;
        const actualBorrowAmount = canBorrow ? amount : (availableToBorrow * BigInt(10**18)) / assetPriceInBase;
        
        // Calculate new debt
        const newTotalDebt = state.userAccountData.totalDebtBase + (BigInt(actualBorrowAmount) * assetPriceInBase) / BigInt(10**18);
        
        // Calculate new health factor
        const newHealthFactor = newTotalDebt > 0 
            ? (state.userAccountData.totalCollateralBase * state.userAccountData.currentLiquidationThreshold) / (newTotalDebt * BigInt(10000))
            : BigInt(2**256 - 1);
        
        const borrowRate = interestRateMode === 1 ? state.reserveData.stableBorrowRate : state.reserveData.variableBorrowRate;
        
        return {
            action: 'borrow',
            asset: assetAddress,
            requestedAmount: amount.toString(),
            interestRateMode,
            expectedOutcome: {
                actualBorrowAmount: actualBorrowAmount.toString(),
                newTotalDebt: newTotalDebt.toString(),
                newHealthFactor: newHealthFactor.toString(),
                borrowRate: borrowRate.toString(),
                estimatedAPY: this.calculateAPY(borrowRate),
                slippageBps: this.calculateSlippage(amount, actualBorrowAmount),
                canBorrow
            },
            fees: {
                protocolFee: '0',
                gasFee: 'estimated_gas_fee'
            }
        };
    }

    // Calculate expected outcome for repay transaction
    async simulateRepay(userAddress, assetAddress, amount, interestRateMode = 2) {
        const state = await this.getOnChainState(userAddress, assetAddress);
        
        const currentDebt = interestRateMode === 1 
            ? state.userReserveData.currentStableDebt 
            : state.userReserveData.currentVariableDebt;
        
        const actualRepayAmount = amount > currentDebt ? currentDebt : amount;
        
        // Calculate new debt
        const assetPriceInBase = state.assetPrice;
        const debtReduction = (BigInt(actualRepayAmount) * assetPriceInBase) / BigInt(10**18);
        const newTotalDebt = state.userAccountData.totalDebtBase - debtReduction;
        
        // Calculate new health factor
        const newHealthFactor = newTotalDebt > 0 
            ? (state.userAccountData.totalCollateralBase * state.userAccountData.currentLiquidationThreshold) / (newTotalDebt * BigInt(10000))
            : BigInt(2**256 - 1);
        
        return {
            action: 'repay',
            asset: assetAddress,
            requestedAmount: amount.toString(),
            interestRateMode,
            expectedOutcome: {
                actualRepayAmount: actualRepayAmount.toString(),
                newTotalDebt: newTotalDebt.toString(),
                newHealthFactor: newHealthFactor.toString(),
                slippageBps: this.calculateSlippage(amount, actualRepayAmount),
                debtFullyRepaid: actualRepayAmount >= currentDebt
            },
            fees: {
                protocolFee: '0',
                gasFee: 'estimated_gas_fee'
            }
        };
    }

    // Generate transaction data for supply operation
    generateSupplyTxData(assetAddress, amount, onBehalfOf, referralCode = 0) {
        const iface = new ethers.utils.Interface(this.poolAbi);
        const data = iface.encodeFunctionData('supply', [
            assetAddress,
            amount,
            onBehalfOf,
            referralCode
        ]);

        return {
            to: this.contracts.pool,
            data,
            value: '0',
            functionSignature: 'supply(address,uint256,address,uint16)',
            parameters: {
                asset: assetAddress,
                amount: amount.toString(),
                onBehalfOf,
                referralCode
            }
        };
    }

    // Generate transaction data for withdraw operation
    generateWithdrawTxData(assetAddress, amount, to) {
        const iface = new ethers.utils.Interface(this.poolAbi);
        const data = iface.encodeFunctionData('withdraw', [
            assetAddress,
            amount,
            to
        ]);
        return {
            to: this.contracts.pool,
            data,
            value: '0',
            functionSignature: 'withdraw(address,uint256,address)',
            parameters: {
                asset: assetAddress,
                amount: amount.toString(),
                to
            }
        };
    }

    // Generate transaction data for borrow operation
    generateBorrowTxData(assetAddress, amount, interestRateMode, onBehalfOf, referralCode = 0) {
        const iface = new ethers.utils.Interface(this.poolAbi);
        const data = iface.encodeFunctionData('borrow', [
            assetAddress,
            amount,
            interestRateMode,
            referralCode,
            onBehalfOf
        ]);

        return {
            to: this.contracts.pool,
            data,
            value: '0',
            functionSignature: 'borrow(address,uint256,uint256,uint16,address)',
            parameters: {
                asset: assetAddress,
                amount: amount.toString(),
                interestRateMode,
                referralCode,
                onBehalfOf
            }
        };
    }

    // Generate transaction data for repay operation
    generateRepayTxData(assetAddress, amount, interestRateMode, onBehalfOf) {
        const iface = new ethers.utils.Interface(this.poolAbi);
        const data = iface.encodeFunctionData('repay', [
            assetAddress,
            amount,
            interestRateMode,
            onBehalfOf
        ]);

        return {
            to: this.contracts.pool,
            data,
            value: '0',
            functionSignature: 'repay(address,uint256,uint256,address)',
            parameters: {
                asset: assetAddress,
                amount: amount.toString(),
                interestRateMode,
                onBehalfOf
            }
        };
    }

    // Helper function to calculate APY from rate
    calculateAPY(rate, periodsPerYear = 365) {
        try {
            const rateDecimal = parseFloat(ethers.utils.formatUnits(rate, 27));
            const apy = (Math.pow(1 + rateDecimal / periodsPerYear, periodsPerYear) - 1) * 100;
            return apy.toFixed(2) + "%";
        } catch(error) {
            return `Error calculating APY: ${error.message}`;
        }
    }

    // Calculate slippage based on the difference between expected and actual outcomes
    calculateSlippage(expected, actual) {
        if (expected === BigInt(0)) return BigInt(0);
        return (((expected - actual) * BigInt(10000)) / expected).toString();
    }


    // Estimate gas for a transaction
    async estimateGas(txData, from) {
        try {
            const gasEstimate = await this.provider.estimateGas({
                to: txData.to,
                data: txData.data,
                from,
                value: txData.value || '0'
            });
            return gasEstimate.toString();
        } catch (error) {
            throw new Error(`Gas estimation failed: ${error.message}`);
        }
    }
}

module.exports = AaveV3Protocol;
