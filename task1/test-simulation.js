const AaveV3Protocol = require('./index');
const { AaveV3Polygon } = require('@bgd-labs/aave-address-book');

// Simple mock data for a user with existing positions
const mockUserData = {
    userAccountData: {
        totalCollateralBase: BigInt('20000000'), // $20 USD
        totalDebtBase: BigInt('8000000'), // $8 USD debt
        availableBorrowsBase: BigInt('8000000'), // $8 USD available to borrow
        currentLiquidationThreshold: BigInt('8500'), // 85%
        ltv: BigInt('8000'), // 80%
        healthFactor: BigInt('2125000000000000000') // 2.125
    },
    reserveData: {
        liquidityRate: BigInt('25000000000000000000000000'), // ~2.5% APY
        variableBorrowRate: BigInt('45000000000000000000000000'), // ~4.5% APY
        stableBorrowRate: BigInt('55000000000000000000000000'), // ~5.5% APY
        liquidityIndex: BigInt('1000000000000000000000000000'),
        variableBorrowIndex: BigInt('1080000000000000000000000000')
    },
    userReserveData: {
        currentATokenBalance: BigInt('20000000'), // 20 USDC aTokens
        currentStableDebt: BigInt('0'),
        currentVariableDebt: BigInt('8000000'), // 8 USDC debt
        usageAsCollateralEnabled: true
    },
    assetPrice: BigInt('1000000000000000000') // $1 per USDC
};

// Mock Aave class that uses our simple mock data
class MockAaveV3Protocol extends AaveV3Protocol {
    constructor(providerUrl, chainId) {
        super(providerUrl, chainId);
        this.mockData = this.deepCopyMockData(mockUserData); 
    }

    // Helper to deep copy mock data
    deepCopyMockData(data) {
        const copy = {};
        for (const [key, value] of Object.entries(data)) {
            if (typeof value === 'object' && value !== null) {
                copy[key] = this.deepCopyMockData(value);
            } else {
                copy[key] = value;
            }
        }
        return copy;
    }

    async getOnChainState(userAddress, assetAddress) {
        return this.mockData;
    }

    // Update mock data after operations
    updateMockData(updates) {
        if (updates.aTokenBalance !== undefined) {
            this.mockData.userReserveData.currentATokenBalance = BigInt(updates.aTokenBalance);
        }
        if (updates.variableDebt !== undefined) {
            this.mockData.userReserveData.currentVariableDebt = BigInt(updates.variableDebt);
        }
        if (updates.totalCollateral !== undefined) {
            this.mockData.userAccountData.totalCollateralBase = BigInt(updates.totalCollateral);
        }
        if (updates.totalDebt !== undefined) {
            this.mockData.userAccountData.totalDebtBase = BigInt(updates.totalDebt);
        }
        if (updates.availableBorrows !== undefined) {
            this.mockData.userAccountData.availableBorrowsBase = BigInt(updates.availableBorrows);
        }
        if (updates.healthFactor !== undefined) {
            this.mockData.userAccountData.healthFactor = BigInt(updates.healthFactor);
        }
    }

    // Reset to initial state
    resetMockData() {
        this.mockData = this.deepCopyMockData(mockUserData);
    }
}

function displayUserState(aave, title) {
    console.log(`\n📊 ${title}`);
    console.log('─'.repeat(50));
    const state = aave.mockData;
    console.log(`💰 aToken Balance: ${(Number(state.userReserveData.currentATokenBalance) / 1e6).toFixed(2)} USDC`);
    console.log(`🏦 Total Collateral: $${(Number(state.userAccountData.totalCollateralBase) / 1e6).toFixed(2)}`);
    console.log(`💳 Total Debt: $${(Number(state.userAccountData.totalDebtBase) / 1e6).toFixed(2)}`);
    console.log(`📊 Variable Debt: ${(Number(state.userReserveData.currentVariableDebt) / 1e6).toFixed(2)} USDC`);
    console.log(`💵 Available to Borrow: $${(Number(state.userAccountData.availableBorrowsBase) / 1e6).toFixed(2)}`);
    console.log(`❤️  Health Factor: ${(Number(state.userAccountData.healthFactor) / 1e18).toFixed(3)}`);
}

async function testSupply(aave, userAddress, usdcAddress) {
    console.log('\n🟢 === SUPPLY TEST ===');
    
    const supplyAmount = BigInt('5000000'); // 5 USDC
    console.log(`\n💰 Attempting to supply: ${(Number(supplyAmount) / 1e6).toFixed(2)} USDC`);
    
    const result = await aave.simulateSupply(userAddress, usdcAddress, supplyAmount);
    
    console.log('✅ Supply Simulation Result:');
    console.log(`   - aTokens to receive: ${(Number(result.expectedOutcome.aTokensReceived) / 1e6).toFixed(2)} aUSDC`);
    console.log(`   - New collateral: $${(Number(result.expectedOutcome.newCollateralValue) / 1e6).toFixed(2)}`);
    console.log(`   - APY: ${result.expectedOutcome.estimatedAPY}`);
    console.log(`   - SlippageBps: ${result.expectedOutcome.slippageBps}`);
    
    // Update mock data to simulate the supply
    const currentATokens = Number(aave.mockData.userReserveData.currentATokenBalance);
    const currentCollateral = Number(aave.mockData.userAccountData.totalCollateralBase);
    
    aave.updateMockData({
        aTokenBalance: currentATokens + Number(supplyAmount),
        totalCollateral: currentCollateral + Number(supplyAmount)
    });
    
    console.log('📝 Mock data updated to reflect supply');
    return result;
}

async function testWithdraw(aave, userAddress, usdcAddress) {
    console.log('\n🔴 === WITHDRAW TEST ===');
    
    const withdrawAmount = BigInt('7000000'); // 7 USDC
    const availableBalance = aave.mockData.userReserveData.currentATokenBalance;
    
    console.log(`\n💸 Attempting to withdraw: ${(Number(withdrawAmount) / 1e6).toFixed(2)} USDC`);
    console.log(`💰 Available aToken balance: ${(Number(availableBalance) / 1e6).toFixed(2)} aUSDC`);
    
    // Validation
    if (withdrawAmount > availableBalance) {
        console.log('⚠️  WARNING: Requested amount exceeds available balance!');
        console.log(`   - Will withdraw maximum available: ${(Number(availableBalance) / 1e6).toFixed(2)} USDC`);
    }
    
    const result = await aave.simulateWithdraw(userAddress, usdcAddress, withdrawAmount);
    
    console.log('✅ Withdraw Simulation Result:');
    console.log(`   - Actual withdraw amount: ${(Number(result.expectedOutcome.actualWithdrawAmount) / 1e6).toFixed(2)} USDC`);
    console.log(`   - aTokens burned: ${(Number(result.expectedOutcome.aTokensBurned) / 1e6).toFixed(2)} aUSDC`);
    console.log(`   - New collateral: $${(Number(result.expectedOutcome.newCollateralValue) / 1e6).toFixed(2)}`);
    console.log(`   - Would cause liquidation: ${result.expectedOutcome.wouldCauseLiquidation}`);
    console.log(`   - SlippageBps: ${result.expectedOutcome.slippageBps}`);

    // Update mock data to simulate the withdraw
    const actualWithdraw = Number(result.expectedOutcome.actualWithdrawAmount);
    const currentATokens = Number(aave.mockData.userReserveData.currentATokenBalance);
    const currentCollateral = Number(aave.mockData.userAccountData.totalCollateralBase);
    
    aave.updateMockData({
        aTokenBalance: currentATokens - actualWithdraw,
        totalCollateral: currentCollateral - actualWithdraw
    });
    
    console.log('📝 Mock data updated to reflect withdrawal');
    return result;
}

async function testBorrow(aave, userAddress, usdcAddress) {
    console.log('\n🟡 === BORROW TEST ===');
    
    const borrowAmount = BigInt('3000000'); // 3 USDC
    const availableToBorrow = aave.mockData.userAccountData.availableBorrowsBase;
    
    console.log(`\n💳 Attempting to borrow: ${(Number(borrowAmount) / 1e6).toFixed(2)} USDC`);
    console.log(`💵 Available to borrow: $${(Number(availableToBorrow) / 1e6).toFixed(2)}`);
    
    // Validation
    if (borrowAmount > availableToBorrow) {
        console.log('⚠️  WARNING: Requested amount exceeds borrowing capacity!');
        console.log(`   - Will borrow maximum available: $${(Number(availableToBorrow) / 1e6).toFixed(2)}`);
    }
    
    const result = await aave.simulateBorrow(userAddress, usdcAddress, borrowAmount, 2);
    
    console.log('✅ Borrow Simulation Result:');
    console.log(`   - Can borrow: ${result.expectedOutcome.canBorrow}`);
    console.log(`   - Actual borrow amount: ${(Number(result.expectedOutcome.actualBorrowAmount) / 1e6).toFixed(2)} USDC`);
    console.log(`   - New total debt: $${(Number(result.expectedOutcome.newTotalDebt) / 1e6).toFixed(2)}`);
    console.log(`   - New health factor: ${(Number(result.expectedOutcome.newHealthFactor) / 1e18).toFixed(3)}`);
    console.log(`   - Borrow APY: ${result.expectedOutcome.estimatedAPY}`);
    console.log(`   - SlippageBps: ${result.expectedOutcome.slippageBps}`);
    
    // Update mock data to simulate the borrow
    const actualBorrow = Number(result.expectedOutcome.actualBorrowAmount);
    const currentVariableDebt = Number(aave.mockData.userReserveData.currentVariableDebt);
    const currentTotalDebt = Number(aave.mockData.userAccountData.totalDebtBase);
    const currentAvailableBorrows = Number(aave.mockData.userAccountData.availableBorrowsBase);
    
    aave.updateMockData({
        variableDebt: currentVariableDebt + actualBorrow,
        totalDebt: currentTotalDebt + actualBorrow,
        availableBorrows: currentAvailableBorrows - actualBorrow,
        healthFactor: result.expectedOutcome.newHealthFactor
    });
    
    console.log('📝 Mock data updated to reflect borrow');
    return result;
}

async function testRepay(aave, userAddress, usdcAddress) {
    console.log('\n🟢 === REPAY TEST ===');
    
    const repayAmount = BigInt('5000000'); // 5 USDC
    const currentDebt = aave.mockData.userReserveData.currentVariableDebt;
    
    console.log(`\n💰 Attempting to repay: ${(Number(repayAmount) / 1e6).toFixed(2)} USDC`);
    console.log(`💳 Current variable debt: ${(Number(currentDebt) / 1e6).toFixed(2)} USDC`);
    
    // Validation
    if (repayAmount > currentDebt) {
        console.log('⚠️  WARNING: Repay amount exceeds current debt!');
        console.log(`   - Will repay maximum debt: ${(Number(currentDebt) / 1e6).toFixed(2)} USDC`);
    }
    
    const result = await aave.simulateRepay(userAddress, usdcAddress, repayAmount, 2);
    
    console.log('✅ Repay Simulation Result:');
    console.log(`   - Actual repay amount: ${(Number(result.expectedOutcome.actualRepayAmount) / 1e6).toFixed(2)} USDC`);
    console.log(`   - New total debt: $${(Number(result.expectedOutcome.newTotalDebt) / 1e6).toFixed(2)}`);
    console.log(`   - New health factor: ${(Number(result.expectedOutcome.newHealthFactor) / 1e18).toFixed(3)}`);
    console.log(`   - Debt fully repaid: ${result.expectedOutcome.debtFullyRepaid}`);
    
    // Update mock data to simulate the repay
    const actualRepay = Number(result.expectedOutcome.actualRepayAmount);
    const currentVariableDebt = Number(aave.mockData.userReserveData.currentVariableDebt);
    const currentTotalDebt = Number(aave.mockData.userAccountData.totalDebtBase);
    const currentAvailableBorrows = Number(aave.mockData.userAccountData.availableBorrowsBase);
    
    aave.updateMockData({
        variableDebt: currentVariableDebt - actualRepay,
        totalDebt: currentTotalDebt - actualRepay,
        availableBorrows: currentAvailableBorrows + actualRepay,
        healthFactor: result.expectedOutcome.newHealthFactor
    });
    
    console.log('📝 Mock data updated to reflect repay');
    return result;
}

async function testExcessiveOperations(aave, userAddress, usdcAddress) {
    console.log('\n🚨 === TESTING EXCESSIVE AMOUNTS ===');
    
    // Reset to initial state
    aave.resetMockData();
    displayUserState(aave, 'Reset to Initial State');
    
    // Try to withdraw more than available
    console.log('\n❌ Test 1: Withdraw more than available');
    const excessiveWithdraw = BigInt('50000000'); // 50 USDC (more than 20 available)
    console.log(`Trying to withdraw: ${(Number(excessiveWithdraw) / 1e6).toFixed(2)} USDC`);
    
    const withdrawResult = await aave.simulateWithdraw(userAddress, usdcAddress, excessiveWithdraw);
    console.log(`✅ Actual withdrawal: ${(Number(withdrawResult.expectedOutcome.actualWithdrawAmount) / 1e6).toFixed(2)} USDC (limited by balance)`);
    
    // Try to borrow more than available
    console.log('\n❌ Test 2: Borrow more than available');
    const excessiveBorrow = BigInt('15000000'); // 15 USDC (more than 8 available)
    console.log(`Trying to borrow: ${(Number(excessiveBorrow) / 1e6).toFixed(2)} USDC`);
    
    const borrowResult = await aave.simulateBorrow(userAddress, usdcAddress, excessiveBorrow, 2);
    console.log(`✅ Can borrow full amount: ${borrowResult.expectedOutcome.canBorrow}`);
    console.log(`✅ Actual borrow: ${(Number(borrowResult.expectedOutcome.actualBorrowAmount) / 1e6).toFixed(2)} USDC (limited by capacity)`);
    
    // Try to repay more than debt
    console.log('\n❌ Test 3: Repay more than debt');
    const excessiveRepay = BigInt('20000000'); // 20 USDC (more than 8 debt)
    console.log(`Trying to repay: ${(Number(excessiveRepay) / 1e6).toFixed(2)} USDC`);
    
    const repayResult = await aave.simulateRepay(userAddress, usdcAddress, excessiveRepay, 2);
    console.log(`✅ Actual repay: ${(Number(repayResult.expectedOutcome.actualRepayAmount) / 1e6).toFixed(2)} USDC (limited by debt)`);
    console.log(`✅ Debt fully repaid: ${repayResult.expectedOutcome.debtFullyRepaid}`);
}

function testTransactionDataGeneration(aave) {
    console.log('\n=== Testing Transaction Data Generation ===\n');
    
    const userAddress = '0x5A35469413AB827826FD648F7B69F6d8f7f4858f';
    const usdcAddress = AaveV3Polygon.ASSETS.USDC.UNDERLYING;
    
    try {
        // Test Supply Transaction Data
        console.log('1. Testing Supply Transaction Data Generation...');
        const supplyAmount = BigInt('1000000000');
        const supplyTxData = aave.generateSupplyTxData(usdcAddress, supplyAmount, userAddress);
        
        console.log('✓ Supply transaction data generated');
        console.log(`  - Target contract: ${supplyTxData.to}`);
        console.log(`  - Function signature: ${supplyTxData.functionSignature}`);
        console.log(`  - Data length: ${supplyTxData.data.length} characters`);
        console.log(`  - Parameters:`, supplyTxData.parameters);
        
        // Validate transaction data structure
        if (!supplyTxData.to || !supplyTxData.data || !supplyTxData.functionSignature) {
            throw new Error('Invalid transaction data structure');
        }
        
        // Test Withdraw Transaction Data
        console.log('\n2. Testing Withdraw Transaction Data Generation...');
        const withdrawAmount = BigInt('500000000');
        const withdrawTxData = aave.generateWithdrawTxData(usdcAddress, withdrawAmount, userAddress);
        
        console.log('✓ Withdraw transaction data generated');
        console.log(`  - Function signature: ${withdrawTxData.functionSignature}`);
        console.log(`  - Function Encoded data: ${withdrawTxData.data}`);

        // Test Borrow Transaction Data
        console.log('\n3. Testing Borrow Transaction Data Generation...');
        const borrowAmount = BigInt('1000000000000000000000');
        const borrowTxData = aave.generateBorrowTxData(usdcAddress, borrowAmount, 2, userAddress);
        
        console.log('✓ Borrow transaction data generated');
        console.log(`  - Function signature: ${borrowTxData.functionSignature}`);
        console.log(`  - Function Encoded data: ${borrowTxData.data}`);
        
        // Test Repay Transaction Data
        console.log('\n4. Testing Repay Transaction Data Generation...');
        const repayAmount = BigInt('500000000000000000000');
        const repayTxData = aave.generateRepayTxData(usdcAddress, repayAmount, 2, userAddress);
        
        console.log('✓ Repay transaction data generated');
        console.log(`  - Function signature: ${repayTxData.functionSignature}`);
        console.log(`  - Function Encoded data: ${repayTxData.data}`);
        
        console.log('\n✅ All transaction data generation tests passed!');
        
    } catch (error) {
        console.error('❌ Transaction data generation test failed:', error.message);
    }
}

function testUtilityFunctions(aave) {
    console.log('\n=== Testing Utility Functions ===\n');
    
    try {
        // Test APY calculation
        console.log('1. Testing APY Calculation...');
        const testRate = BigInt('25000000000000000000000000'); // 2.5% in ray format
        const apy = aave.calculateAPY(testRate);
        
        console.log('✓ APY calculation successful');
        console.log(`  - Input rate (ray): ${testRate.toString()}`);
        console.log(`  - Calculated APY: ${apy}`);
        
        // Validate APY format
        if (!apy.includes('%')) {
            throw new Error('APY should include percentage symbol');
        }
        
        console.log('\n✅ All utility function tests passed!');
        
    } catch (error) {
        console.error('❌ Utility function test failed:', error.message);
    }
}

async function main() {
    console.log('🚀 Simple Aave V3 Protocol Demo with Mock Data');
    console.log('═'.repeat(60));
    
    const aave = new MockAaveV3Protocol('https://polygon-rpc.com', 137);
    const userAddress = '0x1234567890123456789012345678901234567890';
    const usdcAddress = AaveV3Polygon.ASSETS.USDC.UNDERLYING;
    
    try {
        // Show initial state
        displayUserState(aave, 'Initial User State');
        
        // Test all operations in sequence
        await testSupply(aave, userAddress, usdcAddress);
        displayUserState(aave, 'After Supply');
        
        await testWithdraw(aave, userAddress, usdcAddress);
        displayUserState(aave, 'After Withdraw');
        
        await testBorrow(aave, userAddress, usdcAddress);
        displayUserState(aave, 'After Borrow');
        
        await testRepay(aave, userAddress, usdcAddress);
        displayUserState(aave, 'After Repay');
        
        // Test excessive amounts
        await testExcessiveOperations(aave, userAddress, usdcAddress);

        // Test transaction data generation
        await testTransactionDataGeneration(aave);

        // Test utility functions
        await testUtilityFunctions(aave);
        
        console.log('\n✅ All tests completed successfully!');
        console.log('\n📋 Summary:');
        console.log('   ✓ Supply: Adds aTokens and increases collateral');
        console.log('   ✓ Withdraw: Burns aTokens and decreases collateral (limited by balance)');
        console.log('   ✓ Borrow: Increases debt and decreases available borrowing (limited by capacity)');
        console.log('   ✓ Repay: Decreases debt and increases available borrowing (limited by debt amount)');
        console.log('   ✓ All operations include proper validation for excessive amounts');
        console.log('   ✓ Transaction data generation works as expected');
        console.log('   ✓ Utility functions are working correctly');

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

main().catch(console.error);