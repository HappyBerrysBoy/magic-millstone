import type { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-ethers';
import '@nomicfoundation/hardhat-chai-matchers';
// import '@nomicfoundation/hardhat-verify';  // 호환성 문제로 임시 비활성화
import '@typechain/hardhat';
import '@openzeppelin/hardhat-upgrades';
import * as dotenv from 'dotenv';

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.28',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true, // Stack too deep 에러 해결
    },
  },
  networks: {
    hardhat: {
      chainId: 1337,
      // 메인넷 fork 설정
      forking: {
        url:
          process.env.MAINNET_RPC_URL ||
          'https://eth-mainnet.g.alchemy.com/v2/G1L6TFk5SMqXf_9IXKUmiu1IgpCfi-ex',
        // blockNumber: 18500000, // 특정 블록에서 fork (선택사항)
        enabled: process.env.FORK_MAINNET === 'true', // 환경변수로 제어
      },
      // 계정 설정
      accounts: {
        mnemonic:
          process.env.MNEMONIC ||
          'test test test test test test test test test test test junk',
        count: 20, // 테스트 계정 20개 생성
        accountsBalance: '10000000000000000000000', // 각 계정에 10,000 ETH
      },
    },
    localhost: {
      url: 'http://127.0.0.1:8545',
      chainId: 1337,
    },
    // 메인넷 직접 연결용 (실제 배포시 사용)
    mainnet: {
      url:
        process.env.MAINNET_RPC_URL ||
        'https://eth-mainnet.g.alchemy.com/v2/G1L6TFk5SMqXf_9IXKUmiu1IgpCfi-ex',
      accounts: process.env.MAINNET_PRIVATE_KEY ? [process.env.MAINNET_PRIVATE_KEY] : [],
      chainId: 1,
      gasPrice: 'auto',
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || 'https://sepolia.gateway.tenderly.co',
      accounts: process.env.SEPOLIA_PRIVATE_KEY ? [process.env.SEPOLIA_PRIVATE_KEY] : [],
      gasPrice: 20000000000, // 20 gwei
      chainId: 11155111,
    },
  },
  // etherscan: {
  //   apiKey: {
  //     sepolia: process.env.ETHERSCAN_API_KEY || '',
  //   },
  // },
};

export default config;
