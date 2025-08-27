# Deployment Guide

## Prerequisites

### 1. Environment Setup

Create a `.env` file in the project root with the following content:

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

### 2. Dependencies Installation

```bash
yarn install
```

## Local Development with Mainnet Fork

### 1. Start Local Hardhat Node with Mainnet Fork

```bash
# Start local node with mainnet fork
npx hardhat node --fork-block-number 19000000

# Or with custom RPC
npx hardhat node --fork https://eth-mainnet.g.alchemy.com/v2/your_api_key --fork-block-number 19000000
```

### 2. Deploy to Local Fork

```bash
# Deploy to local fork network
npx hardhat run scripts/1. deploy-vault-mainnet-fork.ts --network localhost
```

### 3. Run Tests on Fork

```bash
# Test AAVE USDT only
npx hardhat run scripts/2. test-aave-usdt-only.ts --network localhost

# Test Morpho Steakhouse vault
npx hardhat run scripts/3. morpho-steakhouse-vault-test.ts --network localhost

# Test multi-protocol functionality
npx hardhat run scripts/4. multi-protocol-test.ts --network localhost

# Test performance fees
npx hardhat run scripts/5. performance-fee-test.ts --network localhost

# Full integration test
npx hardhat run scripts/6. full-test.ts --network localhost

# Test exchange rate calculations
npx hardhat run scripts/7. exchange-rate-test.ts --network localhost

# Test staked USDT functionality
npx hardhat run scripts/8. staked-usdt-test.ts --network localhost

# Test bridge-only operations
npx hardhat run scripts/9. bridge-only-test.ts --network localhost

# Interactive bridge test
npx hardhat run scripts/10. interactive-bridge-test.ts --network localhost
```

## Sepolia Testnet Deployment

### 1. Compile Contracts

```bash
npx hardhat compile
```

### 2. Deploy to Sepolia

```bash
npx hardhat run scripts/deploy-sepolia.ts --network sepolia
```

### 3. Verify Contracts (Optional)

```bash
# Verify MillstoneAIVault implementation
npx hardhat verify --network sepolia <implementation_address>

# Verify proxy contract
npx hardhat verify --network sepolia <proxy_address> <implementation_address> "<initialization_data>"

# Verify ERC20 tokens
npx hardhat verify --network sepolia <USDT_address> "Tether USD (Test)" "USDT" 6 1000000000000
npx hardhat verify --network sepolia <USDC_address> "USD Coin (Test)" "USDC" 6 1000000000000

# Verify MockLendingProtocol
npx hardhat verify --network sepolia <lending_protocol_address>
```

## Mainnet Deployment

### 1. Security Audit

Before mainnet deployment, ensure:

- All security vulnerabilities have been addressed
- Exchange rate calculations are consistent (1e6 scale)
- Reentrancy protection is implemented
- Bridge authorization is properly configured
- Performance fee mechanisms are tested

### 2. Deploy to Mainnet

```bash
npx hardhat run scripts/deploy-mainnet.ts --network mainnet
```

## Contract Architecture

### Core Contracts

- **MillstoneAIVault**: Main vault contract with upgradeable proxy
- **EIP1967Proxy**: Upgradeable proxy implementation
- **MockERC20**: Test USDT/USDC tokens
- **MockLendingProtocol**: Test lending protocol

### Key Features

- **Multi-Protocol Support**: AAVE and Morpho integration
- **StakedToken System**: ERC4626-like token with exchange rate mechanism
- **Bridge Integration**: Cross-chain deposit/withdrawal support
- **Performance Fees**: Automated fee collection and distribution
- **Security Features**: Reentrancy protection, rate limiting, emergency pause

### Security Considerations

- Exchange rate calculations use 1e6 scale for consistency
- All external calls are wrapped in try-catch blocks
- Bridge operations have daily limits and emergency pause functionality
- Rate increases are limited to prevent manipulation
- TimeLock mechanism for critical operations

## Testing

### Unit Tests

```bash
# Run all tests
npx hardhat test

# Run specific test file
npx hardhat test test/MillstoneAIVault.test.ts
npx hardhat test test/BridgeLendingVault.test.ts
```

### Integration Tests

```bash
# Run integration tests on fork
npx hardhat run scripts/6. full-test.ts --network localhost
```

## Configuration

### Hardhat Configuration

The `hardhat.config.ts` includes:

- Mainnet forking configuration
- Network-specific gas settings
- Compiler optimization settings
- Etherscan verification settings

### Contract Configuration

Key configuration parameters:

- `performanceFeeRate`: Performance fee percentage (basis points)
- `aaveAllocations`: AAVE allocation percentages per token
- `morphoAllocations`: Morpho allocation percentages per token
- `bridgeDailyLimits`: Daily limits for bridge operations
- `maxDailyRateIncrease`: Maximum daily exchange rate increase

## Troubleshooting

### Gas Issues

- Adjust gas settings in `hardhat.config.ts`
- Use `--gas-price` option for deployment
- Monitor gas prices on mainnet

### RPC Connection Issues

- Check RPC URL configuration in `.env`
- Use alternative RPC providers (Infura, Alchemy, etc.)
- Verify API key permissions

### Contract Verification Issues

- Ensure all constructor parameters are correct
- Check contract bytecode matches source code
- Verify proxy implementation addresses

## Additional Resources

- [Hardhat Documentation](https://hardhat.org/)
- [OpenZeppelin Upgrades Guide](https://docs.openzeppelin.com/upgrades-plugins/1.x/)
- [Ethereum Mainnet Information](https://ethereum.org/en/developers/docs/networks/#ethereum-mainnet)
- [Sepolia Testnet Information](https://ethereum.org/en/developers/docs/networks/#sepolia)
