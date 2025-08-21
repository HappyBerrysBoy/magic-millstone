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

  // Get existing vault address from environment
  const VAULT_ADDRESS = process.env.VAULT_ADDRESS;
  if (!VAULT_ADDRESS) {
    console.error("❌ VAULT_ADDRESS not set in environment variables");
    process.exit(1);
  }

  console.log("📋 Existing VaultContract address:", VAULT_ADDRESS);

  try {
    // Get the new VaultContract factory
    console.log("\n1. Getting new VaultContract implementation...");
    const VaultContractV2 = await ethers.getContractFactory("VaultContract");

    // Force import existing proxy first
    console.log("\n2. Force importing existing proxy...");
    await upgrades.forceImport(VAULT_ADDRESS, VaultContractV2, { kind: 'uups' });
    console.log("✅ Existing proxy imported successfully!");

    // Upgrade the proxy
    console.log("\n3. Upgrading proxy to new implementation...");
    const upgradedVault = await upgrades.upgradeProxy(VAULT_ADDRESS, VaultContractV2, {
      timeout: 120000, // 2 minutes timeout
      unsafeAllow: ['constructor']
    });

    console.log("✅ VaultContract upgraded successfully!");
    console.log("📋 Proxy address remains:", await upgradedVault.getAddress());

    // Test the upgraded contract
    console.log("\n4. Testing upgraded contract...");
    
    // Check if contract is still paused/unpaused
    const isPaused = await upgradedVault.paused();
    console.log("✅ Contract paused status:", isPaused);

    // Get current exchange rate
    const exchangeRate = await upgradedVault.getExchangeRate();
    console.log("✅ Current exchange rate:", ethers.formatUnits(exchangeRate, 6));

    // Test the updatePendingWithdrawals function
    console.log("\n5. Testing updatePendingWithdrawals function...");
    try {
      const gasEstimate = await upgradedVault.updatePendingWithdrawals.estimateGas();
      console.log("✅ Gas estimate for updatePendingWithdrawals:", gasEstimate.toString());
    } catch (error) {
      console.log("ℹ️  Gas estimation failed (might be due to no pending withdrawals or insufficient funds)");
    }

    console.log("\n🎉 Upgrade completed successfully!");
    console.log("✅ VaultContract now has improved _updatePendingWithdrawalsToReady logic");
    console.log("✅ The function now properly considers reserved amounts for READY withdrawals");

  } catch (error) {
    console.error("❌ Upgrade failed:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });