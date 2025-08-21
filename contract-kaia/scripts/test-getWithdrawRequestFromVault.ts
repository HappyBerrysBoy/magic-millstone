import { ethers } from "hardhat";

async function main() {
  console.log("🔍 Testing getWithdrawRequestFromVault function...");

  const WITHDRAWNFT_ADDRESS = process.env.WITHDRAWNFT_ADDRESS;
  if (!WITHDRAWNFT_ADDRESS) {
    console.error("❌ WITHDRAWNFT_ADDRESS not set in environment variables");
    process.exit(1);
  }

  // Test address provided by user
  const TEST_ADDRESS = "0x26AC28D33EcBf947951d6B7d8a1e6569eE73d076";
  
  console.log("WithdrawNFT contract:", WITHDRAWNFT_ADDRESS);
  console.log("Testing address:", TEST_ADDRESS);

  // Connect to the deployed WithdrawNFT contract
  const WithdrawNFTFactory = await ethers.getContractFactory("WithdrawNFT");
  const withdrawNFT = WithdrawNFTFactory.attach(WITHDRAWNFT_ADDRESS);

  try {
    console.log("\n📊 Getting user withdrawals first...");
    const userWithdrawals = await withdrawNFT.getUserWithdrawals(TEST_ADDRESS);
    
    if (userWithdrawals.tokenIds.length === 0) {
      console.log("❌ No withdrawal NFTs found for this address");
      return;
    }

    console.log("📋 Found", userWithdrawals.tokenIds.length, "withdrawal NFTs");
    console.log("Token IDs:", userWithdrawals.tokenIds.map((id: any) => id.toString()));

    console.log("\n🔍 Getting detailed vault info for each NFT...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    for (let i = 0; i < userWithdrawals.tokenIds.length; i++) {
      const tokenId = userWithdrawals.tokenIds[i];
      console.log(`\n🎫 NFT #${tokenId}:`);
      
      try {
        // Get vault details
        const vaultDetails = await withdrawNFT.getWithdrawRequestFromVault(tokenId);
        
        // Format status
        const statusNames = ["PENDING", "READY"];
        const statusName = statusNames[vaultDetails.status] || `UNKNOWN(${vaultDetails.status})`;
        
        // Format timestamps
        const requestTime = vaultDetails.requestTime > 0 
          ? new Date(Number(vaultDetails.requestTime) * 1000).toISOString()
          : "Not set";
        const readyTime = vaultDetails.readyTime > 0 
          ? new Date(Number(vaultDetails.readyTime) * 1000).toISOString()
          : "Not set";

        console.log("  💰 Amount:", ethers.formatUnits(vaultDetails.amount, 6) + " USDT");
        console.log("  📊 Status:", `${vaultDetails.status} (${statusName})`);
        console.log("  📅 Request Time:", requestTime);
        console.log("  ⏰ Ready Time:", readyTime);
        console.log("  👤 Requester:", vaultDetails.requester);
        
        // Check if ready
        if (vaultDetails.status === 1) {
          console.log("  ✅ This withdrawal is READY for execution!");
        } else {
          console.log("  ⏳ This withdrawal is still PENDING");
        }
        
      } catch (vaultError: any) {
        console.log("  ❌ Error getting vault details:", vaultError.message);
      }
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ Vault details check completed");

  } catch (error: any) {
    console.error("❌ Error:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });