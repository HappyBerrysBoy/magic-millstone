import { ethers } from "hardhat";

async function main(): Promise<void> {
  const [admin] = await ethers.getSigners();
  
  const WITHDRAWNFT_ADDRESS: string = process.env.WITHDRAWNFT_ADDRESS || "";
  const VAULT_ADDRESS: string = process.env.VAULT_ADDRESS || "";
  
  if (!WITHDRAWNFT_ADDRESS || !VAULT_ADDRESS) {
    console.error("❌ Missing required addresses in .env");
    process.exit(1);
  }
  
  console.log("🔧 Updating WithdrawNFT vault contract address");
  console.log("Admin address:", admin.address);
  console.log("WithdrawNFT address:", WITHDRAWNFT_ADDRESS);
  console.log("Current vault address:", VAULT_ADDRESS);
  
  const withdrawNFT = await ethers.getContractAt("WithdrawNFT", WITHDRAWNFT_ADDRESS);
  
  // Check current stored address
  const currentVaultAddress = await withdrawNFT.vaultContract();
  console.log("Current stored vault address:", currentVaultAddress);
  
  if (currentVaultAddress.toLowerCase() === VAULT_ADDRESS.toLowerCase()) {
    console.log("✅ Vault address is already correct!");
    return;
  }
  
  console.log("📝 Updating vault contract address...");
  
  try {
    // Update the vault contract address
    const tx = await withdrawNFT.updateVaultContract(VAULT_ADDRESS);
    console.log("Transaction sent:", tx.hash);
    
    const receipt = await tx.wait();
    console.log("✅ Transaction confirmed in block:", receipt.blockNumber);
    
    // Verify the update
    const newVaultAddress = await withdrawNFT.vaultContract();
    console.log("New stored vault address:", newVaultAddress);
    
    if (newVaultAddress.toLowerCase() === VAULT_ADDRESS.toLowerCase()) {
      console.log("🎉 SUCCESS: Vault address updated correctly!");
      
      // Test the fixed function
      console.log("\n🧪 Testing getWithdrawRequestFromVault after fix:");
      
      const testNfts = [35, 47];
      for (const nftId of testNfts) {
        try {
          const result = await withdrawNFT.getWithdrawRequestFromVault(nftId);
          console.log(`NFT ${nftId}:`);
          console.log(`  Amount: ${ethers.formatUnits(result[0], 6)} USDT`);
          console.log(`  Status: ${result[3].toString()} (${result[3].toString() === "1" ? "READY" : "PENDING"})`);
          console.log(`  Requester: ${result[4]}`);
          console.log(`  Has valid requester: ${result[4] !== "0x0000000000000000000000000000000000000000" ? "✅" : "❌"}`);
        } catch (error) {
          console.log(`❌ NFT ${nftId} test failed:`, error);
        }
      }
      
    } else {
      console.log("❌ FAILED: Vault address not updated correctly");
    }
    
  } catch (error) {
    console.error("❌ Failed to update vault address:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });