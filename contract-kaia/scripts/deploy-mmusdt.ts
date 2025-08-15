import { ethers, upgrades } from "hardhat";

async function main() {
  console.log("Deploying mmUSDT...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", await deployer.getAddress());
  console.log(
    "Account balance:",
    ethers.formatEther(
      await ethers.provider.getBalance(await deployer.getAddress())
    )
  );

  // Deploy mmUSDT as upgradeable proxy
  console.log("\nDeploying mmUSDT (Upgradeable)...");
  const mmUSDTFactory = await ethers.getContractFactory("mmUSDT");
  const mmUSDTToken = await upgrades.deployProxy(
    mmUSDTFactory,
    ["Magic Millstone USDT", "mmUSDT", 6, await deployer.getAddress()],
    {
      initializer: "initialize",
      kind: "uups",
    }
  );
  await mmUSDTToken.waitForDeployment();
  
  const address = await mmUSDTToken.getAddress();
  console.log("✅ mmUSDT proxy deployed to:", address);

  console.log("\n📋 Deployment Summary:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("mmUSDT:", address);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  console.log("\n🔧 Next Steps:");
  console.log("1. Grant MINTER_ROLE and BURNER_ROLE to VaultContract");
  console.log("2. Use this address in VaultContract deployment");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });