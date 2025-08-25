# Magic Millstone AI Vault

An Ethereum-based, multi-protocol decentralized investment vault integrated with AAVE and
Morpho, offering bridge support, performance fees, and advanced security mechanisms.

## Overview

Magic Millstone AI Vault is a sophisticated DeFi vault that allows users to deposit assets
and automatically distributes them across multiple lending protocols (AAVE and Morpho) for
optimal yield generation. The system includes bridge integration for cross-chain
operations, performance fee collection, and comprehensive security features.

## Key Features

- **Multi-Protocol Support**: Automatic distribution across AAVE and Morpho
  protocols(Increasing Gradually)
- **StakedToken System**: ERC4626-like token with exchange rate mechanism
- **Bridge Integration**: Cross-chain deposit and withdrawal support
- **Performance Fees**: Automated fee collection and distribution
- **Security Features**: Reentrancy protection, rate limiting, emergency pause
- **Exchange Rate Protection**: Gradual rate increases with daily limits
- **TimeLock Mechanism**: Critical operations with delay periods

## Architecture

### Core Contracts

- **MillstoneAIVault**: Main vault contract with upgradeable proxy
- **EIP1967Proxy**: Upgradeable proxy implementation
- **MockERC20**: Test USDT/USDC tokens
- **MockLendingProtocol**: Test lending protocol

### Security Features

- Exchange rate calculations use 1e6 scale for consistency
- All external calls wrapped in try-catch blocks
- Bridge operations with daily limits and emergency pause
- Rate increases limited to prevent manipulation
- TimeLock mechanism for critical operations

## Prerequisites

### Environment Setup

Create a `.env` file in the project root:

```bash
# Private Key for deployment (with 0x prefix)
PRIVATE_KEY=your_private_key_here

# RPC URLs
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/your_api_key
SEPOLIA_RPC_URL=https://sepolia.gateway.tenderly.co

# API Keys (optional)
ETHERSCAN_API_KEY=your_etherscan_api_key_here
ALCHEMY_API_KEY=your_alchemy_api_key_here

# Fork Configuration
FORK_BLOCK_NUMBER=19000000
```

### Dependencies

```bash
yarn install
```

## Local Development with Mainnet Fork

This project requires Ethereum mainnet forking to function properly, as it integrates with
real AAVE and Morpho protocols.

### Start Local Hardhat Node with Mainnet Fork

```bash
# Start local node with mainnet fork
npx hardhat node --fork-block-number 19000000

# Or with custom RPC
npx hardhat node --fork https://eth-mainnet.g.alchemy.com/v2/your_api_key --fork-block-number 19000000
```

### Deploy to Local Fork

```bash
# Deploy to local fork network
npx hardhat run scripts/1. deploy-vault-mainnet-fork.ts --network localhost
```

### Run Integration Tests

```bash
# Full integration test
npx hardhat run scripts/full-test.ts --network localhost
```

## Testing

### Unit Tests

```bash
# Run all tests
npx hardhat test

# Run specific test file
npx hardhat test test/MillstoneAIVault.test.ts
npx hardhat test test/BridgeLendingVault.test.ts
```

### Integration Tests on Fork

The project includes comprehensive integration tests that simulate real-world scenarios:

- **full-test.ts**: Complete bridge-only deposit/withdrawal scenario

## Deployment

### Sepolia Testnet

```bash
# Compile contracts
npx hardhat compile

# Deploy to Sepolia
npx hardhat run scripts/deploy-sepolia.ts --network sepolia
```

### Mainnet

Before mainnet deployment, ensure:

- All security vulnerabilities have been addressed
- Exchange rate calculations are consistent (1e6 scale)
- Reentrancy protection is implemented
- Bridge authorization is properly configured
- Performance fee mechanisms are tested

```bash
npx hardhat run scripts/deploy-mainnet.ts --network mainnet
```

## Contract Configuration

### Key Parameters

- `performanceFeeRate`: Performance fee percentage (basis points)
- `aaveAllocations`: AAVE allocation percentages per token
- `morphoAllocations`: Morpho allocation percentages per token
- `bridgeDailyLimits`: Daily limits for bridge operations
- `maxDailyRateIncrease`: Maximum daily exchange rate increase

### Security Settings

- Exchange rate protection with daily limits
- Bridge operation limits and emergency pause
- TimeLock delays for critical operations
- Rate increase queuing system

## Usage Examples

### Basic Vault Operations

```typescript
// Get vault instance
const vault = await ethers.getContractAt('MillstoneAIVault', proxyAddress);

// Bridge deposit
const amount = ethers.parseUnits('100', 6); // 100 USDT
await usdt.approve(vault.address, amount);
await vault.receiveFromBridge(usdt.address, amount);

// Check balances
const [contractBalance, protocolBalance, totalBalance] = await vault.getTokenBalance(
  usdt.address,
);

// Bridge withdrawal
await vault.withdrawForUser(usdt.address, ethers.parseUnits('50', 6));
```

### Admin Functions

```typescript
// Set performance fee
await vault.setPerformanceFeeRate(1000); // 10%

// Configure protocols
await vault.setAaveConfig(aavePoolAddress, tokenAddress, aTokenAddress);
await vault.setMorphoVault(tokenAddress, morphoVaultAddress);

// Set bridge authorization
await vault.setBridgeAuthorization(bridgeAddress, true);
```

## Troubleshooting

### Gas Issues

- Adjust gas settings in `hardhat.config.ts`
- Use `--gas-price` option for deployment
- Monitor gas prices on mainnet

### RPC Connection Issues

- Check RPC URL configuration in `.env`
- Use alternative RPC providers (Infura, Alchemy, etc.)
- Verify API key permissions

### Fork Issues

- Ensure mainnet RPC URL is working
- Check fork block number is recent
- Verify sufficient ETH balance for testing

## Security Considerations

- All external protocol calls are wrapped in try-catch blocks
- Exchange rate increases are limited and gradual
- Bridge operations have daily limits and emergency pause
- Critical operations require TimeLock delays
- Reentrancy protection on all state-changing functions

## Additional Resources

- [Hardhat Documentation](https://hardhat.org/)
- [OpenZeppelin Upgrades Guide](https://docs.openzeppelin.com/upgrades-plugins/1.x/)
- [AAVE Documentation](https://docs.aave.com/)
- [Morpho Documentation](https://docs.morpho.org/)
- [Ethereum Mainnet Information](https://ethereum.org/en/developers/docs/networks/#ethereum-mainnet)
