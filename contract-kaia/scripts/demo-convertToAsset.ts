import { ethers } from "hardhat";

async function main() {
  console.log("🎯 Demonstrating convertToAsset functionality...");

  const [user] = await ethers.getSigners();
  console.log("Demo with account:", await user.getAddress());

  const MMUSDT_ADDRESS = process.env.MMUSDT_ADDRESS;
  const VAULT_ADDRESS = process.env.VAULT_ADDRESS;
  const TESTUUSDT_ADDRESS = process.env.TESTUUSDT_ADDRESS;

  if (!MMUSDT_ADDRESS || !VAULT_ADDRESS || !TESTUUSDT_ADDRESS) {
    console.error("❌ Contract addresses not set in .env");
    process.exit(1);
  }

  // Get contract instances
  const mmUSDT = await ethers.getContractAt("mmUSDT", MMUSDT_ADDRESS);
  const vault = await ethers.getContractAt("VaultContract", VAULT_ADDRESS);
  const testUSDT = await ethers.getContractAt("TestUSDT", TESTUUSDT_ADDRESS);

  console.log("\n📋 Contract Addresses:");
  console.log("mmUSDT:        ", MMUSDT_ADDRESS);
  console.log("VaultContract: ", VAULT_ADDRESS);
  console.log("TestUSDT:      ", TESTUUSDT_ADDRESS);

  try {
    // 1. Show current state
    console.log("\n1️⃣ Current State:");
    const exchangeRate = await vault.getExchangeRate();
    const userBalance = await mmUSDT.balanceOf(await user.getAddress());
    console.log("Exchange rate:      ", ethers.formatUnits(exchangeRate, 6));
    console.log(
      "User mmUSDT balance:",
      ethers.formatUnits(userBalance, 6),
      "mmUSDT"
    );

    // 2. Demonstrate conversion of specific amounts
    console.log("\n2️⃣ Converting Specific Amounts:");

    const amounts = [
      ethers.parseUnits("100", 6), // 100 mmUSDT
      ethers.parseUnits("1000", 6), // 1000 mmUSDT
      ethers.parseUnits("50.5", 6), // 50.5 mmUSDT
    ];

    for (const amount of amounts) {
      const assetValue = await mmUSDT["convertToAsset(uint256)"](amount);
      console.log(
        `convertToAsset(${ethers.formatUnits(
          amount,
          6
        )} mmUSDT) = ${ethers.formatUnits(assetValue, 6)} USDT`
      );
    }

    // 3. Show account balance conversion
    console.log("\n3️⃣ Account Balance Conversion:");
    const accountAssetValue = await mmUSDT["convertToAsset(address)"](
      await user.getAddress()
    );
    console.log("Raw balance:  ", ethers.formatUnits(userBalance, 6), "mmUSDT");
    console.log(
      "Asset value:  ",
      ethers.formatUnits(accountAssetValue, 6),
      "USDT"
    );

    // 4. If user has no balance, let's simulate by depositing some
    if (userBalance == 0n) {
      console.log("\n4️⃣ Simulating Deposit to Show Balance Conversion:");

      // Check TestUSDT balance and mint if needed
      const testUSDTBalance = await testUSDT.balanceOf(await user.getAddress());
      console.log("TestUSDT balance:", ethers.formatUnits(testUSDTBalance, 6));

      if (testUSDTBalance == 0n) {
        console.log("Minting TestUSDT for demo...");
        const mintTx = await testUSDT.mint(
          await user.getAddress(),
          ethers.parseUnits("1000", 6)
        );
        await mintTx.wait();
        console.log("✅ Minted 1000 TestUSDT");
      }

      // Approve and deposit to get mmUSDT
      const depositAmount = ethers.parseUnits("100", 6);
      console.log("Approving and depositing 100 USDT...");

      const approveTx = await testUSDT.approve(VAULT_ADDRESS, depositAmount);
      await approveTx.wait();

      const depositTx = await vault.deposit(depositAmount);
      await depositTx.wait();
      console.log("✅ Deposited 100 USDT, received mmUSDT");

      // Now show the conversion with actual balance
      const newBalance = await mmUSDT.balanceOf(await user.getAddress());
      const newAssetValue = await mmUSDT["convertToAsset(address)"](
        await user.getAddress()
      );

      console.log("\n📊 After Deposit:");
      console.log(
        "mmUSDT balance:",
        ethers.formatUnits(newBalance, 6),
        "mmUSDT"
      );
      console.log(
        "Asset value:   ",
        ethers.formatUnits(newAssetValue, 6),
        "USDT"
      );
      console.log(
        "Difference:    ",
        ethers.formatUnits(newAssetValue - newBalance, 6),
        "USDT"
      );
    }

    // 5. Test exchange rate changes
    console.log("\n5️⃣ Testing with Different Exchange Rates:");

    // Set a new exchange rate (admin function)
    const newExchangeRate = ethers.parseUnits("1.2", 6); // 1.2x
    console.log("Setting exchange rate to 1.2...");
    const setRateTx = await vault.setExchangeRate(newExchangeRate);
    await setRateTx.wait();

    // Test conversion with new rate
    const testAmount = ethers.parseUnits("100", 6);
    const newAssetValue = await mmUSDT["convertToAsset(uint256)"](testAmount);
    console.log(
      `convertToAsset(100 mmUSDT) with 1.2x rate = ${ethers.formatUnits(
        newAssetValue,
        6
      )} USDT`
    );

    console.log("\n🎉 convertToAsset Demo Complete!");
    console.log("\n📖 Summary:");
    console.log("✅ mmUSDT.balanceOf(account) - Gets raw mmUSDT balance");
    console.log(
      "✅ mmUSDT.convertToAsset(account) - Gets asset value (balance × exchange rate)"
    );
    console.log(
      "✅ mmUSDT.convertToAsset(amount) - Converts specific amount to asset value"
    );
    console.log("✅ Dynamic exchange rate from VaultContract");
    console.log("✅ No hardcoded addresses - fully configurable");
  } catch (error) {
    console.error("❌ Demo failed:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
