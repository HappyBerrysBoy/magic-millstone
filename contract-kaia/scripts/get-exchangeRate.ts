import { ethers } from "hardhat";

async function main() {
  console.log("📊 Getting Current Exchange Rate");

  const VAULT_ADDRESS = process.env.VAULT_ADDRESS;
  if (!VAULT_ADDRESS) {
    console.error("❌ Missing vault address");
    process.exit(1);
  }

  const vaultContract = await ethers.getContractAt(
    "VaultContract",
    VAULT_ADDRESS
  );

  // Get current exchange rate
  const currentRate = await vaultContract.getExchangeRate();
  console.log("Current exchange rate:", ethers.formatUnits(currentRate, 6));
  
  const yieldPercentage = (Number(ethers.formatUnits(currentRate, 6)) - 1) * 100;
  console.log(`Yield percentage: ${yieldPercentage.toFixed(2)}%`);
  
  // Get additional vault info
  const vaultInfo = await vaultContract.getVaultInfo();
  console.log("\n💰 Vault Status:");
  console.log("USDT balance:", ethers.formatUnits(vaultInfo[0], 6), "USDT");
  console.log("mmUSDT total supply:", ethers.formatUnits(vaultInfo[1], 6), "mmUSDT");
  console.log("Total withdrawal requests:", ethers.formatUnits(vaultInfo[5], 6), "mmUSDT");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });