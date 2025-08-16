import { ethers, upgrades } from "hardhat";

async function main() {
  console.log("Starting full deployment of KAIA Yield Farming Vault System...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", await deployer.getAddress());
  console.log(
    "Account balance:",
    ethers.formatEther(
      await ethers.provider.getBalance(await deployer.getAddress())
    )
  );

  const contracts: any = {};

  // 1. Deploy TestUSDT
  console.log("\n1. Deploying TestUSDT...");
  const TestUSDTFactory = await ethers.getContractFactory("TestUSDT");
  const testUSDT = await TestUSDTFactory.deploy();
  await testUSDT.waitForDeployment();
  contracts.testUSDT = await testUSDT.getAddress();
  console.log("✅ TestUSDT deployed to:", contracts.testUSDT);

  // Mint test tokens
  const mintAmount = ethers.parseUnits("1000000", 6); // 1M USDT
  await testUSDT.mint(await deployer.getAddress(), mintAmount);
  console.log("✅ Minted 1,000,000 USDT to deployer");

  // 2. Deploy mmUSDT
  console.log("\n2. Deploying mmUSDT (Upgradeable)...");
  const mmUSDTFactory = await ethers.getContractFactory("mmUSDT");
  const mmUSDTToken = await upgrades.deployProxy(
    mmUSDTFactory,
    ["Magic Millstone USDT", "mmUSDT", 6, await deployer.getAddress()],
    {
      initializer: "initialize",
      kind: "uups",
    }
  );
  await mmUSDTToken.waitForDeployment();
  contracts.mmUSDT = await mmUSDTToken.getAddress();
  console.log("✅ mmUSDT proxy deployed to:", contracts.mmUSDT);

  // 3. Deploy WithdrawNFT
  console.log("\n3. Deploying WithdrawNFT (Upgradeable)...");
  const WithdrawNFTFactory = await ethers.getContractFactory("WithdrawNFT");
  const withdrawNFT = await upgrades.deployProxy(
    WithdrawNFTFactory,
    ["Withdraw Request NFT", "wNFT", await deployer.getAddress()],
    {
      initializer: "initialize",
      kind: "uups",
    }
  );
  await withdrawNFT.waitForDeployment();
  contracts.withdrawNFT = await withdrawNFT.getAddress();
  console.log("✅ WithdrawNFT proxy deployed to:", contracts.withdrawNFT);

  // 4. Deploy VaultContract
  console.log("\n4. Deploying VaultContract (Upgradeable)...");
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
    }
  );
  await vaultContract.waitForDeployment();
  contracts.vaultContract = await vaultContract.getAddress();
  console.log("✅ VaultContract proxy deployed to:", contracts.vaultContract);

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
  const NFT_MANAGER_ROLE = await withdrawNFT.MANAGER_ROLE();

  console.log("Granting NFT MINTER_ROLE to VaultContract...");
  await withdrawNFT.grantRole(NFT_MINTER_ROLE, contracts.vaultContract);

  console.log("Granting NFT BURNER_ROLE to VaultContract...");
  await withdrawNFT.grantRole(NFT_BURNER_ROLE, contracts.vaultContract);

  console.log("Granting NFT MANAGER_ROLE to VaultContract...");
  await withdrawNFT.grantRole(NFT_MANAGER_ROLE, contracts.vaultContract);

  console.log("\n✅ Deployment completed successfully!");
  console.log("\n📋 Contract Addresses:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("TestUSDT:      ", contracts.testUSDT);
  console.log("mmUSDT:        ", contracts.mmUSDT);
  console.log("WithdrawNFT:   ", contracts.withdrawNFT);
  console.log("VaultContract: ", contracts.vaultContract);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  console.log("\n🔧 Next Steps:");
  console.log("1. Verify contracts on block explorer");
  console.log("2. Test deposit and withdraw flows");
  console.log("3. Set up monitoring and alerts");

  // Save deployment info
  const deploymentInfo = {
    network: "kairos",
    deployer: await deployer.getAddress(),
    timestamp: new Date().toISOString(),
    contracts: contracts,
  };

  console.log("\n💾 Deployment Info:");
  console.log(JSON.stringify(deploymentInfo, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });