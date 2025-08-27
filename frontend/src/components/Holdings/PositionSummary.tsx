type PositionSummaryProps = {
  totalValue: string;
  withdrawals: string;
  balance: string;
  exchangeRate: string;
};

export default function PositionSummary({
  withdrawals,
  balance,
  exchangeRate,
  totalValue,
}: PositionSummaryProps) {
  return (
    <div className="flex w-full flex-col gap-7 pt-[50px]">
      <h1 className="text-base font-medium">Your Position</h1>
      <div className="flex w-full flex-col gap-9">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-[6px]">
            <div className="flex items-baseline justify-between">
              <p className="text-lg font-normal">${totalValue}</p>
              <p className="text-sm font-normal text-white">USD</p>
            </div>
            <p className="text-mm-gray-light text-[10px] font-normal">
              Total value
            </p>
          </div>
          <div className="bg-primary h-[0.3px] w-full" />
          <div className="flex flex-col gap-[6px]">
            <div className="flex items-baseline justify-between">
              <p className="text-lg font-normal">{balance}</p>
              <p className="text-sm font-normal text-white">mmUSDT</p>
            </div>
            <p className="text-mm-gray-light text-[10px] font-normal">
              Your Balance
            </p>
          </div>
          <div className="bg-primary h-[0.3px] w-full" />
          <div className="flex flex-col gap-[6px]">
            <div className="flex items-baseline justify-between">
              <p className="text-lg font-normal">${withdrawals}</p>
              <p className="text-sm font-normal text-white">USDT</p>
            </div>
            <p className="text-mm-gray-light text-[10px] font-normal">
              Pending Withdrawals
            </p>
          </div>
        </div>
        <p className="text-mm-gray-default text-center text-xs">
          1 mmUSDT = ${exchangeRate} USDT
        </p>
      </div>
    </div>
  );
}
