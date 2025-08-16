import { formatNumberWithCommas } from "@/app/_utils/formatFuncs";

interface ClaimCardProps {
    status: 'available' | 'pending';
    amount: number;
    currency?: string;
}

export default function ClaimCard({ status, amount, currency = 'USDT' }: ClaimCardProps) {
    const isAvailable = status === 'available';
    
    const cardStyles = isAvailable 
        ? "border-[0.6px] border-primary rounded-sm px-3 pb-[10px] pt-4 flex flex-col gap-3 bg-primary/10"
        : "border-[0.6px] border-mm-gray-default/50 rounded-sm px-3 pb-[10px] pt-4 flex flex-col gap-3";
    
    const statusTextStyles = "text-[10px] font-normal text-primary";
    
    const buttonStyles = isAvailable
        ? "text-[10px] font-normal text-black bg-primary rounded-sm py-2 w-full"
        : "text-[10px] font-normal text-mm-gray-light bg-[#808787] rounded-sm py-2 w-full";

    return (
        <div className={cardStyles}>
            <div className="px-1 flex flex-col gap-[10px]">
                <p className={statusTextStyles}>
                    {isAvailable ? 'Available' : 'Pending'}
                </p>
                <div className="flex items-baseline gap-2">
                    <p className="text-lg font-normal text-white">
                        {formatNumberWithCommas(amount)}
                    </p>
                    <p className="text-[10px] font-normal text-mm-gray-light">{currency}</p>
                </div>
            </div>
            <button 
                className={buttonStyles}
                disabled={!isAvailable}
            >
                Claim
            </button>
        </div>
    )
}