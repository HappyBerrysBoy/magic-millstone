import { ethers } from "hardhat";

async function main(): Promise<void> {
  console.log("🔍 Verifying Magic Millstone Protocol Deployment");
  console.log("=".repeat(80));

  // Get addresses from environment
  const addresses = {
    USDT_ADDRESS: process.env.USDT_ADDRESS,
    MMUSDT_ADDRESS: process.env.MMUSDT_ADDRESS,
    WITHDRAWNFT_ADDRESS: process.env.WITHDRAWNFT_ADDRESS,
    VAULT_ADDRESS: process.env.VAULT_ADDRESS,
  };

  // Check if all addresses are provided
  const missingAddresses = Object.entries(addresses).filter(([, address]) => !address);
  if (missingAddresses.length > 0) {
    console.error("❌ Missing addresses in .env:");
    missingAddresses.forEach(([name]) => console.error(`  - ${name}`));
    process.exit(1);
  }

  console.log("📋 Contract Addresses:");
  Object.entries(addresses).forEach(([name, address]) => {
    console.log(`${name}: ${address}`);
  });

  try {
    // Connect to contracts
    const testUSDT = await ethers.getContractAt("TestUSDT", addresses.USDT_ADDRESS!);
    const mmUSDT = await ethers.getContractAt("mmUSDT", addresses.MMUSDT_ADDRESS!);
    const withdrawNFT = await ethers.getContractAt("WithdrawNFT", addresses.WITHDRAWNFT_ADDRESS!);
    const vaultContract = await ethers.getContractAt("VaultContract", addresses.VAULT_ADDRESS!);

    console.log("\n🔧 Checking Contract Connections...");

    // Check VaultContract connections
    const vaultUsdtAddress = await vaultContract.usdt();
    const vaultMmUsdtAddress = await vaultContract.mmUSDT();
    const vaultWithdrawNftAddress = await vaultContract.withdrawNFT();

    console.log("VaultContract → USDT:", vaultUsdtAddress === addresses.USDT_ADDRESS ? "✅" : `❌ Expected: ${addresses.USDT_ADDRESS}, Got: ${vaultUsdtAddress}`);
    console.log("VaultContract → mmUSDT:", vaultMmUsdtAddress === addresses.MMUSDT_ADDRESS ? "✅" : `❌ Expected: ${addresses.MMUSDT_ADDRESS}, Got: ${vaultMmUsdtAddress}`);
    console.log("VaultContract → WithdrawNFT:", vaultWithdrawNftAddress === addresses.WITHDRAWNFT_ADDRESS ? "✅" : `❌ Expected: ${addresses.WITHDRAWNFT_ADDRESS}, Got: ${vaultWithdrawNftAddress}`);

    // Check WithdrawNFT vault address
    const nftVaultAddress = await withdrawNFT.vaultContract();
    console.log("WithdrawNFT → VaultContract:", nftVaultAddress === addresses.VAULT_ADDRESS ? "✅" : `❌ Expected: ${addresses.VAULT_ADDRESS}, Got: ${nftVaultAddress}`);

    console.log("\n🔑 Checking Role Permissions...");

    // Check mmUSDT roles
    const minterRole = await mmUSDT.MINTER_ROLE();
    const burnerRole = await mmUSDT.BURNER_ROLE();
    const defaultAdminRole = await mmUSDT.DEFAULT_ADMIN_ROLE();

    const mmUsdtHasMinter = await mmUSDT.hasRole(minterRole, addresses.VAULT_ADDRESS!);
    const mmUsdtHasBurner = await mmUSDT.hasRole(burnerRole, addresses.VAULT_ADDRESS!);

    console.log("mmUSDT MINTER_ROLE for VaultContract:", mmUsdtHasMinter ? "✅" : "❌");
    console.log("mmUSDT BURNER_ROLE for VaultContract:", mmUsdtHasBurner ? "✅" : "❌");

    // Check WithdrawNFT roles
    const nftMinterRole = await withdrawNFT.MINTER_ROLE();
    const nftBurnerRole = await withdrawNFT.BURNER_ROLE();

    const nftHasMinter = await withdrawNFT.hasRole(nftMinterRole, addresses.VAULT_ADDRESS!);
    const nftHasBurner = await withdrawNFT.hasRole(nftBurnerRole, addresses.VAULT_ADDRESS!);

    console.log("WithdrawNFT MINTER_ROLE for VaultContract:", nftHasMinter ? "✅" : "❌");
    console.log("WithdrawNFT BURNER_ROLE for VaultContract:", nftHasBurner ? "✅" : "❌");

    console.log("\n⚙️ Checking Contract States...");

    // Check if contracts are paused
    const mmUsdtPaused = await mmUSDT.paused();
    const withdrawNftPaused = await withdrawNFT.paused();
    const vaultPaused = await vaultContract.paused();

    console.log("mmUSDT paused:", mmUsdtPaused ? "❌ PAUSED" : "✅ ACTIVE");
    console.log("WithdrawNFT paused:", withdrawNftPaused ? "❌ PAUSED" : "✅ ACTIVE");
    console.log("VaultContract paused:", vaultPaused ? "❌ PAUSED" : "✅ ACTIVE");

    // Check exchange rate
    const exchangeRate = await vaultContract.getExchangeRate();
    console.log("Exchange rate:", ethers.formatUnits(exchangeRate, 6), "(1.0 = no yield, >1.0 = yield for users)");

    console.log("\n📊 Testing Core Functions...");

    // Test getWithdrawRequestFromVault function
    try {
      // This should fail gracefully for non-existent NFT
      await withdrawNFT.getWithdrawRequestFromVault(999);
      console.log("WithdrawNFT.getWithdrawRequestFromVault():", "✅ ACCESSIBLE");
    } catch (error) {
      // Expected to fail for non-existent NFT, but function should be callable
      if (error instanceof Error && error.message.includes("Invalid NFT ID")) {
        console.log("WithdrawNFT.getWithdrawRequestFromVault():", "✅ WORKING (expected error for non-existent NFT)");
      } else {
        console.log("WithdrawNFT.getWithdrawRequestFromVault():", "❌ UNEXPECTED ERROR:", error);
      }
    }

    console.log("\n" + "=".repeat(80));

    // Summary
    const allConnectionsGood = 
      vaultUsdtAddress === addresses.USDT_ADDRESS &&
      vaultMmUsdtAddress === addresses.MMUSDT_ADDRESS &&
      vaultWithdrawNftAddress === addresses.WITHDRAWNFT_ADDRESS &&
      nftVaultAddress === addresses.VAULT_ADDRESS;

    const allRolesGood = mmUsdtHasMinter && mmUsdtHasBurner && nftHasMinter && nftHasBurner;
    const allActiveStates = !mmUsdtPaused && !withdrawNftPaused && !vaultPaused;

    if (allConnectionsGood && allRolesGood && allActiveStates) {
      console.log("🎉 ALL CHECKS PASSED! Deployment is correctly configured.");
    } else {
      console.log("❌ ISSUES DETECTED:");
      if (!allConnectionsGood) console.log("  - Contract connections have issues");
      if (!allRolesGood) console.log("  - Role permissions have issues");
      if (!allActiveStates) console.log("  - Some contracts are paused");
    }

    console.log("\n💡 Quick Start Commands:");
    console.log("# Test deposit:");
    console.log("npx hardhat run scripts/test-deposit.ts --network <network>");
    console.log("# Test withdrawal:");
    console.log("npx hardhat run scripts/test-requestWithdraw.ts --network <network>");

  } catch (error) {
    console.error("❌ Verification failed:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });