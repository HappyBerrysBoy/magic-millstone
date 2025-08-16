import { ethers, upgrades } from "hardhat";

async function main() {
  console.log("Deploying VaultContract...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", await deployer.getAddress());
  console.log(
    "Account balance:",
    ethers.formatEther(
      await ethers.provider.getBalance(await deployer.getAddress())
    )
  );

  // Required addresses
  const USDT_ADDRESS = process.env.TESTUUSDT_ADDRESS;
  const MMUSDT_ADDRESS = process.env.MMUSDT_ADDRESS;
  const WITHDRAWNFT_ADDRESS = process.env.WITHDRAWNFT_ADDRESS;

  // Validate addresses
  if (
    USDT_ADDRESS === "0x0000000000000000000000000000000000000000" ||
    MMUSDT_ADDRESS === "0x0000000000000000000000000000000000000000" ||
    WITHDRAWNFT_ADDRESS === "0x0000000000000000000000000000000000000000"
  ) {
    console.error(
      "❌ Please update the contract addresses in this script first!"
    );
    console.error("   - USDT_ADDRESS: Deploy TestUSDT first");
    console.error("   - MMUSDT_ADDRESS: Deploy mmUSDT first");
    console.error("   - WITHDRAWNFT_ADDRESS: Deploy WithdrawNFT first");
    process.exit(1);
  }

  console.log("\nUsing contract addresses:");
  console.log("USDT:        ", USDT_ADDRESS);
  console.log("mmUSDT:      ", MMUSDT_ADDRESS);
  console.log("WithdrawNFT: ", WITHDRAWNFT_ADDRESS);

  // Deploy VaultContract as upgradeable proxy
  console.log("\nDeploying VaultContract (Upgradeable)...");
  const VaultContractFactory = await ethers.getContractFactory("VaultContract");
  const vaultContract = await upgrades.deployProxy(
    VaultContractFactory,
    [
      USDT_ADDRESS,
      MMUSDT_ADDRESS,
      WITHDRAWNFT_ADDRESS,
      await deployer.getAddress(),
    ],
    {
      initializer: "initialize",
      kind: "uups",
    }
  );
  await vaultContract.waitForDeployment();

  const address = await vaultContract.getAddress();
  console.log("✅ VaultContract proxy deployed to:", address);

  console.log("\n📋 Deployment Summary:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("VaultContract:", address);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  console.log("\n🔧 Next Steps:");
  console.log("1. Grant roles to VaultContract on mmUSDT and WithdrawNFT");
  console.log("2. Run setup-roles.ts script to configure permissions");
  console.log("3. Test the complete vault system");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
