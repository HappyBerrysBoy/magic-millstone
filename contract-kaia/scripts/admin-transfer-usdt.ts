import { ethers } from "hardhat";

async function main() {
  console.log("🏦 Admin: Transfer USDT from Vault");

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

  // Get transfer amount and destination from environment
  const transferAmount = process.env.TRANSFER_AMOUNT
    ? ethers.parseUnits(process.env.TRANSFER_AMOUNT, 6)
    : ethers.parseUnits("1", 6);

  const destinationAddress = process.env.BRIDGE_DESTINATION_ADDRESS || "";

  console.log("\n📊 Initial Status:");
  const initialVaultBalance = await testUSDT.balanceOf(VAULT_ADDRESS);
  const initialDestBalance = await testUSDT.balanceOf(destinationAddress);
  const maxTransferable = await vaultContract.getMaxTransferableAmount();

  console.log(
    "Vault USDT balance:",
    ethers.formatUnits(initialVaultBalance, 6),
    "USDT"
  );
  console.log(
    "Destination balance:",
    ethers.formatUnits(initialDestBalance, 6),
    "USDT"
  );
  console.log(
    "Max transferable amount:",
    ethers.formatUnits(maxTransferable, 6),
    "USDT"
  );
  console.log(
    "Requested transfer amount:",
    ethers.formatUnits(transferAmount, 6),
    "USDT"
  );
  console.log("Destination address:", destinationAddress);

  try {
    console.log("\n🔄 Executing transfer...");

    const tx = await vaultContract.sendToBridge(
      destinationAddress,
      transferAmount
    );
    console.log("Transaction sent:", tx.hash);

    const receipt = await tx.wait();
    console.log("✅ Transfer completed in block:", receipt.blockNumber);

    // Check balances after transfer
    console.log("\n📊 Final Status:");
    const finalVaultBalance = await testUSDT.balanceOf(VAULT_ADDRESS);
    const finalDestBalance = await testUSDT.balanceOf(destinationAddress);

    console.log(
      "Vault USDT balance:",
      ethers.formatUnits(finalVaultBalance, 6),
      "USDT"
    );
    console.log(
      "Destination USDT balance:",
      ethers.formatUnits(finalDestBalance, 6),
      "USDT"
    );

    const transferredAmount = initialVaultBalance - finalVaultBalance;
    const receivedAmount = finalDestBalance - initialDestBalance;

    console.log("\n📈 Transaction Summary:");
    console.log(
      "Amount transferred from vault:",
      ethers.formatUnits(transferredAmount, 6),
      "USDT"
    );
    console.log(
      "Amount received by destination:",
      ethers.formatUnits(receivedAmount, 6),
      "USDT"
    );
    console.log(
      "Transfer successful:",
      transferredAmount === receivedAmount ? "✅" : "❌"
    );
  } catch (error: any) {
    console.log("❌ Transfer failed:", error.message);

    if (
      error.message.includes("Cannot transfer more than available reserves")
    ) {
      console.log(
        "💡 The contract prevented the transfer to protect user reserves"
      );
      console.log(
        "   This means there are pending withdrawals that require reserves"
      );
    } else if (error.message.includes("Insufficient balance")) {
      console.log("💡 Not enough USDT in the vault for this transfer");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
