import { ethers } from "hardhat";

async function main() {
  console.log("🌟 Test Yield Exchange Rate (Users Earn Returns!)");

  const [admin] = await ethers.getSigners();
  const VAULT_ADDRESS = process.env.VAULT_ADDRESS;

  if (!VAULT_ADDRESS) {
    console.error("❌ Missing vault address");
    process.exit(1);
  }

  const vaultContract = await ethers.getContractAt(
    "VaultContract",
    VAULT_ADDRESS
  );

  console.log("\n📊 Current Exchange Rate:");
  const currentRate = await vaultContract.getExchangeRate();
  console.log("Current rate:", ethers.formatUnits(currentRate, 6));
  console.log("(1.0 = no yield, 1.1 = 10% yield, 1.2 = 20% yield)");

  // Show impact on existing withdrawals
  console.log("\n💰 Current Withdrawal Situation:");
  const vaultInfo = await vaultContract.getVaultInfo();
  const totalRequested = vaultInfo[5];
  const currentReserves =
    (Number(totalRequested) * Number(currentRate)) / 1000000;

  console.log(
    "Total mmUSDT requested:",
    ethers.formatUnits(totalRequested, 6),
    "mmUSDT"
  );
  console.log(
    "Required USDT reserves:",
    ethers.formatUnits(currentReserves, 6),
    "USDT"
  );
  console.log(
    "Vault USDT balance:",
    ethers.formatUnits(vaultInfo[0], 6),
    "USDT"
  );

  // Test setting a yield rate (1.1 = 10% yield for users)
  const newRate = ethers.parseUnits("1.2", 6); // 10% yield!

  console.log("\n🚀 Testing 10% Yield Rate (1.1):");
  console.log("New rate:", ethers.formatUnits(newRate, 6));

  const newReserves = (totalRequested * newRate) / BigInt(1000000);
  console.log(
    "Required USDT reserves:",
    ethers.formatUnits(newReserves, 6),
    "USDT"
  );

  const additionalReserves = Number(newReserves) - Number(currentReserves);
  console.log(
    "Additional reserves needed:",
    ethers.formatUnits(additionalReserves, 6),
    "USDT"
  );

  // Show impact on specific NFT
  console.log("\n🎫 Yield Impact on NFT #6 (50 mmUSDT request):");
  const nftRequest = await vaultContract.getWithdrawRequest(6);
  const currentPayout =
    (Number(nftRequest.amount) * Number(currentRate)) / 1000000;
  const newPayout = (Number(nftRequest.amount) * Number(newRate)) / 1000000;

  console.log("Without yield:", ethers.formatUnits(currentPayout, 6), "USDT");
  console.log("With 10% yield:", ethers.formatUnits(newPayout, 6), "USDT");
  console.log(
    "User gets extra:",
    ethers.formatUnits(newPayout - currentPayout, 6),
    "USDT yield! 🎉"
  );

  // Example: User journey
  console.log("\n👤 User Journey Example:");
  console.log("1. User deposits 50 USDT → gets 50 mmUSDT");
  console.log("2. Time passes, admin sets yield rate to 1.1 (10% yield)");
  console.log(
    "3. User withdraws 50 mmUSDT → gets",
    ethers.formatUnits(newPayout, 6),
    "USDT"
  );
  console.log(
    "4. User earned",
    ethers.formatUnits(newPayout - currentPayout, 6),
    "USDT profit! 💰"
  );

  // Actually set the new rate (comment out if you don't want to change it)
  try {
    console.log("\n⚙️ Setting 10% yield rate...");
    const tx = await vaultContract.setExchangeRate(newRate);
    console.log("Transaction sent:", tx.hash);

    const receipt = await tx.wait();
    console.log("✅ Yield rate updated in block:", receipt.blockNumber);

    // Verify the change
    const updatedRate = await vaultContract.getExchangeRate();
    console.log("Verified new rate:", ethers.formatUnits(updatedRate, 6));

    // Check new required reserves
    const maxTransferable = await vaultContract.getMaxTransferableAmount();
    console.log(
      "Max transferable after yield:",
      ethers.formatUnits(maxTransferable, 6),
      "USDT"
    );
  } catch (error: any) {
    console.log("❌ Failed to set yield rate:", error.message);
  }

  console.log("\n💡 Yield Mechanism:");
  console.log("• Exchange rate 1.0 = no yield for users");
  console.log("• Exchange rate 1.1 = 10% yield for users");
  console.log("• Higher rate = more USDT paid out per mmUSDT");
  console.log("• Users earn returns on their deposits! 🌟");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
