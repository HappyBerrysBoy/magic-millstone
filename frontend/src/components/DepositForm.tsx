import React, { useState } from "react";
import { useKaiaWalletSdk } from "../app/hooks/walletSdk.hooks";
import Button from "./Common/Button";

interface DepositFormProps {
  balance: number;
  onStake: (amount: number) => void;
  onClose?: () => void;
}

const PERCENTS = [25, 50, 75, 100];

const DepositForm: React.FC<DepositFormProps> = ({
  balance,
  onStake,
  onClose,
}) => {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const handlePercent = (percent: number) => {
    const value = ((balance * percent) / 100).toFixed(2);
    setAmount(value);
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9.]/g, "");
    setAmount(val);
  };

  const handleStake = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return;
    setLoading(true);
    await onStake(Number(amount));
    setLoading(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="mb-4 text-center text-[16px] text-white">
          USDT Deposit
        </div>
        {/* 비율 버튼 */}
        <div className="mb-2 flex items-center justify-center gap-[8px]">
          {PERCENTS.map((p) => (
            <button
              key={p}
              className="bg-primary h-[18px] w-[40px] rounded-full text-xs text-black"
              onClick={() => handlePercent(p)}
              type="button"
            >
              {p}%
            </button>
          ))}
        </div>
      </div>
      {/* 입력 필드 */}
      <div className="relative mb-2">
        <span className="absolute top-1/2 left-3 -translate-y-1/2 text-lg text-gray-400">
          $
        </span>
        <input
          type="number"
          min="0"
          step="0.01"
          className="w-full py-2 pr-3 pl-8 text-lg focus:ring-2"
          placeholder="0.00"
          value={amount}
          onChange={handleInput}
        />
        <span className="absolute top-1/2 right-3 -translate-y-1/2 text-sm text-gray-400">
          USDT
        </span>
      </div>
      {/* 사용 가능 잔액 */}
      <div className="flex justify-between text-[12px]">
        <span className="text-gray">Available</span>
        <div>
          <span className="mr-[4px] text-white">
            {balance.toLocaleString()}
          </span>
          <span>USDT</span>
        </div>
      </div>
      <Button className="w-full" onClick={handleStake}>
        Stake
      </Button>
    </div>
  );
};

export default DepositForm;
