import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
import "@typechain/hardhat";
import "@openzeppelin/hardhat-upgrades";
import "dotenv/config";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  typechain: {
    outDir: "types",
    target: "ethers-v6",
    alwaysGenerateOverloads: false,
    dontOverrideCompile: false,
  },
  networks: {
    kairos: {
      url: "https://public-en-kairos.node.kaia.io",
      accounts: process.env.KAIROS_PRIVATE_KEY
        ? [process.env.KAIROS_PRIVATE_KEY]
        : [],
    },
    kaia: {
      url: "https://public-en.node.kaia.io",
      accounts: process.env.KAIA_PRIVATE_KEY
        ? [process.env.KAIA_PRIVATE_KEY]
        : [],
    },
  },
};

export default config;
