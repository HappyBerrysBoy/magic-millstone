import { ethers } from "hardhat";

async function main(): Promise<void> {
  const [user] = await ethers.getSigners();

  const VAULT_ADDRESS = process.env.VAULT_ADDRESS || "";
  const MMUSDT_ADDRESS = process.env.MMUSDT_ADDRESS || "";

  console.log("🔍 Testing Withdrawal with Debug Events");
  console.log("User address:", user.address);

  // Connect to contracts
  const vaultContract = await ethers.getContractAt("VaultContract", VAULT_ADDRESS);
  const mmUSDTToken = await ethers.getContractAt("mmUSDT", MMUSDT_ADDRESS);

  // Check current state
  const mmUSDTBalance = await (mmUSDTToken as any).balanceOf(user.address);
  const withdrawAmount = ethers.parseUnits("1", 6); // Small 1 USDT withdrawal
  
  console.log("mmUSDT balance:", ethers.formatUnits(mmUSDTBalance, 6), "mmUSDT");
  console.log("Withdrawal amount:", ethers.formatUnits(withdrawAmount, 6), "mmUSDT");

  if (mmUSDTBalance < withdrawAmount) {
    console.log("❌ Insufficient mmUSDT balance for withdrawal");
    return;
  }

  // Check vault state before withdrawal
  const vaultInfo = await (vaultContract as any).getVaultInfo();
  console.log("\n📊 Vault State Before Withdrawal:");
  console.log("Vault USDT balance:", ethers.formatUnits(vaultInfo[0], 6), "USDT");
  console.log("Total requested:", ethers.formatUnits(vaultInfo[5], 6), "USDT");
  console.log("Available:", ethers.formatUnits(vaultInfo[0] - vaultInfo[5], 6), "USDT");

  try {
    console.log("\n🔄 Requesting withdrawal...");

    // Request withdrawal and capture events
    const tx = await (vaultContract as any)
      .connect(user)
      .requestWithdraw(withdrawAmount);

    console.log("Transaction sent:", tx.hash);
    
    const receipt = await tx.wait();
    console.log("✅ Transaction confirmed in block:", receipt.blockNumber);

    // Parse debug events
    console.log("\n📝 Debug Events:");
    for (const log of receipt.logs) {
      try {
        const parsed = vaultContract.interface.parseLog(log);
        
        if (parsed?.name === "DebugWithdrawCalculation") {
          const args = parsed.args;
          console.log(`🔍 Debug Calculation for NFT #${args[0]}:`);
          console.log(`  Current Balance: ${ethers.formatUnits(args[1], 6)} USDT`);
          console.log(`  Total Requested Before: ${ethers.formatUnits(args[2], 6)} USDT`);
          console.log(`  Final USDT Amount: ${ethers.formatUnits(args[3], 6)} USDT`);
          console.log(`  Total Requested After: ${ethers.formatUnits(args[4], 6)} USDT`);
          console.log(`  Should Be Ready: ${args[5] ? "YES" : "NO"}`);
          console.log(`  Calculation: ${ethers.formatUnits(args[1], 6)} >= ${ethers.formatUnits(args[4], 6)} = ${args[5]}`);
        } else if (parsed?.name === "WithdrawRequested") {
          console.log(`📄 WithdrawRequested: NFT #${parsed.args[2]}, Amount: ${ethers.formatUnits(parsed.args[1], 6)} USDT`);
        } else if (parsed?.name === "WithdrawMarkedReady") {
          console.log(`✅ WithdrawMarkedReady: NFT #${parsed.args[0]}`);
        }
      } catch {
        // Skip unparseable logs
      }
    }

  } catch (error: any) {
    console.log("❌ Withdrawal request failed:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });