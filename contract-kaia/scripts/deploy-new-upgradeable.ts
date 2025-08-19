import { ethers, upgrades } from "hardhat";

async function main() {
  console.log("🚀 Deploying new upgradeable system with convertToAsset...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", await deployer.getAddress());
  console.log(
    "Account balance:",
    ethers.formatEther(
      await ethers.provider.getBalance(await deployer.getAddress())
    )
  );

  const contracts: any = {};

  // Use existing TestUSDT
  const EXISTING_TESTUUSDT = process.env.TESTUUSDT_ADDRESS;
  if (!EXISTING_TESTUUSDT) {
    console.error("❌ TESTUUSDT_ADDRESS not set in environment variables");
    process.exit(1);
  }
  contracts.testUSDT = EXISTING_TESTUUSDT;
  console.log("📋 Using existing TestUSDT:", contracts.testUSDT);

  try {
    // 1. Deploy new mmUSDT with convertToAsset (upgradeable)
    console.log("\n1. Deploying new mmUSDT with convertToAsset (upgradeable)...");
    const mmUSDTFactory = await ethers.getContractFactory("mmUSDT");
    const mmUSDTToken = await upgrades.deployProxy(
      mmUSDTFactory,
      ["Magic Millstone USDT v2", "mmUSDT", 6, await deployer.getAddress()],
      {
        initializer: "initialize",
        kind: "uups",
        timeout: 120000, // 2 minutes timeout
        unsafeAllow: ['constructor']
      }
    );
    await mmUSDTToken.waitForDeployment();
    contracts.mmUSDT = await mmUSDTToken.getAddress();
    console.log("✅ New mmUSDT proxy deployed to:", contracts.mmUSDT);

    // 2. Deploy new WithdrawNFT (upgradeable) - temporarily with zero address, will update after VaultContract
    console.log("\n2. Deploying new WithdrawNFT (upgradeable)...");
    const WithdrawNFTFactory = await ethers.getContractFactory("WithdrawNFT");
    const withdrawNFT = await upgrades.deployProxy(
      WithdrawNFTFactory,
      ["Withdraw Request NFT v2", "wNFT", await deployer.getAddress(), ethers.ZeroAddress],
      {
        initializer: "initialize",
        kind: "uups",
        timeout: 120000,
        unsafeAllow: ['constructor']
      }
    );
    await withdrawNFT.waitForDeployment();
    contracts.withdrawNFT = await withdrawNFT.getAddress();
    console.log("✅ New WithdrawNFT proxy deployed to:", contracts.withdrawNFT);

    // 3. Deploy new VaultContract (upgradeable)
    console.log("\n3. Deploying new VaultContract (upgradeable)...");
    const VaultContractFactory = await ethers.getContractFactory("VaultContract");
    const vaultContract = await upgrades.deployProxy(
      VaultContractFactory,
      [
        contracts.testUSDT,
        contracts.mmUSDT,
        contracts.withdrawNFT,
        await deployer.getAddress(),
      ],
      {
        initializer: "initialize", 
        kind: "uups",
        timeout: 120000,
        unsafeAllow: ['constructor']
      }
    );
    await vaultContract.waitForDeployment();
    contracts.vaultContract = await vaultContract.getAddress();
    console.log("✅ New VaultContract proxy deployed to:", contracts.vaultContract);

    // 4. Configure mmUSDT with vault contract and update WithdrawNFT vault
    console.log("\n4. Configuring contracts with vault contract...");
    
    // Set vault in mmUSDT  
    const setVaultTx = await mmUSDTToken.setVaultContract(contracts.vaultContract);
    await setVaultTx.wait();
    console.log("✅ Vault contract set in mmUSDT");

    // Update vault in WithdrawNFT (since it was initialized with zero address)
    const updateNFTVaultTx = await withdrawNFT.updateVaultContract(contracts.vaultContract);
    await updateNFTVaultTx.wait();
    console.log("✅ Vault contract updated in WithdrawNFT");

    // Verify vault addresses are set
    const mmUSDTVaultAddr = await mmUSDTToken.getVaultContract();
    const nftVaultAddr = await withdrawNFT.vaultContract();
    console.log("✅ Verified mmUSDT vault address:", mmUSDTVaultAddr);
    console.log("✅ Verified WithdrawNFT vault address:", nftVaultAddr);

    // 5. Setup roles and permissions
    console.log("\n5. Setting up roles and permissions...");

    // Grant roles to VaultContract for mmUSDT
    const MINTER_ROLE = await mmUSDTToken.MINTER_ROLE();
    const BURNER_ROLE = await mmUSDTToken.BURNER_ROLE();

    console.log("Granting MINTER_ROLE to VaultContract...");
    await mmUSDTToken.grantRole(MINTER_ROLE, contracts.vaultContract);

    console.log("Granting BURNER_ROLE to VaultContract...");
    await mmUSDTToken.grantRole(BURNER_ROLE, contracts.vaultContract);

    // Grant roles to VaultContract for WithdrawNFT
    const NFT_MINTER_ROLE = await withdrawNFT.MINTER_ROLE();
    const NFT_BURNER_ROLE = await withdrawNFT.BURNER_ROLE();

    console.log("Granting NFT MINTER_ROLE to VaultContract...");
    await withdrawNFT.grantRole(NFT_MINTER_ROLE, contracts.vaultContract);

    console.log("Granting NFT BURNER_ROLE to VaultContract...");
    await withdrawNFT.grantRole(NFT_BURNER_ROLE, contracts.vaultContract);

    // 6. Test the new convertToAsset functionality
    console.log("\n6. Testing convertToAsset functionality...");
    
    // Get exchange rate from vault
    const exchangeRate = await vaultContract.getExchangeRate();
    console.log("✅ Current exchange rate:", ethers.formatUnits(exchangeRate, 6));

    // Test basic conversion with specific function signature
    const testAmount = ethers.parseUnits("100", 6);
    const assetValue = await mmUSDTToken["convertToAsset(uint256)"](testAmount);
    console.log("✅ convertToAsset(100 mmUSDT):", ethers.formatUnits(assetValue, 6), "USDT");

    // Test account conversion (should be 0 since no balance) 
    const accountValue = await mmUSDTToken["convertToAsset(address)"](await deployer.getAddress());
    console.log("✅ convertToAsset(account):", ethers.formatUnits(accountValue, 6), "USDT");

    console.log("\n✅ Deployment completed successfully!");
    console.log("\n📋 New Upgradeable Contract Addresses:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("TestUSDT:      ", contracts.testUSDT, "(existing)");
    console.log("mmUSDT:        ", contracts.mmUSDT, "(NEW upgradeable with convertToAsset)");
    console.log("WithdrawNFT:   ", contracts.withdrawNFT, "(NEW upgradeable)");
    console.log("VaultContract: ", contracts.vaultContract, "(NEW upgradeable)");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    console.log("\n🎉 New Features Available:");
    console.log("✅ mmUSDT.convertToAsset(uint256) - Convert amount to asset value");
    console.log("✅ mmUSDT.convertToAsset(address) - Convert account balance to asset value");
    console.log("✅ mmUSDT.getVaultContract() - Get configured vault address");
    console.log("✅ All contracts are upgradeable (UUPS pattern)");
    console.log("✅ No hardcoded addresses - fully configurable");

    console.log("\n🔧 Usage Examples:");
    console.log("// Get raw balance");
    console.log("uint256 balance = mmUSDT.balanceOf(account);");
    console.log("// Get asset value (balance × exchange rate)");
    console.log("uint256 assetValue = mmUSDT.convertToAsset(account);");

    // Save deployment info
    const deploymentInfo = {
      network: "kairos",
      deployer: await deployer.getAddress(),
      timestamp: new Date().toISOString(),
      contracts: contracts,
      features: ["convertToAsset", "upgradeable", "configurable vault", "no hardcoded addresses"]
    };

    console.log("\n💾 Deployment Info:");
    console.log(JSON.stringify(deploymentInfo, null, 2));

    console.log("\n📝 Update your .env file:");
    console.log(`MMUSDT_ADDRESS=${contracts.mmUSDT}`);
    console.log(`VAULT_ADDRESS=${contracts.vaultContract}`);
    console.log(`WITHDRAWNFT_ADDRESS=${contracts.withdrawNFT}`);

  } catch (error) {
    console.error("❌ Deployment failed:", error);
    
    if ((error as any).message?.includes("web3_clientVersion")) {
      console.log("\n💡 This appears to be a provider compatibility issue.");
      console.log("The contracts are still upgradeable, but there might be issues with OpenZeppelin's network detection.");
      console.log("You can try deploying with different network settings or use a different RPC endpoint.");
    }
    
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });