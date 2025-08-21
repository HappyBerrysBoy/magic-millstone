import { vaultABI } from "@/app/_abis/vault";
import { formatNumberWithCommas } from "@/app/_utils/formatFuncs";
import { useKaiaWalletSdk } from "@/app/hooks/walletSdk.hooks";
import { vaultContractAddress } from "@/utils/contractAddress";

interface ClaimCardProps {
  id: string;
  status: "available" | "pending";
  amount: number | string;
  currency?: string;
}

export default function ClaimCard({
  id,
  status,
  amount,
  currency = "USDT",
}: ClaimCardProps) {
  const { sendContractTransaction } = useKaiaWalletSdk();
  const isAvailable = status === "available";

  const cardStyles = isAvailable
    ? "border-[0.6px] border-primary rounded-sm px-3 pb-[10px] pt-4 flex flex-col gap-3 bg-primary/10"
    : "border-[0.6px] border-mm-gray-default/50 rounded-sm px-3 pb-[10px] pt-4 flex flex-col gap-3";

  const statusTextStyles = "text-[10px] font-normal text-primary";

  const buttonStyles = isAvailable
    ? "text-[10px] font-normal text-black bg-primary rounded-sm py-2 w-full"
    : "text-[10px] font-normal text-mm-gray-light bg-[#808787] rounded-sm py-2 w-full";

  const handleClaim = async () => {
    if (status === "pending") return;
    try {
      await sendContractTransaction(
        vaultContractAddress,
        vaultABI as unknown as unknown[],
        "executeWithdraw",
        [id],
      );

      console.log("✅ Claim request sent successfully!");
    } catch (error: any) {
      console.error("❌ Withdrawal request failed:", error);

      // Handle specific error cases
      if (error.message?.includes("Insufficient mmUSDT balance")) {
        alert("Insufficient mmUSDT balance for withdrawal");
      } else if (error.message?.includes("Amount too small")) {
        alert("Withdrawal amount is below minimum requirement");
      } else {
        alert(`Withdrawal failed: ${error.message || "Unknown error"}`);
      }
    } finally {
    }
  };

  return (
    <div className={cardStyles}>
      <div className="flex flex-col gap-[10px] px-1">
        <p className={statusTextStyles}>
          {isAvailable ? "Available" : "Pending"}
        </p>
        <div className="flex items-baseline gap-2">
          <p className="text-lg font-normal text-white">
            {formatNumberWithCommas(amount)}
          </p>
          <p className="text-mm-gray-light text-[10px] font-normal">
            {currency}
          </p>
        </div>
      </div>
      <button
        className={buttonStyles}
        disabled={!isAvailable}
        onClick={handleClaim}
      >
        Claim
      </button>
    </div>
  );
}
