import { ethers } from "hardhat";
import { upgrades } from "hardhat";

async function main() {
  console.log("Starting upgrade process...");

  const [upgrader] = await ethers.getSigners();
  console.log("Upgrading contracts with account:", await upgrader.getAddress());

  // Replace these addresses with your deployed proxy addresses
  const EXISTING_MMUSDT_PROXY = process.env.MMUSDT_PROXY_ADDRESS || "";
  const EXISTING_WITHDRAW_NFT_PROXY = process.env.WITHDRAW_NFT_PROXY_ADDRESS || "";
  const EXISTING_VAULT_PROXY = process.env.VAULT_PROXY_ADDRESS || "";

  if (!EXISTING_MMUSDT_PROXY || !EXISTING_WITHDRAW_NFT_PROXY || !EXISTING_VAULT_PROXY) {
    console.error("❌ Please set proxy addresses in environment variables:");
    console.error("MMUSDT_PROXY_ADDRESS, WITHDRAW_NFT_PROXY_ADDRESS, VAULT_PROXY_ADDRESS");
    process.exit(1);
  }

  console.log("\n📋 Upgrading proxies:");
  console.log("mmUSDT Proxy:        ", EXISTING_MMUSDT_PROXY);
  console.log("WithdrawNFT Proxy:   ", EXISTING_WITHDRAW_NFT_PROXY);
  console.log("VaultContract Proxy: ", EXISTING_VAULT_PROXY);

  try {
    // Upgrade mmUSDT
    console.log("\n1. Upgrading mmUSDT...");
    const mmUSDTFactoryV2 = await ethers.getContractFactory("mmUSDT");
    const mmUSDTUpgraded = await upgrades.upgradeProxy(EXISTING_MMUSDT_PROXY, mmUSDTFactoryV2);
    await mmUSDTUpgraded.waitForDeployment();
    console.log("✅ mmUSDT upgraded successfully");

    // Upgrade WithdrawNFT
    console.log("\n2. Upgrading WithdrawNFT...");
    const WithdrawNFTFactoryV2 = await ethers.getContractFactory("WithdrawNFT");
    const withdrawNFTUpgraded = await upgrades.upgradeProxy(EXISTING_WITHDRAW_NFT_PROXY, WithdrawNFTFactoryV2);
    await withdrawNFTUpgraded.waitForDeployment();
    console.log("✅ WithdrawNFT upgraded successfully");

    // Upgrade VaultContract
    console.log("\n3. Upgrading VaultContract...");
    const VaultContractFactoryV2 = await ethers.getContractFactory("VaultContract");
    const vaultUpgraded = await upgrades.upgradeProxy(EXISTING_VAULT_PROXY, VaultContractFactoryV2);
    await vaultUpgraded.waitForDeployment();
    console.log("✅ VaultContract upgraded successfully");

    console.log("\n🎉 All contracts upgraded successfully!");

    // Verify the upgrades by calling a view function
    console.log("\n🔍 Verifying upgrades...");
    const mmUSDT = await ethers.getContractAt("mmUSDT", EXISTING_MMUSDT_PROXY);
    const withdrawNFT = await ethers.getContractAt("WithdrawNFT", EXISTING_WITHDRAW_NFT_PROXY);
    const vault = await ethers.getContractAt("VaultContract", EXISTING_VAULT_PROXY);

    console.log("mmUSDT symbol:", await mmUSDT.symbol());
    console.log("WithdrawNFT symbol:", await withdrawNFT.symbol());
    
    const vaultInfo = await vault.getVaultInfo();
    console.log("Vault USDT balance:", ethers.formatUnits(vaultInfo.usdtBalance, 6));

    console.log("\n✅ Upgrade verification completed!");

  } catch (error) {
    console.error("❌ Upgrade failed:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });