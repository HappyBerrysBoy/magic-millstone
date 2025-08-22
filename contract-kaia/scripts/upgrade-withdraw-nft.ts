import { ethers, upgrades } from "hardhat";

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();

  console.log("🔧 Upgrading WithdrawNFT Contract");
  console.log("Deployer address:", deployer.address);

  const WITHDRAWNFT_ADDRESS = process.env.WITHDRAWNFT_ADDRESS;
  if (!WITHDRAWNFT_ADDRESS) {
    console.error("❌ WITHDRAWNFT_ADDRESS not set in .env");
    process.exit(1);
  }

  console.log("Current WithdrawNFT address:", WITHDRAWNFT_ADDRESS);

  // Get the new implementation
  const WithdrawNFTV2 = await ethers.getContractFactory("WithdrawNFT");
  
  console.log("\n📝 Preparing for upgrade...");
  
  try {
    // First, import the existing proxy
    console.log("Importing existing proxy...");
    await upgrades.forceImport(WITHDRAWNFT_ADDRESS, WithdrawNFTV2);
    
    // Now upgrade the contract
    console.log("Upgrading contract...");
    const upgraded = await upgrades.upgradeProxy(WITHDRAWNFT_ADDRESS, WithdrawNFTV2);
    await upgraded.waitForDeployment();
    
    console.log("✅ WithdrawNFT upgraded successfully!");
    console.log("Proxy address (unchanged):", await upgraded.getAddress());
    
    // Test the fixed function
    console.log("\n🧪 Testing the fixed function...");
    const withdrawNFT = await ethers.getContractAt("WithdrawNFT", WITHDRAWNFT_ADDRESS);
    
    // Test with NFT 47 (we know this exists and is READY)
    try {
      const result = await withdrawNFT.getWithdrawRequestFromVault(47);
      console.log("✅ getWithdrawRequestFromVault(47) result:");
      console.log("  Amount:", ethers.formatUnits(result[0], 6), "USDT");
      console.log("  RequestTime:", result[1].toString());
      console.log("  ReadyTime:", result[2].toString());
      console.log("  Status:", result[3].toString(), result[3].toString() === "1" ? "(READY)" : "(PENDING)");
      console.log("  Requester:", result[4]);
      
      if (result[3].toString() === "1" && result[4] !== "0x0000000000000000000000000000000000000000") {
        console.log("🎉 SUCCESS: Function now returns correct status and requester!");
      } else {
        console.log("❌ ISSUE: Function still not working correctly");
      }
      
    } catch (error) {
      console.log("❌ Test failed:", error);
    }
    
    // Test a few more NFTs
    console.log("\n🔍 Testing multiple NFTs:");
    const testIds = [35, 36, 37, 45, 46, 47];
    
    for (const id of testIds) {
      try {
        const result = await withdrawNFT.getWithdrawRequestFromVault(id);
        const statusText = result[3].toString() === "1" ? "READY" : "PENDING";
        const hasRequester = result[4] !== "0x0000000000000000000000000000000000000000";
        console.log(`  NFT ${id}: ${statusText} | ${ethers.formatUnits(result[0], 6)} USDT | Requester: ${hasRequester ? "✅" : "❌"}`);
      } catch (error) {
        console.log(`  NFT ${id}: ERROR - ${error}`);
      }
    }

  } catch (error) {
    console.error("❌ Upgrade failed:", error);
    process.exit(1);
  }

  console.log("\n✅ WithdrawNFT upgrade completed!");
  console.log("🎯 The getWithdrawRequestFromVault function should now work correctly for frontend");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });