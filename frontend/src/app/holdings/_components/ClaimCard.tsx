import { formatNumberWithCommas } from "@/app/_utils/formatFuncs";

interface ClaimCardProps {
  id: string;
  status: "available" | "pending";
  amount: number | string;
  currency?: string;
  handleClaim: (id: string) => void;
}

export default function ClaimCard({
  id,
  status,
  amount,
  currency = "USDT",
  handleClaim,
}: ClaimCardProps) {
  const isAvailable = status === "available";

  const cardStyles = isAvailable
    ? "border-[0.6px] border-primary rounded-sm px-3 pb-[10px] pt-4 flex flex-col gap-3 bg-primary/10"
    : "border-[0.6px] border-mm-gray-default/50 rounded-sm px-3 pb-[10px] pt-4 flex flex-col gap-3";

  const statusTextStyles = "text-[10px] font-normal text-primary";

  const buttonStyles = isAvailable
    ? "text-[10px] font-normal text-black bg-primary rounded-sm py-2 w-full"
    : "text-[10px] font-normal text-mm-gray-light bg-[#808787] rounded-sm py-2 w-full";

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
        onClick={() => {
          handleClaim(id);
        }}
      >
        Claim
      </button>
    </div>
  );
}
