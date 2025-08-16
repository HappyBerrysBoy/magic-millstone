import { ethers } from "hardhat";

async function main() {
  console.log("🔍 Check All NFT Statuses");

  const VAULT_ADDRESS = process.env.VAULT_ADDRESS;
  const WITHDRAWNFT_ADDRESS = process.env.WITHDRAWNFT_ADDRESS;
  
  if (!VAULT_ADDRESS || !WITHDRAWNFT_ADDRESS) {
    console.error("❌ Missing contract addresses");
    process.exit(1);
  }

  const vaultContract = await ethers.getContractAt("VaultContract", VAULT_ADDRESS);
  const withdrawNFT = await ethers.getContractAt("WithdrawNFT", WITHDRAWNFT_ADDRESS);

  console.log("\n📊 Vault State:");
  const vaultInfo = await vaultContract.getVaultInfo();
  const exchangeRate = await vaultContract.getExchangeRate();
  
  console.log("Vault USDT balance:", ethers.formatUnits(vaultInfo[0], 6), "USDT");
  console.log("Total requested:", ethers.formatUnits(vaultInfo[5], 6), "USDT");
  console.log("Exchange rate:", ethers.formatUnits(exchangeRate, 6));
  console.log("Required reserves:", ethers.formatUnits(vaultInfo[5], 6), "USDT (already applied)");
  console.log("Max transferable:", ethers.formatUnits(vaultInfo[0] - vaultInfo[5], 6), "USDT");

  // Check all NFTs
  const currentTokenId = await withdrawNFT.getCurrentTokenId();
  console.log("\n🎫 All NFT Status (1 to", (currentTokenId - 1n).toString(), "):");
  
  let activeNFTs = 0;
  let pendingNFTs = 0;
  let readyNFTs = 0;
  
  for (let i = 1; i < Number(currentTokenId); i++) {
    try {
      const owner = await withdrawNFT.ownerOf(i);
      const request = await vaultContract.getWithdrawRequest(i);
      
      activeNFTs++;
      if (request.status === 0) pendingNFTs++;
      if (request.status === 1) readyNFTs++;
      
      console.log(`\n📄 NFT #${i}:`);
      console.log(`  Owner: ${owner.slice(0, 10)}...`);
      console.log(`  Amount: ${ethers.formatUnits(request.amount, 6)} USDT`);
      console.log(`  Status: ${["🔄 PENDING", "✅ READY"][request.status]}`);
      console.log(`  Request: ${new Date(Number(request.requestTime) * 1000).toLocaleString()}`);
      if (request.readyTime > 0) {
        console.log(`  Ready: ${new Date(Number(request.readyTime) * 1000).toLocaleString()}`);
      }
    } catch {
      console.log(`NFT #${i}: 🔥 BURNED`);
    }
  }
  
  console.log("\n📈 Summary:");
  console.log(`Active NFTs: ${activeNFTs}`);
  console.log(`🔄 PENDING: ${pendingNFTs}`);
  console.log(`✅ READY: ${readyNFTs}`);
  console.log(`🔥 BURNED: ${Number(currentTokenId) - 1 - activeNFTs}`);
  
  if (pendingNFTs > 0) {
    console.log("\n💡 Admin can deposit more USDT to make PENDING NFTs READY");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });