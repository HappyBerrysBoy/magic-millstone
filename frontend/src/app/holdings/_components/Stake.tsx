"use client";

import { useState } from "react";
import { formatNumberWithCommas } from "@/app/_utils/formatFuncs";

interface PercentageButtonProps {
  percentage: number;
  isActive: boolean;
  onClick: () => void;
}

function PercentageButton({
  percentage,
  isActive,
  onClick,
}: PercentageButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`w-fit rounded-[20px] px-2 py-1 text-[10px] font-medium transition-colors ${
        isActive
          ? "bg-primary text-black"
          : "bg-mm-gray-default hover:bg-primary text-black"
      }`}
    >
      {percentage}%
    </button>
  );
}

interface StakeProps {
  usdtAmount: number | string;
  setStakeAmount: (amount: number) => void;
}

export default function Stake({ usdtAmount, setStakeAmount }: StakeProps) {
  const [selectedPercentage, setSelectedPercentage] = useState<number | null>(
    null,
  );
  const [inputValue, setInputValue] = useState<string>("");

  const percentages = [25, 50, 75, 100];

  const formatDisplayValue = (value: string): string => {
    // Split into whole and decimal parts
    const [wholePart, decimalPart] = value.split(".");

    // Format the whole part with commas
    const formattedWhole = parseInt(wholePart || "0").toLocaleString("en-US");

    // Return with decimal part if it exists
    return decimalPart !== undefined
      ? `${formattedWhole}.${decimalPart}`
      : formattedWhole;
  };

  const handlePercentageClick = (percentage: number) => {
    const amount = (Number(usdtAmount) * percentage) / 100;
    setStakeAmount(amount);
    setSelectedPercentage(percentage);
    setInputValue(formatDisplayValue(amount.toFixed(2)));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Remove commas but keep numbers and dots
    const cleanValue = value.replace(/,/g, "");

    // Only allow numbers and one decimal point
    if (!/^\d*\.?\d*$/.test(cleanValue)) return;

    const numValue = parseFloat(cleanValue) || 0;
    setStakeAmount(numValue);
    setSelectedPercentage(null);

    // Format in real-time while typing
    if (cleanValue) {
      setInputValue(formatDisplayValue(cleanValue));
    } else {
      setInputValue("");
    }
  };

  return (
    <div className="flex flex-col gap-[38px]">
      <div className="flex flex-col">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-base font-medium text-white">USDT Stake</h1>
          <div className="flex gap-2">
            {percentages.map((percentage) => (
              <PercentageButton
                key={percentage}
                percentage={percentage}
                isActive={selectedPercentage === percentage}
                onClick={() => handlePercentageClick(percentage)}
              />
            ))}
          </div>
        </div>
        <div className="mt-7 mb-6 flex">
          <span className="text-[28px] font-normal text-white">$</span>
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            placeholder="0"
            className="bg-taransparent w-full border-none text-[28px] font-normal text-white outline-none"
          />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-mm-gray-default text-xs font-normal">Available</p>
          <div className="flex items-baseline gap-1">
            <p className="text-xs font-normal text-white">
              {formatNumberWithCommas(usdtAmount)}
            </p>
            <p className="text-mm-gray-default text-xs font-normal">USDT</p>
          </div>
        </div>
        <div className="flex justify-end gap-1">
          <p className="text-mm-gray-default text-xs font-normal">
            1 mmUSDT = $ 1.0143 USDT
          </p>
        </div>
      </div>
    </div>
  );
}
