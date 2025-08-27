# ![Magic Millstone Logo](/frontend/public/images/MillstoneIcon.png) Magic Millstone

**Korea Stablecoin Hackathon - Kaia-Native USDT DeFi Track Participant**

A cutting-edge DeFi yield optimization platform built on the Kaia blockchain, featuring automated yield generation via cross-chain deployment strategies. Magic Millstone enables users to earn passive income on their USDT holdings while maintaining liquidity through innovative NFT-based withdrawal mechanics.

## 🌈 Overview

Magic Millstone is a comprehensive DeFi ecosystem that bridges traditional yield farming with innovative user experience design. By leveraging Kaia's native USDT and integrating with LINE Messenger MiniDapp, we provide mainstream users with seamless access to DeFi yield generation.

### Key Innovation

- **Automated Yield Generation**: Automated fund deployment to lending protocols via the `magicTime()` function
- **NFT Withdrawal System**: A novel withdrawal management system powered by dynamic SVG metadata
- **Cross-Chain Bridge Integration**: Seamless capital deployment across multiple chains for maximum yield
- **LINE MiniDapp Integration**: Native mobile experience within LINE Messenger ecosystem

## 🏗️ Architecture

The platform consists of four main components:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │     Smart       │
│   (Next.js)     │◄──►│   (NestJS)      │◄──►│   Contracts     │
│   MiniDapp      │    │   API Server    │    │   (Solidity)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                      ▲
                                                      │
                                                      ▼
                                              ┌─────────────────┐
                                              │   Cross-Chain   │
                                              │   Bridge        │
                                              │   Contracts     │
                                              └─────────────────┘
```

### Components

1. **Frontend** (`/frontend`): Next.js MiniDapp with LINE integration
2. **Backend** (`/backend`): NestJS API server for data analytics and user management
3. **Kaia Contracts** (`/contract-kaia`): Kaia Contracts (/contract-kaia): Core DeFi logic on the Kaia blockchain
4. **DEX Contracts** (`/contract-dex`): Infrastructure for cross-chain deployment

## 🚀 Quick Start

For detailed deployment and execution instructions for each component, please refer to the individual README files in each folder:

- **Frontend Setup & Deployment**: See `/frontend/README.md`
- **Backend API Server**: See `/backend/README.md`
- **Kaia Smart Contracts**: See `/contract-kaia/README.md`
- **DEX Contracts**: See `/contract-dex/README.md`

Each component has its own specific setup requirements, environment variables, and deployment scripts. Make sure to follow the instructions in the respective README files for proper installation and configuration.

## ✨ Features

### Preview

<img width="900" alt="user flow" src="https://i.imgur.com/Ta9v8wh.png">

### For Users

- **Simple Deposits**: Simple Deposits: Stake USDT and start earning
- **Dynamic Yields**: Automated yield generation across multiple protocols
- **Flexible Withdrawals**: NFT-based withdrawal system with real-time status tracking
- **Real-time Analytics**: Comprehensive portfolio tracking and performance metrics
- **Mobile First**: Native LINE Messenger integration for seamless mobile experience

### For Developers

- **Upgradeable Contracts**: UUPS proxy pattern for contract evolution
- **Comprehensive APIs**: RESTful backend services with Swagger documentation
- **Security First**: Role-based access control and emergency pause functionality
- **Testing Suite**: Comprehensive test coverage across all components

## 📱 LINE MiniDapp Integration

Magic Millstone is designed as a LINE Messenger MiniDapp, providing a native mobile-first DeFi experience:

### Supported Features

- **Vault Deposits**: Users deposit USDT and receive mmUSDT (Magic Millstone USDT) tokens
- **Cross-Chain Yield Generation**: Deposited USDT is bridged to other chains and deployed to lending protocols
- **Liquid Receipt Tokens**: mmUSDT tokens represent your vault share while maintaining liquidity
- **Automated Yield Optimization**: Automatically find and deploy to highest-yield lending protocols
- **Portfolio Tracking**: Real-time monitoring of vault performance and your holdings

### MiniDapp Guidelines Compliance

- Case 3 Implementation: DApp Portal Wallet connection to external DeFi services
- Seamless integration with LINE ecosystem

## 📊 Technical Specifications

### Smart Contracts

- **Language**: Solidity ^0.8.20
- **Framework**: Hardhat with TypeScript
- **Standards**: KIP-7 (mmUSDT), KIP-17 (WithdrawNFT)
- **Upgradability**: Implemented with the UUPS Proxy Pattern
- **Security**: OpenZeppelin contracts with custom extensions

### Frontend

- **Framework**: Next.js 14 with TypeScript
- **UI Library**: Custom components with Tailwind CSS
- **Web3 Integration**: dapp-portal-sdk
- **Mobile Integration**: LIFF (LINE Front-end Framework)

### Backend

- **Framework**: NestJS with TypeScript
- **Database**: MySQL with Sequelize ORM
- **APIs**: RESTful endpoints with Swagger documentation

## 🔒 Security

### Audit Status

- Internal security review completed
- External audit scheduled for mainnet deployment

### Security Features

- Role-based access control (RBAC)
- Emergency pause mechanisms
- Reentrancy protection
- Input validation and sanitization

## 📈 Roadmap

### Phase 1 (Completed) ✅

- Core DeFi contracts development
- Frontend MiniDapp integration
- Backend API services
- Testnet deployment and testing

### Phase 2 (In Progress) 🔄

- Mainnet deployment
- External security audit
- Advanced yield deployment strategies
- Cross-chain bridge integrations

### Phase 3 (Planned) 📋

- Additional yield strategies
- Integration with more DeFi protocols

## 🤝 Contributing

We welcome contributions from the community! 

### Development Setup

```bash
# Fork and clone the repository
git clone https://github.com/your-username/magic-millstone.git

# Create a new branch
git checkout -b feature/amazing-feature

# Implement your changes and commit
git commit -m 'Add amazing feature'

# Push and create a Pull Request
git push origin feature/amazing-feature
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links
- **Demo Video**: [Watch Magic Millstone in Action](https://www.youtube.com/watch?v=LiVESAGOlNU)
- **Documentation**: [Detailed Technical Docs](https://github.com/HappyBerrysBoy/magic-millstone)

## 🙏 Acknowledgments

Special thanks to:

- **Korea Stablecoin Hackathon** organizers
- **Kaia Foundation** for blockchain infrastructure
- **LINE NEXT** for MiniDapp platform
- **Tether** for USDT integration support
- **Open Source Community** for amazing tools and libraries

---

**Magic Millstone** - _Transforming DeFi accessibility through innovative yield optimization and seamless mobile integration_ 🌟
