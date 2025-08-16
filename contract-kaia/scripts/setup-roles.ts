import { ethers } from "hardhat";

async function main() {
  console.log("Setting up roles for VaultContract...");

  const [deployer] = await ethers.getSigners();
  console.log("Setting up with account:", await deployer.getAddress());

  // Contract addresses from environment
  const VAULT_ADDRESS = process.env.VAULT_ADDRESS;
  const MMUSDT_ADDRESS = process.env.MMUSDT_ADDRESS;
  const WITHDRAWNFT_ADDRESS = process.env.WITHDRAWNFT_ADDRESS;

  if (!VAULT_ADDRESS || !MMUSDT_ADDRESS || !WITHDRAWNFT_ADDRESS) {
    console.error("❌ Missing contract addresses in environment variables");
    process.exit(1);
  }

  console.log("\nUsing contract addresses:");
  console.log("VaultContract:  ", VAULT_ADDRESS);
  console.log("mmUSDT:         ", MMUSDT_ADDRESS);
  console.log("WithdrawNFT:    ", WITHDRAWNFT_ADDRESS);

  // Connect to contracts
  const mmUSDT = await ethers.getContractAt("mmUSDT", MMUSDT_ADDRESS);
  const withdrawNFT = await ethers.getContractAt("WithdrawNFT", WITHDRAWNFT_ADDRESS);

  // Define role hashes
  const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
  const BURNER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("BURNER_ROLE"));

  console.log("\n🔐 Granting roles...");

  // Grant MINTER_ROLE to VaultContract on mmUSDT
  console.log("1. Granting MINTER_ROLE to VaultContract on mmUSDT...");
  const tx1 = await mmUSDT.grantRole(MINTER_ROLE, VAULT_ADDRESS);
  await tx1.wait();
  console.log("✅ MINTER_ROLE granted");

  // Grant BURNER_ROLE to VaultContract on mmUSDT
  console.log("2. Granting BURNER_ROLE to VaultContract on mmUSDT...");
  const tx2 = await mmUSDT.grantRole(BURNER_ROLE, VAULT_ADDRESS);
  await tx2.wait();
  console.log("✅ BURNER_ROLE granted");

  // Grant MINTER_ROLE to VaultContract on WithdrawNFT
  console.log("3. Granting MINTER_ROLE to VaultContract on WithdrawNFT...");
  const tx3 = await withdrawNFT.grantRole(MINTER_ROLE, VAULT_ADDRESS);
  await tx3.wait();
  console.log("✅ MINTER_ROLE granted");

  // Grant BURNER_ROLE to VaultContract on WithdrawNFT
  console.log("4. Granting BURNER_ROLE to VaultContract on WithdrawNFT...");
  const tx4 = await withdrawNFT.grantRole(BURNER_ROLE, VAULT_ADDRESS);
  await tx4.wait();
  console.log("✅ BURNER_ROLE granted");

  console.log("\n🎉 All roles granted successfully!");
  console.log("VaultContract can now:");
  console.log("- Mint and burn mmUSDT tokens");
  console.log("- Mint and burn WithdrawNFT tokens");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Role setup failed:", error);
    process.exit(1);
  });