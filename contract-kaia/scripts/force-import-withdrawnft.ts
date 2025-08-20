import { ethers, upgrades } from "hardhat";

async function main() {
  console.log("📝 Force importing existing WithdrawNFT proxy...");

  const EXISTING_WITHDRAWNFT_PROXY = process.env.WITHDRAWNFT_ADDRESS;
  if (!EXISTING_WITHDRAWNFT_PROXY) {
    console.error("❌ WITHDRAWNFT_ADDRESS not set in environment variables");
    process.exit(1);
  }

  console.log("Proxy address:", EXISTING_WITHDRAWNFT_PROXY);
  
  // Get the WithdrawNFT factory
  const WithdrawNFTFactory = await ethers.getContractFactory("WithdrawNFT");

  try {
    // Force import the existing proxy
    await upgrades.forceImport(EXISTING_WITHDRAWNFT_PROXY, WithdrawNFTFactory, {
      kind: 'uups'
    });
    
    console.log("✅ WithdrawNFT proxy successfully registered!");
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