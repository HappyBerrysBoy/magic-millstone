import { ethers } from "hardhat";

async function main() {
  console.log("💰 Admin: Deposit USDT to Vault");

  const [admin] = await ethers.getSigners();
  console.log("Admin address:", admin.address);

  const VAULT_ADDRESS = process.env.VAULT_ADDRESS;
  const TESTUUSDT_ADDRESS = process.env.TESTUUSDT_ADDRESS;

  if (!VAULT_ADDRESS || !TESTUUSDT_ADDRESS) {
    console.error("❌ Missing contract addresses in environment");
    process.exit(1);
  }

  // Connect to contracts
  const vaultContract = await ethers.getContractAt(
    "VaultContract",
    VAULT_ADDRESS
  );
  const testUSDT = await ethers.getContractAt("TestUSDT", TESTUUSDT_ADDRESS);

  // Get deposit amount from environment or default to 100 USDT
  const depositAmount = process.env.ADMIN_DEPOSIT_AMOUNT
    ? ethers.parseUnits(process.env.ADMIN_DEPOSIT_AMOUNT, 6)
    : ethers.parseUnits("50", 6);

  console.log("\n📊 Initial Status:");
  const initialAdminBalance = await testUSDT.balanceOf(admin.address);
  const initialVaultBalance = await testUSDT.balanceOf(VAULT_ADDRESS);
  const vaultInfo = await vaultContract.getVaultInfo();

  console.log(
    "Admin USDT balance:",
    ethers.formatUnits(initialAdminBalance, 6),
    "USDT"
  );
  console.log(
    "Vault USDT balance:",
    ethers.formatUnits(initialVaultBalance, 6),
    "USDT"
  );
  console.log(
    "Total mmUSDT supply:",
    ethers.formatUnits(vaultInfo[1], 6),
    "mmUSDT"
  );
  console.log("Bridge balance:", ethers.formatUnits(vaultInfo[4], 6), "USDT");
  console.log("Total requested:", ethers.formatUnits(vaultInfo[5], 6), "USDT");
  console.log("Deposit amount:", ethers.formatUnits(depositAmount, 6), "USDT");

  try {
    // Step 1: Approve vault to spend admin's USDT
    console.log("\n1️⃣ Approving vault to spend USDT...");
    const approveTx = await testUSDT.approve(VAULT_ADDRESS, depositAmount);
    await approveTx.wait();
    console.log("✅ Approved");

    // Step 2: Admin deposit to vault
    console.log("\n2️⃣ Depositing USDT to vault...");
    const tx = await vaultContract.depositFromBridge(depositAmount);
    console.log("Transaction sent:", tx.hash);

    const receipt = await tx.wait();
    console.log("✅ Deposit completed in block:", receipt.blockNumber);

    // Check final balances
    console.log("\n📊 Final Status:");
    const finalAdminBalance = await testUSDT.balanceOf(admin.address);
    const finalVaultBalance = await testUSDT.balanceOf(VAULT_ADDRESS);
    const finalVaultInfo = await vaultContract.getVaultInfo();

    console.log(
      "Admin USDT balance:",
      ethers.formatUnits(finalAdminBalance, 6),
      "USDT"
    );
    console.log(
      "Vault USDT balance:",
      ethers.formatUnits(finalVaultBalance, 6),
      "USDT"
    );
    console.log(
      "Total mmUSDT supply:",
      ethers.formatUnits(finalVaultInfo[1], 6),
      "mmUSDT"
    );
    console.log(
      "Bridge balance:",
      ethers.formatUnits(finalVaultInfo[4], 6),
      "USDT"
    );

    const adminSpent = initialAdminBalance - finalAdminBalance;
    const vaultGained = finalVaultBalance - initialVaultBalance;
    const mmUSDTChange = finalVaultInfo[1] - vaultInfo[1];

    console.log("\n📈 Transaction Summary:");
    console.log("Admin spent:", ethers.formatUnits(adminSpent, 6), "USDT");
    console.log("Vault gained:", ethers.formatUnits(vaultGained, 6), "USDT");
    console.log(
      "mmUSDT supply change:",
      ethers.formatUnits(mmUSDTChange, 6),
      "mmUSDT"
    );
    console.log(
      "Transfer successful:",
      adminSpent === vaultGained ? "✅" : "❌"
    );
    console.log("No mmUSDT minted:", mmUSDTChange === 0 ? "✅" : "❌");

    const maxTransferable = await vaultContract.getMaxTransferableAmount();
    console.log(
      "New max transferable:",
      ethers.formatUnits(maxTransferable, 6),
      "USDT"
    );

    // Show if any withdrawals were auto-updated
    console.log("\n🔄 Auto-Update Results:");
    console.log("✅ PENDING withdrawals were automatically checked");
    console.log("✅ Eligible NFTs were marked as READY (if any)");
    console.log("💡 Check individual NFT statuses to see which ones updated");
  } catch (error: any) {
    console.log("❌ Deposit failed:", error.message);

    if (error.message.includes("Insufficient allowance")) {
      console.log("💡 Need to approve vault to spend USDT first");
    } else if (error.message.includes("Insufficient balance")) {
      console.log("💡 Admin doesn't have enough USDT");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
