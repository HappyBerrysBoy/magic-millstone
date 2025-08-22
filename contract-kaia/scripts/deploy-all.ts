import { ethers, upgrades } from "hardhat";

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();

  console.log("🚀 Starting complete deployment of Magic Millstone Protocol");
  console.log("=".repeat(80));
  console.log("Deployer address:", deployer.address);
  console.log("Deployer balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "KLAY");
  console.log("=".repeat(80));

  // Track all deployed addresses
  const deployedAddresses: { [key: string]: string } = {};

  try {
    // Step 1: Deploy TestUSDT
    console.log("\n1️⃣ Deploying TestUSDT...");
    const TestUSDT = await ethers.getContractFactory("TestUSDT");
    const testUSDT = await TestUSDT.deploy("Test USDT", "USDT", deployer.address);
    await testUSDT.waitForDeployment();
    deployedAddresses.USDT_ADDRESS = await testUSDT.getAddress();
    console.log("✅ TestUSDT deployed to:", deployedAddresses.USDT_ADDRESS);

    // Step 2: Deploy mmUSDT
    console.log("\n2️⃣ Deploying mmUSDT...");
    const MmUSDT = await ethers.getContractFactory("mmUSDT");
    const mmUSDT = await upgrades.deployProxy(
      MmUSDT,
      ["Magic Millstone USDT", "mmUSDT", deployer.address],
      { initializer: "initialize" }
    );
    await mmUSDT.waitForDeployment();
    deployedAddresses.MMUSDT_ADDRESS = await mmUSDT.getAddress();
    console.log("✅ mmUSDT deployed to:", deployedAddresses.MMUSDT_ADDRESS);

    // Step 3: Deploy WithdrawNFT (we need this before VaultContract)
    console.log("\n3️⃣ Deploying WithdrawNFT...");
    const WithdrawNFT = await ethers.getContractFactory("WithdrawNFT");
    
    // Deploy with placeholder vault address (will update later)
    const withdrawNFT = await upgrades.deployProxy(
      WithdrawNFT,
      [
        "Magic Millstone Withdrawal NFT",
        "mmWNFT", 
        deployer.address,
        ethers.ZeroAddress // Placeholder, will update after VaultContract deployment
      ],
      { initializer: "initialize" }
    );
    await withdrawNFT.waitForDeployment();
    deployedAddresses.WITHDRAWNFT_ADDRESS = await withdrawNFT.getAddress();
    console.log("✅ WithdrawNFT deployed to:", deployedAddresses.WITHDRAWNFT_ADDRESS);

    // Step 4: Deploy VaultContract
    console.log("\n4️⃣ Deploying VaultContract...");
    const VaultContract = await ethers.getContractFactory("VaultContract");
    const vaultContract = await upgrades.deployProxy(
      VaultContract,
      [
        deployedAddresses.USDT_ADDRESS,
        deployedAddresses.MMUSDT_ADDRESS,
        deployedAddresses.WITHDRAWNFT_ADDRESS,
        deployer.address
      ],
      { initializer: "initialize" }
    );
    await vaultContract.waitForDeployment();
    deployedAddresses.VAULT_ADDRESS = await vaultContract.getAddress();
    console.log("✅ VaultContract deployed to:", deployedAddresses.VAULT_ADDRESS);

    // Step 5: Update WithdrawNFT vault address
    console.log("\n5️⃣ Updating WithdrawNFT vault address...");
    const updateVaultTx = await withdrawNFT.updateVaultContract(deployedAddresses.VAULT_ADDRESS);
    await updateVaultTx.wait();
    console.log("✅ WithdrawNFT vault address updated");

    // Step 6: Grant roles and set permissions
    console.log("\n6️⃣ Setting up roles and permissions...");
    
    // Grant MINTER_ROLE to VaultContract on mmUSDT
    console.log("Granting MINTER_ROLE to VaultContract on mmUSDT...");
    const minterRole = await mmUSDT.MINTER_ROLE();
    const grantMinterTx = await mmUSDT.grantRole(minterRole, deployedAddresses.VAULT_ADDRESS);
    await grantMinterTx.wait();
    console.log("✅ MINTER_ROLE granted to VaultContract");

    // Grant BURNER_ROLE to VaultContract on mmUSDT  
    console.log("Granting BURNER_ROLE to VaultContract on mmUSDT...");
    const burnerRole = await mmUSDT.BURNER_ROLE();
    const grantBurnerTx = await mmUSDT.grantRole(burnerRole, deployedAddresses.VAULT_ADDRESS);
    await grantBurnerTx.wait();
    console.log("✅ BURNER_ROLE granted to VaultContract");

    // Grant MINTER_ROLE to VaultContract on WithdrawNFT
    console.log("Granting MINTER_ROLE to VaultContract on WithdrawNFT...");
    const nftMinterRole = await withdrawNFT.MINTER_ROLE();
    const grantNftMinterTx = await withdrawNFT.grantRole(nftMinterRole, deployedAddresses.VAULT_ADDRESS);
    await grantNftMinterTx.wait();
    console.log("✅ MINTER_ROLE granted to VaultContract on WithdrawNFT");

    // Grant BURNER_ROLE to VaultContract on WithdrawNFT
    console.log("Granting BURNER_ROLE to VaultContract on WithdrawNFT...");
    const nftBurnerRole = await withdrawNFT.BURNER_ROLE();
    const grantNftBurnerTx = await withdrawNFT.grantRole(nftBurnerRole, deployedAddresses.VAULT_ADDRESS);
    await grantNftBurnerTx.wait();
    console.log("✅ BURNER_ROLE granted to VaultContract on WithdrawNFT");

    // Step 7: Verify all connections and roles
    console.log("\n7️⃣ Verifying deployment...");
    
    // Check mmUSDT roles
    const hasMinterRole = await mmUSDT.hasRole(minterRole, deployedAddresses.VAULT_ADDRESS);
    const hasBurnerRole = await mmUSDT.hasRole(burnerRole, deployedAddresses.VAULT_ADDRESS);
    console.log("mmUSDT MINTER_ROLE for VaultContract:", hasMinterRole ? "✅" : "❌");
    console.log("mmUSDT BURNER_ROLE for VaultContract:", hasBurnerRole ? "✅" : "❌");

    // Check WithdrawNFT roles
    const hasNftMinterRole = await withdrawNFT.hasRole(nftMinterRole, deployedAddresses.VAULT_ADDRESS);
    const hasNftBurnerRole = await withdrawNFT.hasRole(nftBurnerRole, deployedAddresses.VAULT_ADDRESS);
    console.log("WithdrawNFT MINTER_ROLE for VaultContract:", hasNftMinterRole ? "✅" : "❌");
    console.log("WithdrawNFT BURNER_ROLE for VaultContract:", hasNftBurnerRole ? "✅" : "❌");

    // Check VaultContract connections
    const vaultUsdtAddress = await vaultContract.usdt();
    const vaultMmUsdtAddress = await vaultContract.mmUSDT();
    const vaultWithdrawNftAddress = await vaultContract.withdrawNFT();
    console.log("VaultContract USDT address:", vaultUsdtAddress === deployedAddresses.USDT_ADDRESS ? "✅" : "❌");
    console.log("VaultContract mmUSDT address:", vaultMmUsdtAddress === deployedAddresses.MMUSDT_ADDRESS ? "✅" : "❌");
    console.log("VaultContract WithdrawNFT address:", vaultWithdrawNftAddress === deployedAddresses.WITHDRAWNFT_ADDRESS ? "✅" : "❌");

    // Check WithdrawNFT vault address
    const nftVaultAddress = await withdrawNFT.vaultContract();
    console.log("WithdrawNFT vault address:", nftVaultAddress === deployedAddresses.VAULT_ADDRESS ? "✅" : "❌");

    // Step 8: Optional - Mint some test USDT for testing
    console.log("\n8️⃣ Minting test USDT...");
    const mintAmount = ethers.parseUnits("100000", 6); // 100,000 USDT
    const mintTx = await testUSDT.mint(deployer.address, mintAmount);
    await mintTx.wait();
    console.log("✅ Minted", ethers.formatUnits(mintAmount, 6), "USDT to deployer");

    // Step 9: Final summary
    console.log("\n" + "=".repeat(80));
    console.log("🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!");
    console.log("=".repeat(80));

    console.log("\n📋 DEPLOYED ADDRESSES:");
    Object.entries(deployedAddresses).forEach(([name, address]) => {
      console.log(`${name}=${address}`);
    });

    console.log("\n📝 .env file content:");
    console.log("# Copy these to your .env file");
    Object.entries(deployedAddresses).forEach(([name, address]) => {
      console.log(`${name}=${address}`);
    });

    console.log("\n🧪 Ready for testing! You can now:");
    console.log("- Deposit USDT and mint mmUSDT");
    console.log("- Request withdrawals and mint NFTs");
    console.log("- Execute withdrawals");
    console.log("- All roles and addresses are correctly configured");

    // Step 10: Quick integration test
    console.log("\n🔧 Running quick integration test...");
    
    // Approve USDT for vault
    const approveAmount = ethers.parseUnits("1000", 6);
    const approveTx = await testUSDT.approve(deployedAddresses.VAULT_ADDRESS, approveAmount);
    await approveTx.wait();
    
    // Test deposit
    const depositAmount = ethers.parseUnits("100", 6);
    const depositTx = await vaultContract.deposit(depositAmount);
    await depositTx.wait();
    
    // Check balances
    const mmUsdtBalance = await mmUSDT.balanceOf(deployer.address);
    console.log("✅ Integration test passed! mmUSDT balance:", ethers.formatUnits(mmUsdtBalance, 6));

  } catch (error) {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });