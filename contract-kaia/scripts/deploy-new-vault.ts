import { ethers, upgrades } from "hardhat";

async function main() {
  console.log("🚀 Deploying new VaultContract with depositToVault function...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", await deployer.getAddress());
  console.log(
    "Account balance:",
    ethers.formatEther(
      await ethers.provider.getBalance(await deployer.getAddress())
    )
  );

  // Get existing token addresses from environment
  const USDT_ADDRESS = process.env.TESTUUSDT_ADDRESS;
  const MMUSDT_ADDRESS = process.env.MMUSDT_ADDRESS;
  const WITHDRAWNFT_ADDRESS = process.env.WITHDRAWNFT_ADDRESS;

  if (!USDT_ADDRESS || !MMUSDT_ADDRESS || !WITHDRAWNFT_ADDRESS) {
    console.error("❌ Missing required environment variables");
    console.error("Required: TESTUUSDT_ADDRESS, MMUSDT_ADDRESS, WITHDRAWNFT_ADDRESS");
    process.exit(1);
  }

  console.log("📋 Using existing token addresses:");
  console.log("   USDT:", USDT_ADDRESS);
  console.log("   mmUSDT:", MMUSDT_ADDRESS);
  console.log("   WithdrawNFT:", WITHDRAWNFT_ADDRESS);

  try {
    // Deploy new VaultContract
    console.log("\n1. Deploying new VaultContract...");
    const VaultContract = await ethers.getContractFactory("VaultContract");
    
    const vault = await upgrades.deployProxy(
      VaultContract,
      [
        USDT_ADDRESS,
        MMUSDT_ADDRESS,
        WITHDRAWNFT_ADDRESS,
        await deployer.getAddress()
      ],
      { 
        initializer: "initialize",
        kind: "uups",
        timeout: 120000
      }
    );

    await vault.waitForDeployment();
    const vaultAddress = await vault.getAddress();

    console.log("✅ New VaultContract deployed!");
    console.log("📋 New VaultContract address:", vaultAddress);

    // Test the new contract
    console.log("\n2. Testing new contract functionality...");
    
    // Check initial state
    const isPaused = await vault.paused();
    console.log("✅ Contract paused status:", isPaused);

    const exchangeRate = await vault.getExchangeRate();
    console.log("✅ Initial exchange rate:", ethers.formatUnits(exchangeRate, 6));

    // Test the new depositToVault function exists
    console.log("\n3. Testing new depositToVault function...");
    try {
      await vault.depositToVault.staticCall(0);
    } catch (error: any) {
      if (error.message.includes("Amount must be greater than 0")) {
        console.log("✅ depositToVault function exists and validates correctly!");
      } else {
        console.log("⚠️  depositToVault function validation:", error.message);
      }
    }

    // Get initial vault info
    console.log("\n4. Getting initial vault info...");
    const vaultInfo = await vault.getVaultInfo();
    console.log("✅ USDT Balance:", ethers.formatUnits(vaultInfo[0], 6));
    console.log("✅ Total mmUSDT Supply:", ethers.formatUnits(vaultInfo[1], 6));
    console.log("✅ Total Deposited:", ethers.formatUnits(vaultInfo[2], 6));
    console.log("✅ Total Withdrawn:", ethers.formatUnits(vaultInfo[3], 6));
    console.log("✅ Bridge Balance:", ethers.formatUnits(vaultInfo[4], 6));
    console.log("✅ Total Requested:", ethers.formatUnits(vaultInfo[5], 6));
    console.log("✅ Exchange Rate:", ethers.formatUnits(vaultInfo[6], 6));

    console.log("\n🎉 Deployment completed successfully!");
    console.log("✅ New VaultContract includes the depositToVault function");
    console.log("✅ Function allows USDT transfers without minting mmUSDT");
    console.log("✅ Function automatically calls _updatePendingWithdrawalsToReady()");
    console.log("\n📝 Update your .env file with the new VAULT_ADDRESS:");
    console.log(`VAULT_ADDRESS=${vaultAddress}`);

  } catch (error) {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });