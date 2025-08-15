import { ethers } from "hardhat";

async function main(): Promise<void> {
  const [user] = await ethers.getSigners();

  // Replace these with your deployed contract addresses
  const TESTUUSDT_ADDRESS: string =
    process.env.TESTUUSDT_ADDRESS || "YOUR_TESTUUSDT_ADDRESS";
  const VAULT_ADDRESS: string =
    process.env.VAULT_ADDRESS || "YOUR_VAULT_ADDRESS";
  const MMUSDT_ADDRESS: string =
    process.env.MMUSDT_ADDRESS || "YOUR_MMUSDT_ADDRESS";

  // Connect to deployed contracts
  const testUSDT = await ethers.getContractAt("TestUSDT", TESTUUSDT_ADDRESS);
  const vaultContract = await ethers.getContractAt("VaultContract", VAULT_ADDRESS);
  const mmUSDTToken = await ethers.getContractAt("mmUSDT", MMUSDT_ADDRESS);

  console.log("🔍 Testing TestUSDT → mmUSDT deposit");
  console.log("User address:", user.address);

  // Step 1: Check current balances
  console.log("\n1️⃣ Current balances:");
  const initialUsdtBalance = await (testUSDT as any).balanceOf(user.address);
  const initialMmUSDTBalance = await (mmUSDTToken as any).balanceOf(user.address);
  
  console.log("TestUSDT balance:", ethers.formatUnits(initialUsdtBalance, 6), "USDT");
  console.log("mmUSDT balance:", ethers.formatUnits(initialMmUSDTBalance, 6), "mmUSDT");

  // Step 2: Approve vault to spend TestUSDT
  console.log("\n2️⃣ Approving vault to spend TestUSDT...");
  const depositAmount = ethers.parseUnits("100", 6); // 100 USDT
  
  const approveTx = await (testUSDT as any).connect(user).approve(VAULT_ADDRESS, depositAmount);
  await approveTx.wait();
  console.log("Approved:", ethers.formatUnits(depositAmount, 6), "USDT");

  // Step 3: Deposit TestUSDT to get mmUSDT
  console.log("\n3️⃣ Depositing TestUSDT...");
  
  // Manual gas estimation for reliability
  const gasEstimate = await (vaultContract as any).connect(user).deposit.estimateGas(depositAmount);
  const gasLimit = (gasEstimate * 120n) / 100n; // 20% buffer

  const tx = await (vaultContract as any).connect(user).deposit(depositAmount, {
    gasLimit: gasLimit,
  });
  
  console.log("Transaction sent:", tx.hash);
  const receipt = await tx.wait();
  console.log("✅ Confirmed in block:", receipt.blockNumber);

  // Step 4: Check results
  console.log("\n4️⃣ Final balances:");
  const finalUsdtBalance = await (testUSDT as any).balanceOf(user.address);
  const finalMmUSDTBalance = await (mmUSDTToken as any).balanceOf(user.address);

  console.log("TestUSDT balance:", ethers.formatUnits(finalUsdtBalance, 6), "USDT");
  console.log("mmUSDT balance:", ethers.formatUnits(finalMmUSDTBalance, 6), "mmUSDT");

  // Step 5: Show transaction summary
  console.log("\n📊 Transaction Summary:");
  const usdtSpent = initialUsdtBalance - finalUsdtBalance;
  const mmUSDTGained = finalMmUSDTBalance - initialMmUSDTBalance;
  
  console.log("TestUSDT spent:", ethers.formatUnits(usdtSpent, 6), "USDT");
  console.log("mmUSDT received:", ethers.formatUnits(mmUSDTGained, 6), "mmUSDT");
  console.log("Exchange rate:", usdtSpent === mmUSDTGained ? "1:1 ✅" : "❌");

  // Step 6: Verify KIP compliance
  console.log("\n🔍 KIP Compliance:");
  const kipSupport = await (mmUSDTToken as any).supportsInterface("0x65787371");
  console.log("mmUSDT KIP-7 support:", kipSupport ? "✅" : "❌");

  console.log("\n✅ Deposit test completed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });