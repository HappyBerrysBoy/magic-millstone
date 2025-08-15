import { ethers } from "hardhat";

async function main() {
  console.log("Setting up roles and permissions...");

  const [deployer] = await ethers.getSigners();
  console.log("Setting up with account:", await deployer.getAddress());

  // Contract addresses - Update these with your deployed contract addresses
  const MMUSDT_ADDRESS = "0x0000000000000000000000000000000000000000"; // Replace with mmUSDT address
  const WITHDRAWNFT_ADDRESS = "0x0000000000000000000000000000000000000000"; // Replace with WithdrawNFT address
  const VAULT_ADDRESS = "0x0000000000000000000000000000000000000000"; // Replace with VaultContract address

  // Validate addresses
  if (MMUSDT_ADDRESS === "0x0000000000000000000000000000000000000000" ||
      WITHDRAWNFT_ADDRESS === "0x0000000000000000000000000000000000000000" ||
      VAULT_ADDRESS === "0x0000000000000000000000000000000000000000") {
    console.error("❌ Please update the contract addresses in this script first!");
    process.exit(1);
  }

  console.log("\nUsing contract addresses:");
  console.log("mmUSDT:       ", MMUSDT_ADDRESS);
  console.log("WithdrawNFT:  ", WITHDRAWNFT_ADDRESS);
  console.log("VaultContract:", VAULT_ADDRESS);

  // Get contract instances
  const mmUSDTToken = await ethers.getContractAt("mmUSDT", MMUSDT_ADDRESS);
  const withdrawNFT = await ethers.getContractAt("WithdrawNFT", WITHDRAWNFT_ADDRESS);

  console.log("\n🔧 Setting up mmUSDT roles...");

  // Grant roles to VaultContract for mmUSDT
  const MINTER_ROLE = await mmUSDTToken.MINTER_ROLE();
  const BURNER_ROLE = await mmUSDTToken.BURNER_ROLE();

  console.log("Granting MINTER_ROLE to VaultContract...");
  await mmUSDTToken.grantRole(MINTER_ROLE, VAULT_ADDRESS);

  console.log("Granting BURNER_ROLE to VaultContract...");
  await mmUSDTToken.grantRole(BURNER_ROLE, VAULT_ADDRESS);

  console.log("\n🔧 Setting up WithdrawNFT roles...");

  // Grant roles to VaultContract for WithdrawNFT
  const NFT_MINTER_ROLE = await withdrawNFT.MINTER_ROLE();
  const NFT_BURNER_ROLE = await withdrawNFT.BURNER_ROLE();
  const NFT_MANAGER_ROLE = await withdrawNFT.MANAGER_ROLE();

  console.log("Granting NFT MINTER_ROLE to VaultContract...");
  await withdrawNFT.grantRole(NFT_MINTER_ROLE, VAULT_ADDRESS);

  console.log("Granting NFT BURNER_ROLE to VaultContract...");
  await withdrawNFT.grantRole(NFT_BURNER_ROLE, VAULT_ADDRESS);

  console.log("Granting NFT MANAGER_ROLE to VaultContract...");
  await withdrawNFT.grantRole(NFT_MANAGER_ROLE, VAULT_ADDRESS);

  console.log("\n✅ All roles configured successfully!");

  console.log("\n📋 Role Summary:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("mmUSDT roles granted to VaultContract:");
  console.log("  - MINTER_ROLE");
  console.log("  - BURNER_ROLE");
  console.log("");
  console.log("WithdrawNFT roles granted to VaultContract:");
  console.log("  - MINTER_ROLE");
  console.log("  - BURNER_ROLE");
  console.log("  - MANAGER_ROLE");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  console.log("\n🎉 Vault system is ready for testing!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Role setup failed:", error);
    process.exit(1);
  });