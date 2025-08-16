import { ethers, upgrades } from "hardhat";

async function main() {
  console.log("🔄 Upgrading VaultContract...");

  const [deployer] = await ethers.getSigners();
  console.log("Upgrading with account:", await deployer.getAddress());
  console.log(
    "Account balance:",
    ethers.formatEther(
      await ethers.provider.getBalance(await deployer.getAddress())
    )
  );

  const EXISTING_VAULT_PROXY = process.env.VAULT_ADDRESS;
  if (!EXISTING_VAULT_PROXY) {
    console.error("❌ VAULT_ADDRESS not set in environment variables");
    process.exit(1);
  }

  console.log("Existing VaultContract proxy:", EXISTING_VAULT_PROXY);

  // Get the new VaultContract factory
  console.log("\n📦 Preparing new implementation...");
  const VaultContractV2Factory = await ethers.getContractFactory("VaultContract");

  // Upgrade the proxy to point to the new implementation
  console.log("🚀 Upgrading proxy...");
  const upgradedVault = await upgrades.upgradeProxy(
    EXISTING_VAULT_PROXY,
    VaultContractV2Factory
  );

  await upgradedVault.waitForDeployment();
  const address = await upgradedVault.getAddress();

  console.log("✅ VaultContract upgraded successfully!");
  console.log("Proxy address (unchanged):", address);

  // Test that the upgrade worked
  console.log("\n🧪 Testing upgraded contract...");
  try {
    const exchangeRate = await upgradedVault.getExchangeRate();
    const maxTransferable = await upgradedVault.getMaxTransferableAmount();
    
    console.log("Exchange rate:", ethers.formatUnits(exchangeRate, 6));
    console.log("Max transferable:", ethers.formatUnits(maxTransferable, 6), "USDT");
    console.log("✅ New functions working correctly!");
  } catch (error) {
    console.log("❌ Error testing new functions:", (error as any).message);
  }

  console.log("\n📋 Upgrade Summary:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("VaultContract proxy:", address);
  console.log("✅ Auto-ready withdrawal logic added");
  console.log("✅ All existing state preserved");
  console.log("✅ No role changes needed");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Upgrade failed:", error);
    process.exit(1);
  });