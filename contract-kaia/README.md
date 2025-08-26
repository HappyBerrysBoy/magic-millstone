# Magic Millstone - Contract Kaia

A decentralized finance (DeFi) vault system built on Kaia blockchain that enables users to deposit USDT and earn yield through automated deployment to external lending protocols. The system features NFT-based withdrawal requests with dynamic exchange rates that appreciate over time, providing seamless yield distribution to users.

## 🏗️ Architecture Overview

The system consists of three main smart contracts working together to provide a yield-generating vault:

- **VaultContract**: Core vault logic managing deposits, withdrawals, and yield distribution
- **mmUSDT**: KIP-7 token representing vault shares with dynamic exchange rate that appreciates as yield is earned
- **WithdrawNFT**: KIP-17 token representing withdrawal requests with on-chain SVG metadata and status tracking

### Yield Generation Mechanism

The vault generates yield by:

1. **Capital Deployment**: Transferring USDT to bridge contracts using the `magicTime()` function
2. **Cross-chain Integration**: Bridge contracts deploy funds to external DeFi lending protocols
3. **Yield Accumulation**: Earning interest from lending activities on established DeFi platforms
4. **Rate Updates**: Increasing the exchange rate to distribute earned yield proportionally to all vault participants
5. **Automated Management**: Maintaining optimal liquidity while maximizing yield opportunities

## 📋 Features

### Core Functionality

- **USDT Deposits**: Users deposit USDT and receive mmUSDT tokens at current exchange rate
- **Yield Generation**: Funds are deployed to external lending protocols to earn yield, managed via `magicTime()` function
- **NFT Withdrawals**: Withdrawal requests are tokenized as NFTs with PENDING → READY status flow
- **Dynamic Exchange Rate**: Vault appreciates over time, increasing mmUSDT redemption value

### Security Features

- **Role-based Access Control**: Admin, Pauser, Upgrader, Minter, Burner roles
- **Upgradeable Contracts**: UUPS proxy pattern for contract upgrades
- **Pausable Operations**: Emergency pause functionality
- **Reentrancy Protection**: Guards against reentrancy attacks
- **Reserve Management**: Automatic calculation of required reserves for withdrawals

## 🚀 Getting Started

### Prerequisites

- Node.js v16+
- Yarn package manager
- Hardhat development environment

### Installation

```bash
# Clone the repository
git clone https://github.com/HappyBerrysBoy/magic-millstone.git
cd contract-kaia

# Install dependencies
yarn install
```

### Environment Setup

Create a `.env` file based on `.env.example`:

```bash
# Kaia Networks
KAIROS_PRIVATE_KEY=your_kairos_testnet_private_key
KAIA_PRIVATE_KEY=your_kaia_mainnet_private_key
```

### Compilation

```bash
# Compile contracts
npx hardhat compile
```

### Testing

```bash
# Run all tests
npx hardhat test
```

## 🌐 Network Configuration

### Kaia Testnet (Kairos)

- RPC URL: `https://public-en-kairos.node.kaia.io`
- Chain ID: 1001
- Explorer: https://kairos.kaiascan.io

### Kaia Mainnet

- RPC URL: `https://public-en.node.kaia.io`
- Chain ID: 8217
- Explorer: https://kaiascan.io

## 📜 Contract Addresses

_To be updated after deployment_

| Contract      | Kairos (Testnet)                           | Kaia (Mainnet)                             |
| ------------- | ------------------------------------------ | ------------------------------------------ |
| VaultContract | 0x582397784AE2a2C98647729fA6E760aea75634a6 | TBD                                        |
| mmUSDT        | 0xAf769Db63C17B0A14f774c561e05A5f6182B67bF | TBD                                        |
| WithdrawNFT   | 0x24F91240B669874ef4Ea60B81a6710ebc21d1EAD | TBD                                        |
| USDT          | 0xf6A77faA9d860a9218E0ab02Ac77AEe03c027372 | 0xd077a400968890eacc75cdc901f0356c943e4fdb |

## 🛠️ Usage

### Deployment

```bash
npx hardhat run scripts/deploy-all.ts --network [network]
```

### Testing Scripts

The project includes comprehensive testing scripts:

```bash
# Test deposit functionality
npx hardhat run scripts/test-depositUsdt.ts --network [network]

# Test withdrawal request
npx hardhat run scripts/test-requestWithdrawal.ts --network [network]

# Test withdrawal execution
npx hardhat run scripts/test-executeWithdraw.ts --network [network]

# Check NFT statuses
npx hardhat run scripts/test-nfts.ts --network [network]

# Test magic time (bridge transfers)
npx hardhat run scripts/test-magicTime.ts --network [network]

# Test deposit to vault (bridge transfers)
npx hardhat run scripts/test-depositToVault.ts --network [network]
```

## 📊 Contract Interactions

### User Flow

1. **Deposit USDT**

   ```solidity
   // Approve USDT spending
   usdt.approve(vaultAddress, amount);

   // Deposit to vault (mints mmUSDT)
   vault.deposit(amount);
   ```

2. **Request Withdrawal**

   ```solidity
   // Request withdrawal (burns mmUSDT, mints NFT)
   uint256 nftId = vault.requestWithdraw(mmUsdtAmount);
   ```

3. **Execute Withdrawal**
   ```solidity
   // Execute when NFT status is READY
   vault.executeWithdraw(nftId);
   ```

### Admin Functions

```solidity
// Transfer funds to bridge for yield generation
vault.magicTime(bridgeAddress);

// Update exchange rate to distribute yield
vault.setExchangeRate(newRate);

// Manually mark withdrawals as ready
vault.markWithdrawReady([nftId1, nftId2]);
```

## 🔧 Development

### Project Structure

```
contract-kaia/
├── contracts/             # Smart contracts
│   ├── VaultContract.sol
│   ├── mmUSDT.sol
│   ├── WithdrawNFT.sol
│   └── TestUSDT.sol
├── scripts/               # Deployment and testing scripts
├── test/                  # Test files
├── artifacts/             # Compiled contracts
└── types/                 # TypeScript type definitions
```

### Key Constants

```solidity
MINIMUM_DEPOSIT = 1e6;        // 1 USDT minimum deposit
MINIMUM_WITHDRAW = 1e6;       // 1 USDT minimum withdrawal
EXCHANGE_RATE_DECIMALS = 1e6; // Exchange rate precision
```

## 🧪 Testing

The project includes comprehensive tests covering:

- Vault deposit/withdrawal flows
- Exchange rate mechanics
- NFT withdrawal status management
- Access control and security
- KIP compliance (KIP-7 for mmUSDT, KIP-17 for WithdrawNFT)

Run specific test files:

```bash
npx hardhat test test/VaultContract.test.ts
npx hardhat test test/KIPCompliance.test.ts
```

## 🔐 Security

### Audit Status

_Pending security audit_

### Security Features

- Role-based access control
- Timelock mechanisms (via withdrawal NFT system)
- Reentrancy guards
- Overflow protection
- Emergency pause functionality

## 📄 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

For questions and support, please open an issue in this repository.

## 🔗 Links

- [Kaia Documentation](https://docs.kaia.io/)
- [Hardhat Documentation](https://hardhat.org/docs)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)
