import { ethers } from "hardhat";

async function main() {
  console.log("🔐 Granting ADMIN_ROLE to new wallet...");

  const [currentAdmin] = await ethers.getSigners();
  console.log("Current admin:", await currentAdmin.getAddress());

  const NEW_ADMIN_ADDRESS = "0x1b9bf1210D19D7a9D95443cc9dC9D2BD780b0E9A";
  const VAULT_ADDRESS = process.env.VAULT_ADDRESS;

  if (!VAULT_ADDRESS) {
    console.error("❌ VAULT_ADDRESS not set in environment variables");
    process.exit(1);
  }

  console.log("New admin address:", NEW_ADMIN_ADDRESS);
  console.log("VaultContract:", VAULT_ADDRESS);

  // Connect to VaultContract
  const vaultContract = await ethers.getContractAt(
    "VaultContract",
    VAULT_ADDRESS
  );

  try {
    console.log("\n📝 Granting ADMIN_ROLE...");

    // Grant ADMIN_ROLE (different from DEFAULT_ADMIN_ROLE)
    const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));
    const tx = await vaultContract.grantRole(ADMIN_ROLE, NEW_ADMIN_ADDRESS);
    await tx.wait();

    console.log("✅ ADMIN_ROLE granted successfully!");

    // Note: Role verification skipped due to ABI compatibility issues
    console.log("✅ Role granted to:", NEW_ADMIN_ADDRESS);

    console.log("\n🎉 New admin can now:");
    console.log("• Mark withdrawals as ready");
    console.log("• Transfer funds to bridge (sendToBridge)");
    console.log("• Emergency withdraw tokens");
  } catch (error) {
    console.error("❌ Error granting ADMIN_ROLE:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
