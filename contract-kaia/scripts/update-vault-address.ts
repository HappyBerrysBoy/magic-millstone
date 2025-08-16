import { ethers } from "hardhat";

async function main() {
  console.log("🔄 Updating Vault Address in WithdrawNFT");

  const [admin] = await ethers.getSigners();
  console.log("Admin address:", admin.address);

  const WITHDRAWNFT_ADDRESS = process.env.WITHDRAWNFT_ADDRESS;
  const VAULT_ADDRESS = process.env.VAULT_ADDRESS;

  if (!WITHDRAWNFT_ADDRESS || !VAULT_ADDRESS) {
    console.error("❌ Missing contract addresses");
    process.exit(1);
  }

  const withdrawNFT = await ethers.getContractAt("WithdrawNFT", WITHDRAWNFT_ADDRESS);

  // Check current vault address
  const currentVaultAddress = await withdrawNFT.vaultContract();
  console.log("Current vault address:", currentVaultAddress);
  console.log("New vault address:", VAULT_ADDRESS);

  if (currentVaultAddress.toLowerCase() === VAULT_ADDRESS.toLowerCase()) {
    console.log("✅ Vault address is already correct!");
    return;
  }

  try {
    console.log("\n🔄 Updating vault address...");
    const tx = await withdrawNFT.updateVaultContract(VAULT_ADDRESS);
    console.log("Transaction sent:", tx.hash);
    
    const receipt = await tx.wait();
    console.log("✅ Vault address updated in block:", receipt.blockNumber);

    // Verify the update
    const newVaultAddress = await withdrawNFT.vaultContract();
    console.log("Updated vault address:", newVaultAddress);
    console.log("Update successful:", newVaultAddress.toLowerCase() === VAULT_ADDRESS.toLowerCase() ? "✅" : "❌");

  } catch (error: any) {
    console.log("❌ Update failed:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });