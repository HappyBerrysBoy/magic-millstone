import { ethers } from "hardhat";

async function main() {
  console.log("🔍 Debug Admin Deposit");

  const [admin] = await ethers.getSigners();
  const VAULT_ADDRESS = process.env.VAULT_ADDRESS;
  const TESTUUSDT_ADDRESS = process.env.TESTUUSDT_ADDRESS;
  
  if (!VAULT_ADDRESS || !TESTUUSDT_ADDRESS) {
    console.error("❌ Missing contract addresses");
    process.exit(1);
  }

  const vaultContract = await ethers.getContractAt("VaultContract", VAULT_ADDRESS);
  const testUSDT = await ethers.getContractAt("TestUSDT", TESTUUSDT_ADDRESS);

  console.log("\n📊 Current State:");
  const adminBalance = await testUSDT.balanceOf(admin.address);
  const vaultBalance = await testUSDT.balanceOf(VAULT_ADDRESS);
  const allowance = await testUSDT.allowance(admin.address, VAULT_ADDRESS);
  const vaultInfo = await vaultContract.getVaultInfo();

  console.log("Admin USDT balance:", ethers.formatUnits(adminBalance, 6), "USDT");
  console.log("Vault USDT balance:", ethers.formatUnits(vaultBalance, 6), "USDT");
  console.log("Allowance:", ethers.formatUnits(allowance, 6), "USDT");
  console.log("Bridge balance:", ethers.formatUnits(vaultInfo[4], 6), "USDT");
  console.log("Total requested:", ethers.formatUnits(vaultInfo[5], 6), "USDT");

  // Try a small test deposit
  const testAmount = ethers.parseUnits("1", 6);
  
  try {
    console.log("\n🧪 Testing small deposit (1 USDT)...");
    
    // Check if we need approval
    if (allowance < testAmount) {
      console.log("Approving...");
      const approveTx = await testUSDT.approve(VAULT_ADDRESS, testAmount);
      await approveTx.wait();
    }

    // Get balances before
    const beforeAdmin = await testUSDT.balanceOf(admin.address);
    const beforeVault = await testUSDT.balanceOf(VAULT_ADDRESS);
    
    // Try deposit
    const tx = await vaultContract.depositFromBridge(testAmount);
    const receipt = await tx.wait();
    
    console.log("Transaction:", tx.hash);
    console.log("Gas used:", receipt.gasUsed.toString());
    
    // Get balances after
    const afterAdmin = await testUSDT.balanceOf(admin.address);
    const afterVault = await testUSDT.balanceOf(VAULT_ADDRESS);
    
    console.log("Admin change:", ethers.formatUnits(beforeAdmin - afterAdmin, 6), "USDT");
    console.log("Vault change:", ethers.formatUnits(afterVault - beforeVault, 6), "USDT");
    
    // Check events
    console.log("\n📋 Events:");
    for (const log of receipt.logs) {
      try {
        const parsed = vaultContract.interface.parseLog(log);
        if (parsed) {
          console.log("Event:", parsed.name, parsed.args);
        }
      } catch {
        // Ignore unparseable logs
      }
    }
    
  } catch (error: any) {
    console.log("❌ Test failed:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });