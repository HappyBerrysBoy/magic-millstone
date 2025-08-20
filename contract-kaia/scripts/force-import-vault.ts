import { ethers, upgrades } from "hardhat";

async function main() {
  console.log("📝 Force importing existing VaultContract proxy...");

  const EXISTING_VAULT_PROXY = process.env.VAULT_ADDRESS;
  if (!EXISTING_VAULT_PROXY) {
    console.error("❌ VAULT_ADDRESS not set in environment variables");
    process.exit(1);
  }

  console.log("Proxy address:", EXISTING_VAULT_PROXY);
  
  // Get the VaultContract factory
  const VaultContractFactory = await ethers.getContractFactory("VaultContract");

  try {
    // Force import the existing proxy
    await upgrades.forceImport(EXISTING_VAULT_PROXY, VaultContractFactory, {
      kind: 'uups'
    });
    
    console.log("✅ Proxy successfully registered!");
  } catch (error) {
    console.log("❌ Force import failed:", (error as any).message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });