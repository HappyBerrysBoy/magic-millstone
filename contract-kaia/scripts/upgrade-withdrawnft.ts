import { ethers, upgrades } from "hardhat";

async function main() {
  console.log("🔄 Upgrading WithdrawNFT...");

  const [deployer] = await ethers.getSigners();
  console.log("Upgrading with account:", await deployer.getAddress());

  const EXISTING_WITHDRAWNFT_PROXY = process.env.WITHDRAWNFT_ADDRESS;
  if (!EXISTING_WITHDRAWNFT_PROXY) {
    console.error("❌ WITHDRAWNFT_ADDRESS not set in environment variables");
    process.exit(1);
  }

  console.log("Existing WithdrawNFT proxy:", EXISTING_WITHDRAWNFT_PROXY);

  // Get the new WithdrawNFT factory
  console.log("\n📦 Preparing new implementation...");
  const WithdrawNFTFactory = await ethers.getContractFactory("WithdrawNFT");

  // Upgrade the proxy to point to the new implementation
  console.log("🚀 Upgrading proxy...");
  const upgradedNFT = await upgrades.upgradeProxy(
    EXISTING_WITHDRAWNFT_PROXY,
    WithdrawNFTFactory
  );

  await upgradedNFT.waitForDeployment();
  const address = await upgradedNFT.getAddress();

  console.log("✅ WithdrawNFT upgraded successfully!");
  console.log("Proxy address (unchanged):", address);

  console.log("\n📋 Upgrade Summary:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("WithdrawNFT proxy:", address);
  console.log("✅ Fixed status display in NFT metadata");
  console.log("✅ Now shows PENDING/READY correctly");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Upgrade failed:", error);
    process.exit(1);
  });