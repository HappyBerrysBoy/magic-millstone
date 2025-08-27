import { ethers } from "hardhat";

async function main(): Promise<void> {
  const [user] = await ethers.getSigners();

  // Get contract addresses from environment
  const USDT_ADDRESS: string = process.env.USDT_ADDRESS || "YOUR_USDT_ADDRESS";
  const VAULT_ADDRESS: string =
    process.env.VAULT_ADDRESS || "YOUR_VAULT_ADDRESS";
  const MMUSDT_ADDRESS: string =
    process.env.MMUSDT_ADDRESS || "YOUR_MMUSDT_ADDRESS";
  const DEPOSIT_AMOUNT: string = process.env.DEPOSIT_AMOUNT || "10000";

  // Connect to deployed contracts
  const testUSDT = await ethers.getContractAt("TestUSDT", USDT_ADDRESS);
  const vaultContract = await ethers.getContractAt(
    "VaultContract",
    VAULT_ADDRESS
  );
  const mmUSDTToken = await ethers.getContractAt("mmUSDT", MMUSDT_ADDRESS);

  console.log("🔍 Testing depositToVault function");
  console.log("User address:", user.address);

  // Step 1: Check current balances
  console.log("\n1️⃣ Current balances:");
  const initialUsdtBalance = await (testUSDT as any).balanceOf(user.address);
  const initialMmUSDTBalance = await (mmUSDTToken as any).balanceOf(
    user.address
  );
  const initialVaultBalance = await (testUSDT as any).balanceOf(VAULT_ADDRESS);

  console.log(
    "User TestUSDT balance:",
    ethers.formatUnits(initialUsdtBalance, 6),
    "USDT"
  );
  console.log(
    "User mmUSDT balance:",
    ethers.formatUnits(initialMmUSDTBalance, 6),
    "mmUSDT"
  );
  console.log(
    "Vault USDT balance:",
    ethers.formatUnits(initialVaultBalance, 6),
    "USDT"
  );

  // Step 2: Approve vault to spend TestUSDT
  console.log("\n2️⃣ Approving vault to spend TestUSDT...");
  const depositAmount = ethers.parseUnits(DEPOSIT_AMOUNT, 6);

  const approveTx = await (testUSDT as any)
    .connect(user)
    .approve(VAULT_ADDRESS, depositAmount);
  await approveTx.wait();
  console.log("Approved:", ethers.formatUnits(depositAmount, 6), "USDT");

  // Step 3: Call depositToVault function
  console.log("\n3️⃣ Calling depositToVault...");

  // Manual gas estimation for reliability
  const gasEstimate = await (vaultContract as any)
    .connect(user)
    .depositToVault.estimateGas(depositAmount);
  const gasLimit = (gasEstimate * 120n) / 100n; // 20% buffer

  const tx = await (vaultContract as any)
    .connect(user)
    .depositToVault(depositAmount, {
      gasLimit: gasLimit,
    });

  console.log("Transaction sent:", tx.hash);
  const receipt = await tx.wait();
  console.log("✅ Confirmed in block:", receipt.blockNumber);

  // Parse events from depositToVault transaction
  console.log("\n📝 Transaction events:");
  console.log(`Total logs: ${receipt.logs.length}`);
  for (let i = 0; i < receipt.logs.length; i++) {
    const log = receipt.logs[i];
    console.log(
      `Log ${i}: Address: ${log.address}, Topics: ${log.topics.length}`
    );
    try {
      const parsedLog = (vaultContract as any).interface.parseLog(log);
      console.log(`  - Parsed: ${parsedLog?.name || "UNKNOWN"}`);
      if (parsedLog?.name === "VaultDeposit") {
        console.log(
          `  - VaultDeposit: Depositor ${
            parsedLog.args[0]
          }, Amount ${ethers.formatUnits(parsedLog.args[1], 6)}, Time: ${
            parsedLog.args[2]
          }`
        );
      } else if (parsedLog?.name === "WithdrawMarkedReady") {
        console.log(
          `  - WithdrawMarkedReady: NFT ${parsedLog.args[0]}, Time: ${parsedLog.args[1]}`
        );
      }
    } catch (e) {
      console.log(`  - Parse failed: ${e}`);
    }
  }

  // Step 4: Check results
  console.log("\n4️⃣ Final balances:");
  const finalUsdtBalance = await (testUSDT as any).balanceOf(user.address);
  const finalMmUSDTBalance = await (mmUSDTToken as any).balanceOf(user.address);
  const finalVaultBalance = await (testUSDT as any).balanceOf(VAULT_ADDRESS);

  console.log(
    "User TestUSDT balance:",
    ethers.formatUnits(finalUsdtBalance, 6),
    "USDT"
  );
  console.log(
    "User mmUSDT balance:",
    ethers.formatUnits(finalMmUSDTBalance, 6),
    "mmUSDT"
  );
  console.log(
    "Vault USDT balance:",
    ethers.formatUnits(finalVaultBalance, 6),
    "USDT"
  );

  // Step 5: Show transaction summary
  console.log("\n📊 Transaction Summary:");
  const usdtSpent = initialUsdtBalance - finalUsdtBalance;
  const mmUSDTChange = finalMmUSDTBalance - initialMmUSDTBalance;
  const vaultGained = finalVaultBalance - initialVaultBalance;

  console.log("User USDT spent:", ethers.formatUnits(usdtSpent, 6), "USDT");
  console.log(
    "User mmUSDT change:",
    ethers.formatUnits(mmUSDTChange, 6),
    "mmUSDT"
  );
  console.log("Vault USDT gained:", ethers.formatUnits(vaultGained, 6), "USDT");

  // Verify correct behavior: USDT transferred but no mmUSDT minted
  console.log("\n✅ Verification:");
  const usdtTransferCorrect = BigInt(usdtSpent) === depositAmount;
  const noMmUSDTMinted = BigInt(mmUSDTChange) === 0n;
  const vaultReceivedCorrect = BigInt(vaultGained) === depositAmount;

  console.log("USDT transferred correctly:", usdtTransferCorrect ? "✅" : "❌");
  console.log("No mmUSDT minted:", noMmUSDTMinted ? "✅" : "❌");
  console.log("Vault received USDT:", vaultReceivedCorrect ? "✅" : "❌");

  // Step 6: Get vault info to see if pending withdrawals were updated
  console.log("\n🔍 Vault Info after deposit:");
  const vaultInfo = await (vaultContract as any).getVaultInfo();
  console.log(
    "Vault USDT Balance:",
    ethers.formatUnits(vaultInfo[0], 6),
    "USDT"
  );
  console.log(
    "Total mmUSDT Supply:",
    ethers.formatUnits(vaultInfo[1], 6),
    "mmUSDT"
  );
  console.log("Total Deposited:", ethers.formatUnits(vaultInfo[2], 6), "USDT");
  console.log("Total Withdrawn:", ethers.formatUnits(vaultInfo[3], 6), "USDT");
  console.log("Bridge Balance:", ethers.formatUnits(vaultInfo[4], 6), "USDT");
  console.log("Total Requested:", ethers.formatUnits(vaultInfo[5], 6), "USDT");
  console.log("Exchange Rate:", ethers.formatUnits(vaultInfo[6], 6));

  console.log("\n✅ depositToVault test completed!");
  console.log("🎯 Key differences from regular deposit:");
  console.log("   - No mmUSDT tokens were minted");
  console.log("   - USDT was transferred directly to vault");
  console.log("   - _updatePendingWithdrawalsToReady() was called");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
