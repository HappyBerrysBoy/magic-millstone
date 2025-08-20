import { formatNumberWithCommas } from "@/app/_utils/formatFuncs";

type PositionSummaryProps = {
  withdrawals: string;
  balance: string;
  exchangeRate: string;
};

export default function PositionSummary({
  withdrawals,
  balance,
  exchangeRate,
}: PositionSummaryProps) {
  const totalValue = Number(withdrawals) * Number(exchangeRate);
  return (
    <>
      <div>
        <h1 className="mt-[30px] mb-[16px]">Your Position</h1>
        <div className="flex flex-col gap-7">
          <div className="flex flex-col">
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-base font-normal">${totalValue}</p>
                <p className="justify-between font-normal">USD</p>
              </div>
            </div>
            <p className="text-mm-gray-light text-[10px] font-normal">
              Total value
            </p>
          </div>
          {/* <div className="flex flex-col">
            <div className="relative">
              <p className="text-mm-gray-light absolute top-[-14px] text-[10px] font-normal">
                $1.39
              </p>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-base font-normal">$1.39</p>
                <p className="text-base font-normal text-white">USDT</p>
              </div>
            </div>
            <p className="text-mm-gray-light text-[10px] font-normal">
              Pending Deposits
            </p>
          </div> */}
          <div className="flex flex-col">
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-base font-normal">{balance}</p>
                <p className="text-base font-normal text-white">mmUSDT</p>
              </div>
            </div>
            <p className="text-gray text-[10px] font-normal">Your Balance</p>
          </div>
          <div className="flex flex-col">
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-base font-normal">{withdrawals}</p>
                <p className="text-base font-normal text-white">mmUSDT</p>
              </div>
            </div>
            <p className="text-gray text-[10px] font-normal">
              Pending Withdrawals
            </p>
          </div>
        </div>
        <div className="mt-[24px] w-full">
          <p className="text-gray text-right text-sm">
            1 mmUSDT = ${exchangeRate} USDT
          </p>
        </div>
      </div>
    </>
  );
}
