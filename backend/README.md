# ![Magic Millstone Logo](/frontend/public/images/MillstoneIcon.png) Magic Millstone

**Korea Stablecoin Hackathon - Kaia-Native USDT DeFi Track Participant**

This project was built using NestJS with TypeScript.

## 🚀 Getting Started

### Prerequisites

- Node.js v20.x (LTS)
- yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/HappyBerrysBoy/magic-millstone.git
cd backend

# Install dependencies
yarn install
```

### Environment Setup

If needed, other environment files can be added.
Refer to the `.env.example` file for required environment variables. Below is an example of a `.env` file:

```
# Database
DB_MILLSTONE_HOST=localhost
DB_MILLSTONE_HOST_PORT=3306
DB_MILLSTONE_HOST_USERNAME=usrname
DB_MILLSTONE_HOST_PASSWORD=password
DB_MILLSTONE_HOST_NAME=host

# Application Configuration
PORT=port
PROJECT_NAME=Millstone
SWAGGER_USED=Y
SWAGGER_USER=swagger_user
SWAGGER_PASSWORD=swagger_password

# Kaia
KAIA_RPC_URL=kaia_rpc_url
ADMIN_PRIVATE_KEY=admin_private_key
VAULT_ADDRESS=vault_contract_address
BRIDGE_DESTINATION_ADDRESS=bridge_address
KAIA_USDT_ADDRESS=usdt_address

# Ethereum
ETH_RPC_URL=eth_rpc_url
MILLSTONE_AI_VAULT_ADDRESS=millstone_ai_vault_address
USDT_ADDRESS=usdt_address
```

### Build & Run

```bash
# Build NestJS Application
yarn build

# Run NestJS Application
yarn start
```

## License

This project is licensed under the MIT License.
