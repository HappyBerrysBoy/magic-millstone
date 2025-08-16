import React, { useState } from "react";

interface DepositFormProps {
  balance: number;
  onStake: (amount: number) => void;
  onClose: () => void;
}

const PERCENTS = [25, 50, 75, 100];

const DepositForm: React.FC<DepositFormProps> = ({ balance, onStake, onClose }) => {
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
    onClose();
  };

  return (
    <div>
      <div className="mb-4 text-xl font-bold text-center">USDT Deposit</div>
      {/* 비율 버튼 */}
      <div className="mb-2 flex gap-2 justify-center">
        {PERCENTS.map((p) => (
          <button
            key={p}
            className="rounded bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-green-100"
            onClick={() => handlePercent(p)}
            type="button"
          >
            {p}%
          </button>
        ))}
      </div>
      {/* 입력 필드 */}
      <div className="relative mb-2">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">$</span>
        <input
          type="number"
          min="0"
          step="0.01"
          className="w-full rounded-lg border border-gray-300 pl-8 pr-3 py-2 text-lg focus:outline-none focus:ring-2 focus:ring-green-200"
          placeholder="0.00"
          value={amount}
          onChange={handleInput}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">USDT</span>
      </div>
      {/* 사용 가능 잔액 */}
      <div className="mb-4 text-right text-xs text-gray-500">
        available: <span className="font-semibold text-gray-700">{balance.toLocaleString()} USDT</span>
      </div>
      <button
        className="w-full rounded-lg bg-green-600 py-2 font-semibold text-white disabled:bg-gray-300"
        onClick={handleStake}
        disabled={loading || !amount || isNaN(Number(amount)) || Number(amount) <= 0 || Number(amount) > balance}
      >
        {loading ? "처리중..." : "Stake"}
      </button>
    </div>
  );
};

export default DepositForm;
