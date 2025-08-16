import { ethers } from "hardhat";

async function main() {
  console.log("🔍 Check New NFT #8 (Corrected Yield)");

  const VAULT_ADDRESS = process.env.VAULT_ADDRESS;
  const WITHDRAWNFT_ADDRESS = process.env.WITHDRAWNFT_ADDRESS;
  
  if (!VAULT_ADDRESS || !WITHDRAWNFT_ADDRESS) {
    console.error("❌ Missing contract addresses");
    process.exit(1);
  }

  const vaultContract = await ethers.getContractAt("VaultContract", VAULT_ADDRESS);
  const withdrawNFT = await ethers.getContractAt("WithdrawNFT", WITHDRAWNFT_ADDRESS);

  const nftId = 8; // New NFT
  
  console.log("\n📊 Exchange Rate Info:");
  const exchangeRate = await vaultContract.getExchangeRate();
  console.log("Current exchange rate:", ethers.formatUnits(exchangeRate, 6));
  
  console.log(`\n🎫 NFT #${nftId} Analysis:`);
  
  try {
    const owner = await withdrawNFT.ownerOf(nftId);
    const request = await vaultContract.getWithdrawRequest(nftId);
    
    console.log("Owner:", owner);
    console.log("Amount stored in NFT:", ethers.formatUnits(request.amount, 6), "USDT");
    console.log("Status:", ["PENDING", "READY"][request.status]);
    console.log("Request time:", new Date(Number(request.requestTime) * 1000).toLocaleString());
    
    // This should show: 10 mmUSDT * 1.1 rate = 11 USDT
    console.log("\n💰 Yield Calculation:");
    console.log("User requested: 10 mmUSDT");
    console.log("Exchange rate: 1.1 (10% yield)");
    console.log("Expected final amount: 10 * 1.1 = 11 USDT");
    console.log("Actual amount in NFT:", ethers.formatUnits(request.amount, 6), "USDT");
    
    const isCorrect = request.amount === ethers.parseUnits("11", 6);
    console.log("Yield applied correctly:", isCorrect ? "✅" : "❌");
    
    // Get the raw tokenURI 
    const tokenURI = await withdrawNFT.tokenURI(nftId);
    console.log("\n🖼️ NFT Metadata:");
    
    // Decode base64
    const jsonData = tokenURI.split(",")[1];
    const decoded = Buffer.from(jsonData, 'base64').toString();
    const metadata = JSON.parse(decoded);
    
    console.log("NFT shows amount:", metadata.amount, "USDT");
    console.log("NFT shows status:", metadata.status);
    
  } catch (error: any) {
    console.log("❌ Error:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });