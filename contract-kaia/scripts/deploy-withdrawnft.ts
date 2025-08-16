import { ethers, upgrades } from "hardhat";

async function main() {
  console.log("Deploying WithdrawNFT...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", await deployer.getAddress());
  console.log(
    "Account balance:",
    ethers.formatEther(
      await ethers.provider.getBalance(await deployer.getAddress())
    )
  );

  // Deploy WithdrawNFT as upgradeable proxy
  console.log("\nDeploying WithdrawNFT (Upgradeable)...");
  const WithdrawNFTFactory = await ethers.getContractFactory("WithdrawNFT");
  const placeholderVaultAddress = process.env.VAULT_ADDRESS || "";

  const withdrawNFT = await upgrades.deployProxy(
    WithdrawNFTFactory,
    [
      "Withdraw Request NFT",
      "wNFT",
      await deployer.getAddress(),
      placeholderVaultAddress,
    ],
    {
      initializer: "initialize",
      kind: "uups",
    }
  );
  await withdrawNFT.waitForDeployment();

  const address = await withdrawNFT.getAddress();
  console.log("✅ WithdrawNFT proxy deployed to:", address);

  console.log("\n📋 Deployment Summary:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("WithdrawNFT:", address);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  console.log("\n🔧 Next Steps:");
  console.log(
    "1. Grant MINTER_ROLE, BURNER_ROLE, and MANAGER_ROLE to VaultContract"
  );
  console.log("2. Use this address in VaultContract deployment");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
