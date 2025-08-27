import { ethers } from "hardhat";

async function main() {
  console.log("🌟 Test Yield Exchange Rate (Users Earn Returns!)");

  const [admin] = await ethers.getSigners();
  const VAULT_ADDRESS = process.env.VAULT_ADDRESS;
  const NEW_RATE: string = process.env.NEW_RATE || "1.002619";
  if (!VAULT_ADDRESS) {
    console.error("❌ Missing vault address");
    process.exit(1);
  }

  const vaultContract = await ethers.getContractAt(
    "VaultContract",
    VAULT_ADDRESS
  );

  console.log("\n📊 Current Exchange Rate:");
  let currentRate: bigint;
  try {
    currentRate = await vaultContract.getExchangeRate();
    // Exchange rate is stored with 6 decimals (1e6 = 1.0)
    console.log("Current rate:", ethers.formatUnits(currentRate, 6));
  } catch (error: any) {
    console.log("❌ Error getting exchange rate:", error.message);
    // Fallback to vault info
    const vaultInfo = await vaultContract.getVaultInfo();
    currentRate = vaultInfo[6];
    console.log(
      "Current rate (from vault info):",
      ethers.formatUnits(currentRate, 6)
    );
  }
  console.log("(1.0 = no yield, 1.1 = 10% yield, 1.2 = 20% yield)");

  // Show impact on existing withdrawals
  console.log("\n💰 Current Withdrawal Situation:");
  const vaultInfo = await vaultContract.getVaultInfo();
  const totalRequested = vaultInfo[5];
  const currentReserves = (totalRequested * currentRate) / BigInt(1000000);

  console.log(
    "Total mmUSDT requested:",
    ethers.formatUnits(totalRequested, 6),
    "mmUSDT"
  );
  console.log(
    "Required USDT reserves:",
    ethers.formatUnits(currentReserves, 6),
    "USDT"
  );
  console.log(
    "Vault USDT balance:",
    ethers.formatUnits(vaultInfo[0], 6),
    "USDT"
  );

  // Test setting a yield rate (1.1 = 10% yield for users)
  const newRate = ethers.parseUnits(NEW_RATE, 6);
  const yieldPercentage = (parseFloat(NEW_RATE) - 1) * 100;

  console.log(`\n🚀 Testing ${yieldPercentage}% Yield Rate (${NEW_RATE}):`);
  console.log("New rate:", ethers.formatUnits(newRate, 6));

  const newReserves = (totalRequested * newRate) / BigInt(1000000);
  console.log(
    "Required USDT reserves:",
    ethers.formatUnits(newReserves, 6),
    "USDT"
  );

  const additionalReserves = newReserves - currentReserves;
  console.log(
    "Additional reserves needed:",
    ethers.formatUnits(additionalReserves, 6),
    "USDT"
  );

  // Actually set the new rate (comment out if you don't want to change it)
  try {
    console.log("\n⚙️ Setting 20% yield rate...");
    const tx = await vaultContract.setExchangeRate(newRate);
    console.log("Transaction sent:", tx.hash);

    const receipt = await tx.wait();
    console.log("✅ Yield rate updated in block:", receipt.blockNumber);

    // Verify the change
    const updatedRate = await vaultContract.getExchangeRate();
    console.log("Verified new rate:", ethers.formatUnits(updatedRate, 6));

    // Check new required reserves
    const maxTransferable = await vaultContract.getMaxTransferableAmount();
    console.log(
      "Max transferable after yield:",
      ethers.formatUnits(maxTransferable, 6),
      "USDT"
    );
  } catch (error: any) {
    console.log("❌ Failed to set yield rate:", error.message);
  }

  console.log("\n💡 Yield Mechanism:");
  console.log("• Exchange rate 1.0 = no yield for users");
  console.log("• Exchange rate 1.1 = 10% yield for users");
  console.log("• Higher rate = more USDT paid out per mmUSDT");
  console.log("• Users earn returns on their deposits! 🌟");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
