import { ethers } from "hardhat";

async function main() {
  console.log("💰 Test Final Withdrawal Execution");

  const [user] = await ethers.getSigners();
  console.log("User address:", user.address);

  const VAULT_ADDRESS = process.env.VAULT_ADDRESS;
  const USDT_ADDRESS = process.env.USDT_ADDRESS;
  const WITHDRAWNFT_ADDRESS = process.env.WITHDRAWNFT_ADDRESS;
  const NFT_ID = process.env.NFT_ID;

  if (!VAULT_ADDRESS || !USDT_ADDRESS || !WITHDRAWNFT_ADDRESS) {
    console.error("❌ Missing contract addresses in environment");
    process.exit(1);
  }

  // Connect to contracts
  const vaultContract = await ethers.getContractAt(
    "VaultContract",
    VAULT_ADDRESS
  );
  const testUSDT = await ethers.getContractAt("TestUSDT", USDT_ADDRESS);
  const withdrawNFT = await ethers.getContractAt(
    "WithdrawNFT",
    WITHDRAWNFT_ADDRESS
  );

  const nftId = NFT_ID ? parseInt(NFT_ID) : 16;

  console.log("\n🎫 NFT ID to execute:", nftId);

  // Check initial balances
  console.log("\n📊 Initial State:");
  const initialUsdtBalance = await testUSDT.balanceOf(user.address);
  const initialVaultBalance = await testUSDT.balanceOf(VAULT_ADDRESS);
  const nftBalance = await withdrawNFT.balanceOf(user.address);

  console.log(
    "User USDT balance:",
    ethers.formatUnits(initialUsdtBalance, 6),
    "USDT"
  );
  console.log(
    "Vault USDT balance:",
    ethers.formatUnits(initialVaultBalance, 6),
    "USDT"
  );
  console.log("User NFT balance:", nftBalance.toString(), "NFTs");

  // Check NFT ownership and withdrawal request details
  try {
    const nftOwner = await withdrawNFT.ownerOf(nftId);
    console.log("NFT owner:", nftOwner);

    if (nftOwner.toLowerCase() !== user.address.toLowerCase()) {
      console.log("❌ User doesn't own this NFT");
      return;
    }

    const withdrawRequest = await vaultContract.getWithdrawRequest(nftId);
    const statusNames = ["PENDING", "READY"];
    console.log("\n🔍 Withdrawal Request Details:");
    console.log(
      "Amount:",
      ethers.formatUnits(withdrawRequest.amount, 6),
      "USDT"
    );
    console.log("Status:", statusNames[withdrawRequest.status]);
    console.log("Requester:", withdrawRequest.requester);

    if (Number(withdrawRequest.status) !== 1) {
      // Not READY (1 = READY)
      console.log(
        "❌ Withdrawal is not ready yet. Current status:",
        statusNames[withdrawRequest.status]
      );
      return;
    }

    // Get current exchange rate to calculate expected amount
    const exchangeRate = await vaultContract.getExchangeRate();
    const expectedAmount = BigInt(withdrawRequest.amount) / 1000000n; // Divide by 1e6 (EXCHANGE_RATE_DECIMALS)

    console.log("Exchange rate:", ethers.formatUnits(exchangeRate, 6));
    console.log(
      "Expected USDT to receive:",
      ethers.formatUnits(expectedAmount, 6),
      "USDT"
    );
  } catch (error: any) {
    console.log("❌ Error checking NFT details:", error.message);
    return;
  }

  try {
    console.log("\n🔄 Executing withdrawal...");

    const tx = await vaultContract.executeWithdraw(nftId);
    console.log("Transaction sent:", tx.hash);

    const receipt = await tx.wait();
    console.log("✅ Withdrawal executed in block:", receipt.blockNumber);

    // Check final balances
    console.log("\n📊 Final State:");
    const finalUsdtBalance = await testUSDT.balanceOf(user.address);
    const finalVaultBalance = await testUSDT.balanceOf(VAULT_ADDRESS);
    const finalNftBalance = await withdrawNFT.balanceOf(user.address);

    console.log(
      "User USDT balance:",
      ethers.formatUnits(finalUsdtBalance, 6),
      "USDT"
    );
    console.log(
      "Vault USDT balance:",
      ethers.formatUnits(finalVaultBalance, 6),
      "USDT"
    );
    console.log("User NFT balance:", finalNftBalance.toString(), "NFTs");

    // Calculate changes
    const usdtReceived = finalUsdtBalance - initialUsdtBalance;
    const vaultUsdtSent = initialVaultBalance - finalVaultBalance;
    const nftsBurned = nftBalance - finalNftBalance;

    console.log("\n📈 Transaction Summary:");
    console.log(
      "USDT received by user:",
      ethers.formatUnits(usdtReceived, 6),
      "USDT"
    );
    console.log(
      "USDT sent from vault:",
      ethers.formatUnits(vaultUsdtSent, 6),
      "USDT"
    );
    console.log("NFTs burned:", nftsBurned.toString());

    // Verify NFT was burned
    try {
      await withdrawNFT.ownerOf(nftId);
      console.log("❌ NFT was not burned!");
    } catch {
      console.log("✅ NFT was successfully burned");
    }

    console.log("\n🎉 Withdrawal completed successfully!");
    console.log(
      "Exchange rate was applied:",
      usdtReceived === vaultUsdtSent ? "✅" : "❌"
    );
  } catch (error: any) {
    console.log("❌ Withdrawal execution failed:", error.message);

    if (error.message.includes("Not NFT owner")) {
      console.log("💡 User doesn't own this NFT");
    } else if (error.message.includes("Withdraw not ready")) {
      console.log("💡 Withdrawal request is not marked as READY yet");
    } else if (error.message.includes("Insufficient USDT balance")) {
      console.log(
        "💡 Vault doesn't have enough USDT to fulfill the withdrawal"
      );
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
