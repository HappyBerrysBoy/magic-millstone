import { ethers } from "hardhat";

async function main(): Promise<void> {
  const [user] = await ethers.getSigners();

  // Replace these with your deployed contract addresses
  const TESTUUSDT_ADDRESS: string =
    process.env.TESTUUSDT_ADDRESS || "YOUR_TESTUUSDT_ADDRESS";
  const VAULT_ADDRESS: string =
    process.env.VAULT_ADDRESS || "YOUR_VAULT_ADDRESS";
  const WITHDRAW_NFT_ADDRESS: string =
    process.env.WITHDRAW_NFT_ADDRESS || "YOUR_WITHDRAW_NFT_ADDRESS";

  // Connect to deployed contracts
  const testUSDT = await ethers.getContractAt("TestUSDT", TESTUUSDT_ADDRESS);
  const vaultContract = await ethers.getContractAt(
    "VaultContract",
    VAULT_ADDRESS
  );

  console.log("🔍 Testing updatePendingWithdrawals function");
  console.log("User address:", user.address);

  // Step 1: Check vault balance
  console.log("\n1️⃣ Checking vault balance:");
  const vaultBalance = await testUSDT.balanceOf(VAULT_ADDRESS);
  console.log("Vault USDT balance:", ethers.formatUnits(vaultBalance, 6), "USDT");

  // Step 2: Check current token ID and pending withdrawals
  console.log("\n2️⃣ Checking withdrawal requests:");
  const currentTokenId = await vaultContract.withdrawNFT().then(async (nftAddress: string) => {
    const withdrawNFT = await ethers.getContractAt("WithdrawNFT", nftAddress);
    return await withdrawNFT.getCurrentTokenId();
  });
  console.log("Current token ID:", currentTokenId.toString());

  let pendingCount = 0;
  let readyCount = 0;
  let totalPendingAmount = 0n;

  // Get withdrawNFT contract reference
  const withdrawNFTAddress = await vaultContract.withdrawNFT();
  const withdrawNFT = await ethers.getContractAt("WithdrawNFT", withdrawNFTAddress);

  // Check all existing NFTs for their withdrawal status
  for (let i = 1; i < currentTokenId; i++) {
    try {
      const owner = await withdrawNFT.ownerOf(i);
      const withdrawRequest = await vaultContract.withdrawRequests(i);
      
      const status = withdrawRequest.status;
      const amount = withdrawRequest.amount;
      
      console.log(`NFT ${i}: Status ${status}, Amount: ${ethers.formatUnits(amount, 6)} USDT, Owner: ${owner}`);
      
      if (Number(status) === 0) { // PENDING
        pendingCount++;
        totalPendingAmount += BigInt(amount.toString());
      } else if (Number(status) === 1) { // READY
        readyCount++;
      }
    } catch (error) {
      // NFT doesn't exist (burned)
      console.log(`NFT ${i}: Burned or doesn't exist`);
    }
  }

  console.log(`\nSummary before update:`);
  console.log(`- Pending withdrawals: ${pendingCount}`);
  console.log(`- Ready withdrawals: ${readyCount}`);
  console.log(`- Total pending amount: ${ethers.formatUnits(totalPendingAmount, 6)} USDT`);
  console.log(`- Vault balance: ${ethers.formatUnits(vaultBalance, 6)} USDT`);

  // Step 3: Check contract state before calling function
  console.log("\n3️⃣ Checking contract state...");
  
  try {
    const isPaused = await (vaultContract as any).paused();
    console.log("Contract paused:", isPaused);
  } catch (error) {
    console.log("Could not check paused state:", error);
  }

  // Step 4: Call updatePendingWithdrawals
  console.log("\n4️⃣ Calling updatePendingWithdrawals...");

  try {
    // Try with a fixed high gas limit first
    const tx = await (vaultContract as any).connect(user).updatePendingWithdrawals({
      gasLimit: 500000, // Fixed high gas limit
    });

    console.log("Transaction sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("✅ Confirmed in block:", receipt.blockNumber);

    // Parse events from the transaction
    console.log("\n📝 Events emitted:");
    for (const log of receipt.logs) {
      try {
        const parsedLog = (vaultContract as any).interface.parseLog(log);
        if (parsedLog?.name === "WithdrawMarkedReady") {
          console.log(`- WithdrawMarkedReady: NFT ${parsedLog.args[0]}, Time: ${parsedLog.args[1]}`);
        } else if (parsedLog?.name === "DebugFunctionCalled") {
          console.log(`- DebugFunctionCalled: ${parsedLog.args[0]}`);
        } else if (parsedLog?.name === "DebugUpdateStart") {
          console.log(`- DebugUpdateStart: Balance ${ethers.formatUnits(parsedLog.args[0], 6)}, Reserved ${ethers.formatUnits(parsedLog.args[1], 6)}, Available ${ethers.formatUnits(parsedLog.args[2], 6)}`);
        } else if (parsedLog?.name === "DebugNFTProcessing") {
          console.log(`- DebugNFTProcessing: NFT ${parsedLog.args[0]}, Status ${parsedLog.args[1]}, Amount ${ethers.formatUnits(parsedLog.args[2], 6)}, CanProcess ${parsedLog.args[3]}`);
        } else if (parsedLog?.name === "DebugUpdateEnd") {
          console.log(`- DebugUpdateEnd: Processed ${parsedLog.args[0]} NFTs`);
        }
      } catch (e) {
        // Not a VaultContract event, skip
      }
    }

  } catch (error) {
    console.error("❌ Transaction failed:", error);
    return;
  }

  // Step 5: Check results after update
  console.log("\n5️⃣ Checking results after update:");
  
  let newPendingCount = 0;
  let newReadyCount = 0;
  let newTotalPendingAmount = 0n;

  for (let i = 1; i < currentTokenId; i++) {
    try {
      const owner = await withdrawNFT.ownerOf(i);
      const withdrawRequest = await vaultContract.withdrawRequests(i);
      
      const status = withdrawRequest.status;
      const amount = withdrawRequest.amount;
      const readyTime = withdrawRequest.readyTime;
      
      console.log(`NFT ${i}: Status ${status}, Amount: ${ethers.formatUnits(amount, 6)} USDT, ReadyTime: ${readyTime}, Owner: ${owner}`);
      
      if (Number(status) === 0) { // PENDING
        newPendingCount++;
        newTotalPendingAmount += BigInt(amount.toString());
      } else if (Number(status) === 1) { // READY
        newReadyCount++;
      }
    } catch (error) {
      // NFT doesn't exist (burned)
      console.log(`NFT ${i}: Burned or doesn't exist`);
    }
  }

  // Step 6: Show summary
  console.log("\n📊 Update Summary:");
  console.log(`Before: ${pendingCount} pending, ${readyCount} ready`);
  console.log(`After:  ${newPendingCount} pending, ${newReadyCount} ready`);
  console.log(`Withdrawals marked ready: ${newReadyCount - readyCount}`);
  console.log(`Pending amount reduced by: ${ethers.formatUnits(totalPendingAmount - newTotalPendingAmount, 6)} USDT`);
  
  if (newPendingCount < pendingCount) {
    console.log("✅ Some pending withdrawals were successfully marked as ready!");
  } else if (pendingCount === 0) {
    console.log("ℹ️  No pending withdrawals to process");
  } else {
    console.log("ℹ️  No withdrawals were marked ready (insufficient vault balance)");
  }

  console.log("\n✅ updatePendingWithdrawals test completed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });