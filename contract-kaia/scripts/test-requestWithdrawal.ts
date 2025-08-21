import { ethers } from "hardhat";

async function main(): Promise<void> {
  const [user] = await ethers.getSigners();

  const VAULT_ADDRESS = process.env.VAULT_ADDRESS || "";
  const MMUSDT_ADDRESS = process.env.MMUSDT_ADDRESS || "";
  const WITHDRAWNFT_ADDRESS = process.env.WITHDRAWNFT_ADDRESS || "";

  console.log("🔄 User Withdrawal Request Process");
  console.log("User address:", user.address);

  // Connect to contracts
  const vaultContract = await ethers.getContractAt(
    "VaultContract",
    VAULT_ADDRESS
  );
  const mmUSDTToken = await ethers.getContractAt("mmUSDT", MMUSDT_ADDRESS);
  const withdrawNFT = await ethers.getContractAt(
    "WithdrawNFT",
    WITHDRAWNFT_ADDRESS
  );

  console.log("\n📊 Initial State:");

  // Check user's mmUSDT balance
  const mmUSDTBalance = await (mmUSDTToken as any).balanceOf(user.address);
  console.log(
    "mmUSDT balance:",
    ethers.formatUnits(mmUSDTBalance, 6),
    "mmUSDT"
  );

  // Check user's withdrawal NFT balance
  const nftBalance = await (withdrawNFT as any).balanceOf(user.address);
  console.log("Withdrawal NFT balance:", nftBalance.toString(), "NFTs");

  if (mmUSDTBalance <= 0n) {
    console.log(
      "❌ No mmUSDT to withdraw. Please deposit TestUSDT first to get mmUSDT."
    );
    return;
  }

  // Set withdrawal amount (default 50 mmUSDT or environment variable)
  const withdrawAmount = process.env.WITHDRAW_AMOUNT
    ? ethers.parseUnits(process.env.WITHDRAW_AMOUNT, 6)
    : ethers.parseUnits("10", 6);

  console.log(
    "Requested withdrawal amount:",
    ethers.formatUnits(withdrawAmount, 6),
    "mmUSDT"
  );

  // Check if user has enough mmUSDT
  if (mmUSDTBalance < withdrawAmount) {
    console.log("❌ Insufficient mmUSDT balance for withdrawal");
    console.log("💡 Reducing withdrawal amount to available balance");
    const actualWithdrawAmount = mmUSDTBalance;
    console.log(
      "Actual withdrawal amount:",
      ethers.formatUnits(actualWithdrawAmount, 6),
      "mmUSDT"
    );
  }

  const actualWithdrawAmount =
    mmUSDTBalance < withdrawAmount ? mmUSDTBalance : withdrawAmount;

  // Check minimum withdrawal requirement
  const MINIMUM_WITHDRAW = await (vaultContract as any).MINIMUM_WITHDRAW();
  console.log(
    "Minimum withdrawal:",
    ethers.formatUnits(MINIMUM_WITHDRAW, 6),
    "USDT"
  );

  if (actualWithdrawAmount < MINIMUM_WITHDRAW) {
    console.log("❌ Withdrawal amount below minimum requirement");
    return;
  }

  try {
    console.log("\n🔄 Requesting withdrawal...");

    // Manual gas estimation for reliability
    const gasEstimate = await (vaultContract as any)
      .connect(user)
      .requestWithdraw.estimateGas(actualWithdrawAmount);
    const gasLimit = (gasEstimate * 120n) / 100n; // 20% buffer

    // Request withdrawal - this burns mmUSDT and mints withdrawal NFT
    const tx = await (vaultContract as any)
      .connect(user)
      .requestWithdraw(actualWithdrawAmount, {
        gasLimit: gasLimit,
      });

    console.log("Transaction sent:", tx.hash);
    console.log("Waiting for confirmation...");

    const receipt = await tx.wait();
    console.log("✅ Transaction confirmed in block:", receipt.blockNumber);

    // Parse events to get NFT ID
    const withdrawRequestedEvent = receipt.logs.find((log: any) => {
      try {
        const parsed = vaultContract.interface.parseLog(log);
        return parsed?.name === "WithdrawRequested";
      } catch {
        return false;
      }
    });

    let nftId = null;
    if (withdrawRequestedEvent) {
      const parsed = vaultContract.interface.parseLog(withdrawRequestedEvent);
      nftId = parsed?.args[2]; // nftId is the 3rd argument
      console.log("🎫 Withdrawal NFT ID:", nftId.toString());
    }

    // Check post-withdrawal state
    console.log("\n📊 Post-Withdrawal State:");

    const newMmUSDTBalance = await (mmUSDTToken as any).balanceOf(user.address);
    const newNftBalance = await (withdrawNFT as any).balanceOf(user.address);

    console.log(
      "mmUSDT balance:",
      ethers.formatUnits(newMmUSDTBalance, 6),
      "mmUSDT"
    );
    console.log("Withdrawal NFT balance:", newNftBalance.toString(), "NFTs");

    const mmUSDTBurned = mmUSDTBalance - newMmUSDTBalance;
    const nftsMinted = newNftBalance - nftBalance;

    console.log("\n✅ Withdrawal Request Summary:");
    console.log(
      "mmUSDT burned:",
      ethers.formatUnits(mmUSDTBurned, 6),
      "mmUSDT"
    );
    console.log("Withdrawal NFTs minted:", nftsMinted.toString(), "NFTs");
    console.log(
      "Exchange successful:",
      mmUSDTBurned === actualWithdrawAmount && BigInt(nftsMinted) === BigInt(1)
        ? "✅"
        : "❌"
    );

    // Get withdrawal request details if we have the NFT ID
    if (nftId) {
      console.log("\n🎫 Withdrawal NFT Details:");
      try {
        const withdrawRequest = await (withdrawNFT as any).getWithdrawRequest(
          nftId
        );
        console.log(
          "Amount:",
          ethers.formatUnits(withdrawRequest.amount, 6),
          "USDT"
        );
        console.log(
          "Request time:",
          new Date(Number(withdrawRequest.requestTime) * 1000).toLocaleString()
        );
        console.log("Status:", ["PENDING", "READY"][withdrawRequest.status]);
        console.log("Requester:", withdrawRequest.requester);

        // Check NFT metadata
        const tokenURI = await (withdrawNFT as any).tokenURI(nftId);
        console.log("TokenURI:", tokenURI.substring(0, 100) + "...");

        // Verify KIP-17 compliance
        const kip17Support = await (withdrawNFT as any).supportsInterface(
          "0x80ac58cd"
        );
        console.log("KIP-17 compliant:", kip17Support ? "✅" : "❌");
      } catch (error) {
        console.log("Could not fetch NFT details:", (error as any).message);
      }
    }

    console.log("\n💡 Next Steps:");
    console.log("1. Wait for admin to mark your withdrawal as READY");
    console.log("2. Once READY, call executeWithdraw() to claim your USDT");
    console.log(
      "3. Your withdrawal NFT will be burned and you'll receive USDT"
    );
  } catch (error: any) {
    console.log("❌ Withdrawal request failed:", error.message);

    if (error.data) {
      console.log("Error data:", error.data);
    }

    // Common error scenarios
    if (error.message.includes("Insufficient mmUSDT balance")) {
      console.log("💡 You don't have enough mmUSDT for this withdrawal");
    } else if (error.message.includes("Amount too small")) {
      console.log("💡 Withdrawal amount is below minimum requirement");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
