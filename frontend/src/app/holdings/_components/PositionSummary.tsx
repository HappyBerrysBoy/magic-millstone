export default function PositionSummary() {
  return (
    <>
      <div>
        <h1 className="mt-[30px] mb-[16px]">Your Position</h1>
        <div className="flex flex-col gap-7">
          <div className="flex flex-col">
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-base font-normal">$1.39</p>
                <p className="justify-between font-normal">USD</p>
              </div>
            </div>
            <p className="text-mm-gray-light text-[10px] font-normal">
              Total value
            </p>
          </div>
          <div className="flex flex-col">
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
          </div>
          <div className="flex flex-col">
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-base font-normal">0.00</p>
                <p className="text-base font-normal text-white">mmUSDT</p>
              </div>
            </div>
            <p className="text-gray text-[10px] font-normal">Your Shares</p>
          </div>
          <div className="flex flex-col">
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-base font-normal">0.00</p>
                <p className="text-base font-normal text-white">mmUSDT</p>
              </div>
            </div>
            <p className="text-gray text-[10px] font-normal">
              Pending Withdrawals
            </p>
          </div>
        </div>
        <div className="mt-[24px] w-full">
          <p className="text-gray text-sm text-right text-base">
            1 mmUSDT = $1.0143 USDT
          </p>
        </div>
      </div>
    </>
  );
}
