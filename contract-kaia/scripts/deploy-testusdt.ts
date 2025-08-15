import { ethers } from "hardhat";

async function main() {
  console.log("Deploying TestUSDT...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", await deployer.getAddress());
  console.log(
    "Account balance:",
    ethers.formatEther(
      await ethers.provider.getBalance(await deployer.getAddress())
    )
  );

  // Deploy TestUSDT
  console.log("\nDeploying TestUSDT...");
  const TestUSDTFactory = await ethers.getContractFactory("TestUSDT");
  const testUSDT = await TestUSDTFactory.deploy();
  await testUSDT.waitForDeployment();
  
  const address = await testUSDT.getAddress();
  console.log("✅ TestUSDT deployed to:", address);

  // Mint some tokens to deployer for testing
  const mintAmount = ethers.parseUnits("1000000", 6); // 1M USDT
  console.log("\nMinting test tokens...");
  await testUSDT.mint(await deployer.getAddress(), mintAmount);
  console.log("✅ Minted 1,000,000 USDT to deployer");

  console.log("\n📋 Deployment Summary:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("TestUSDT:", address);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });