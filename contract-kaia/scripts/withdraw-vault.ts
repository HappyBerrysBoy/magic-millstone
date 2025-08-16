import { ethers } from "hardhat";

async function main(): Promise<void> {
  const [admin] = await ethers.getSigners();

  const VAULT_ADDRESS = process.env.VAULT_ADDRESS || "";
  const TESTUUSDT_ADDRESS = process.env.TESTUUSDT_ADDRESS || "";

  console.log("🔧 Admin USDT Withdrawal from Vault");
  console.log("Admin address:", admin.address);
  console.log("Vault address:", VAULT_ADDRESS);

  // Connect to contracts
  const vaultContract = await ethers.getContractAt(
    "VaultContract",
    VAULT_ADDRESS
  );
  const testUSDT = await ethers.getContractAt("TestUSDT", TESTUUSDT_ADDRESS);

  console.log("\n📊 Current Vault Status:");

  // Check vault USDT balance
  const vaultUSDTBalance = await (testUSDT as any).balanceOf(VAULT_ADDRESS);
  console.log(
    "Vault USDT balance:",
    ethers.formatUnits(vaultUSDTBalance, 6),
    "USDT"
  );

  // Check admin's current USDT balance
  const adminUSDTBalance = await (testUSDT as any).balanceOf(admin.address);
  console.log(
    "Admin USDT balance:",
    ethers.formatUnits(adminUSDTBalance, 6),
    "USDT"
  );

  // Get vault info
  const [
    usdtBalance,
    totalMmUSDTSupply,
    totalDeposited,
    totalWithdrawn,
    bridgeBalance,
  ] = await (vaultContract as any).getVaultInfo();

  console.log(
    "Total deposited:",
    ethers.formatUnits(totalDeposited, 6),
    "USDT"
  );
  console.log(
    "Total withdrawn:",
    ethers.formatUnits(totalWithdrawn, 6),
    "USDT"
  );
  console.log("Bridge balance:", ethers.formatUnits(bridgeBalance, 6), "USDT");

  // Check admin role
  const ADMIN_ROLE = await (vaultContract as any).ADMIN_ROLE();
  const hasAdminRole = await (vaultContract as any).hasRole(
    ADMIN_ROLE,
    admin.address
  );
  console.log("Admin has ADMIN_ROLE:", hasAdminRole ? "✅" : "❌");

  if (!hasAdminRole) {
    console.log(
      "❌ Admin does not have ADMIN_ROLE. Cannot proceed with withdrawal."
    );
    return;
  }

  if (vaultUSDTBalance <= 0n) {
    console.log("❌ No USDT in vault to withdraw.");
    return;
  }

  // Withdraw options
  console.log("\n🎛️ Withdrawal Options:");
  console.log("1. transferToBridge() - Normal bridge transfer");
  console.log("2. emergencyWithdraw() - Emergency withdrawal");

  // Get withdrawal method from environment or default to bridge transfer
  const withdrawalMethod = process.env.WITHDRAWAL_METHOD || "bridge";
  const withdrawAmount = process.env.WITHDRAW_AMOUNT
    ? ethers.parseUnits(process.env.WITHDRAW_AMOUNT, 6)
    : ethers.parseUnits("50", 6); // Default 50 USDT

  console.log(`\n🔄 Using method: ${withdrawalMethod}`);
  console.log(
    "Withdrawal amount:",
    ethers.formatUnits(withdrawAmount, 6),
    "USDT"
  );

  // Ensure we don't withdraw more than available
  const actualWithdrawAmount =
    withdrawAmount > vaultUSDTBalance ? vaultUSDTBalance : withdrawAmount;

  if (actualWithdrawAmount !== withdrawAmount) {
    console.log(
      "⚠️ Adjusting withdrawal to available balance:",
      ethers.formatUnits(actualWithdrawAmount, 6),
      "USDT"
    );
  }

  try {
    let tx;

    if (withdrawalMethod === "emergency") {
      console.log("\n🚨 Executing emergency withdrawal...");
      // Using emergencyWithdraw function
      tx = await (vaultContract as any)
        .connect(admin)
        .emergencyWithdraw(TESTUUSDT_ADDRESS, actualWithdrawAmount);
    } else {
      console.log("\n🌉 Executing bridge transfer...");
      // Using transferToBridge function
      tx = await (vaultContract as any)
        .connect(admin)
        .transferToBridge(actualWithdrawAmount);
    }

    console.log("Transaction sent:", tx.hash);
    console.log("Waiting for confirmation...");

    const receipt = await tx.wait();
    console.log("✅ Transaction confirmed in block:", receipt.blockNumber);

    // Check results
    console.log("\n📊 Post-Withdrawal Status:");

    const newVaultUSDTBalance = await (testUSDT as any).balanceOf(
      VAULT_ADDRESS
    );
    const newAdminUSDTBalance = await (testUSDT as any).balanceOf(
      admin.address
    );

    console.log(
      "Vault USDT balance:",
      ethers.formatUnits(newVaultUSDTBalance, 6),
      "USDT"
    );
    console.log(
      "Admin USDT balance:",
      ethers.formatUnits(newAdminUSDTBalance, 6),
      "USDT"
    );

    const usdtWithdrawn = vaultUSDTBalance - newVaultUSDTBalance;
    const adminUSDTGained = newAdminUSDTBalance - adminUSDTBalance;

    console.log("\n✅ Withdrawal Summary:");
    console.log(
      "USDT withdrawn from vault:",
      ethers.formatUnits(usdtWithdrawn, 6),
      "USDT"
    );
    console.log(
      "USDT received by admin:",
      ethers.formatUnits(adminUSDTGained, 6),
      "USDT"
    );
    console.log(
      "Transfer successful:",
      usdtWithdrawn === adminUSDTGained ? "✅" : "❌"
    );

    if (withdrawalMethod === "bridge") {
      const [, , , , newBridgeBalance] = await (
        vaultContract as any
      ).getVaultInfo();
      console.log(
        "New bridge balance:",
        ethers.formatUnits(newBridgeBalance, 6),
        "USDT"
      );
    }
  } catch (error: any) {
    console.log("❌ Withdrawal failed:", error.message);

    if (error.data) {
      console.log("Error data:", error.data);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
