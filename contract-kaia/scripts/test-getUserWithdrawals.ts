import { ethers } from "hardhat";

async function main() {
  console.log("🔍 Testing getUserWithdrawals function...");

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
    // First check basic contract info
    console.log("\n📊 Checking contract info...");
    const currentTokenId = await withdrawNFT.getCurrentTokenId();
    console.log("Current token counter:", currentTokenId.toString());
    
    console.log("\n📊 Calling getUserWithdrawals...");
    const result = await withdrawNFT.getUserWithdrawals(TEST_ADDRESS);
    
    console.log("\n📋 Results:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Address:", TEST_ADDRESS);
    console.log("Token IDs:", result.tokenIds.map((id: any) => id.toString()));
    console.log("Amounts:", result.amounts.map((amt: any) => ethers.formatUnits(amt, 6) + " USDT"));
    console.log("Total Amount:", ethers.formatUnits(result.totalAmount, 6) + " USDT");
    console.log("Number of NFTs:", result.tokenIds.length);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    if (result.tokenIds.length === 0) {
      console.log("✅ Address has no withdrawal NFTs");
    } else {
      console.log("✅ Found withdrawal NFTs for this address");
    }

  } catch (error) {
    console.error("❌ Error:", error);
    console.log("\n🔍 Let's check if user has any NFTs first...");
    
    try {
      const balance = await withdrawNFT.balanceOf(TEST_ADDRESS);
      console.log("NFT balance:", balance.toString());
    } catch (balanceError) {
      console.error("❌ Error getting balance:", balanceError);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });