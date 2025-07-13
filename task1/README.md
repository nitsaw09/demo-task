# Aave V3 DeFi Protocol Module

A comprehensive JavaScript module for interacting with the Aave V3 lending protocol on Polygon. This module provides transaction simulation and data generation capabilities for all major lending operations.

## Features

### 1. Transaction Simulation
- **Supply**: Calculate expected aToken rewards, collateral changes, and health factor impacts
- **Withdraw**: Determine withdrawal limits, collateral effects, and liquidation risks
- **Borrow**: Assess borrowing capacity, interest rates, and health factor changes
- **Repay**: Calculate debt reduction and health factor improvements

### 2. Transaction Data Generation
- Generate properly formatted transaction data for all operations
- Include target contract addresses, function signatures, and encoded parameters
- Ready-to-use transaction data for wallet integration or direct blockchain submission

### 3. On-Chain State Querying
- Real-time user account data (collateral, debt, health factor)
- Reserve data (interest rates, liquidity, calculate APY)
- Asset prices from Aave's price oracle

## Installation

```bash
npm install
```

## Run Simulation

```bash
npm run simulation
```
