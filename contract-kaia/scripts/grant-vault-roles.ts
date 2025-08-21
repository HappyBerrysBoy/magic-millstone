import { ethers } from "hardhat";

async function main(): Promise<void> {
  const [admin] = await ethers.getSigners();

  // Get contract addresses from environment
  const VAULT_ADDRESS: string = process.env.VAULT_ADDRESS || "";
  const MMUSDT_ADDRESS: string = process.env.MMUSDT_ADDRESS || "";
  const WITHDRAWNFT_ADDRESS: string = process.env.WITHDRAWNFT_ADDRESS || "";

  if (!VAULT_ADDRESS || !MMUSDT_ADDRESS || !WITHDRAWNFT_ADDRESS) {
    console.error("❌ Missing required environment variables");
    console.error("Required: VAULT_ADDRESS, MMUSDT_ADDRESS, WITHDRAWNFT_ADDRESS");
    process.exit(1);
  }

  console.log("🔧 Granting roles to new vault contract...");
  console.log("Admin address:", admin.address);
  console.log("Vault address:", VAULT_ADDRESS);

  // Connect to contracts
  const mmUSDTToken = await ethers.getContractAt("mmUSDT", MMUSDT_ADDRESS);
  const withdrawNFT = await ethers.getContractAt("WithdrawNFT", WITHDRAWNFT_ADDRESS);

  try {
    // Grant MINTER_ROLE to vault on mmUSDT token
    console.log("\n1️⃣ Granting MINTER_ROLE to vault on mmUSDT...");
    const MINTER_ROLE = await mmUSDTToken.MINTER_ROLE();
    
    const hasRole = await mmUSDTToken.hasRole(MINTER_ROLE, VAULT_ADDRESS);
    if (hasRole) {
      console.log("✅ Vault already has MINTER_ROLE on mmUSDT");
    } else {
      const tx1 = await mmUSDTToken.grantRole(MINTER_ROLE, VAULT_ADDRESS);
      await tx1.wait();
      console.log("✅ Granted MINTER_ROLE to vault on mmUSDT");
    }

    // Grant BURNER_ROLE to vault on mmUSDT token
    console.log("\n2️⃣ Granting BURNER_ROLE to vault on mmUSDT...");
    const BURNER_ROLE = await mmUSDTToken.BURNER_ROLE();
    
    const hasBurnerRole = await mmUSDTToken.hasRole(BURNER_ROLE, VAULT_ADDRESS);
    if (hasBurnerRole) {
      console.log("✅ Vault already has BURNER_ROLE on mmUSDT");
    } else {
      const tx2 = await mmUSDTToken.grantRole(BURNER_ROLE, VAULT_ADDRESS);
      await tx2.wait();
      console.log("✅ Granted BURNER_ROLE to vault on mmUSDT");
    }

    // Grant MINTER_ROLE to vault on WithdrawNFT
    console.log("\n3️⃣ Granting MINTER_ROLE to vault on WithdrawNFT...");
    const NFT_MINTER_ROLE = await withdrawNFT.MINTER_ROLE();
    
    const hasNFTRole = await withdrawNFT.hasRole(NFT_MINTER_ROLE, VAULT_ADDRESS);
    if (hasNFTRole) {
      console.log("✅ Vault already has MINTER_ROLE on WithdrawNFT");
    } else {
      const tx3 = await withdrawNFT.grantRole(NFT_MINTER_ROLE, VAULT_ADDRESS);
      await tx3.wait();
      console.log("✅ Granted MINTER_ROLE to vault on WithdrawNFT");
    }

    // Grant BURNER_ROLE to vault on WithdrawNFT
    console.log("\n4️⃣ Granting BURNER_ROLE to vault on WithdrawNFT...");
    const NFT_BURNER_ROLE = await withdrawNFT.BURNER_ROLE();
    
    const hasNFTBurnerRole = await withdrawNFT.hasRole(NFT_BURNER_ROLE, VAULT_ADDRESS);
    if (hasNFTBurnerRole) {
      console.log("✅ Vault already has BURNER_ROLE on WithdrawNFT");
    } else {
      const tx4 = await withdrawNFT.grantRole(NFT_BURNER_ROLE, VAULT_ADDRESS);
      await tx4.wait();
      console.log("✅ Granted BURNER_ROLE to vault on WithdrawNFT");
    }

    // Verify all roles
    console.log("\n5️⃣ Verifying all roles...");
    const mmUSDTMinterCheck = await mmUSDTToken.hasRole(MINTER_ROLE, VAULT_ADDRESS);
    const mmUSDTBurnerCheck = await mmUSDTToken.hasRole(BURNER_ROLE, VAULT_ADDRESS);
    const nftMinterCheck = await withdrawNFT.hasRole(NFT_MINTER_ROLE, VAULT_ADDRESS);
    const nftBurnerCheck = await withdrawNFT.hasRole(NFT_BURNER_ROLE, VAULT_ADDRESS);
    
    console.log("mmUSDT MINTER_ROLE:", mmUSDTMinterCheck ? "✅" : "❌");
    console.log("mmUSDT BURNER_ROLE:", mmUSDTBurnerCheck ? "✅" : "❌");
    console.log("WithdrawNFT MINTER_ROLE:", nftMinterCheck ? "✅" : "❌");
    console.log("WithdrawNFT BURNER_ROLE:", nftBurnerCheck ? "✅" : "❌");

    if (mmUSDTMinterCheck && mmUSDTBurnerCheck && nftMinterCheck && nftBurnerCheck) {
      console.log("\n🎉 All roles granted successfully!");
      console.log("✅ The vault can now mint and burn mmUSDT tokens");
      console.log("✅ The vault can now mint and burn withdrawal NFTs");
      console.log("\n📝 You can now test all functions:");
      console.log("npx hardhat run scripts/test-depositUsdt.ts --network kairos");
      console.log("npx hardhat run scripts/test-requestWithdrawal.ts --network kairos");
    } else {
      console.log("\n❌ Some roles were not granted properly");
    }

  } catch (error) {
    console.error("❌ Failed to grant roles:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });