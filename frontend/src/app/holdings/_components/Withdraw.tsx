'use client';

import { useState } from 'react';
import ButtonDefault from "@/app/_components/ButtonDefault";
import { formatNumberWithCommas } from "@/app/_utils/formatFuncs";

interface PercentageButtonProps {
  percentage: number;
  isActive: boolean;
  onClick: () => void;
}

function PercentageButton({ percentage, isActive, onClick }: PercentageButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`text-[10px] font-medium rounded-[20px] w-fit px-2 py-1 transition-colors ${
        isActive 
          ? "text-black bg-primary" 
          : "text-black bg-mm-gray-default hover:bg-primary"
      }`}
    >
      {percentage}%
    </button>
  );
}

export default function Withdraw() {
    const balance = 19867.4623;
    const [withdrawAmount, setWithdrawAmount] = useState<number>(0);
    const [selectedPercentage, setSelectedPercentage] = useState<number | null>(null);
    const [inputValue, setInputValue] = useState<string>('');

    const percentages = [25, 50, 75, 100];

    const formatDisplayValue = (value: string): string => {
        // Split into whole and decimal parts
        const [wholePart, decimalPart] = value.split('.');
        
        // Format the whole part with commas
        const formattedWhole = parseInt(wholePart || '0').toLocaleString('en-US');
        
        // Return with decimal part if it exists
        return decimalPart !== undefined ? `${formattedWhole}.${decimalPart}` : formattedWhole;
    };

    const handlePercentageClick = (percentage: number) => {
        const amount = (balance * percentage) / 100;
        setWithdrawAmount(amount);
        setSelectedPercentage(percentage);
        setInputValue(formatDisplayValue(amount.toFixed(2)));
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        // Remove commas but keep numbers and dots
        const cleanValue = value.replace(/,/g, '');
        
        // Only allow numbers and one decimal point
        if (!/^\d*\.?\d*$/.test(cleanValue)) return;
        
        const numValue = parseFloat(cleanValue) || 0;
        setWithdrawAmount(numValue);
        setSelectedPercentage(null);
        
        // Format in real-time while typing
        if (cleanValue) {
            setInputValue(formatDisplayValue(cleanValue));
        } else {
            setInputValue('');
        }
    };


    return (
        <div className="flex flex-col gap-[38px]">
            <div className="flex flex-col">
                <div className="flex justify-between items-center gap-2">
                    <h1 className="text-base font-medium text-white">USDT Withdraw</h1>
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
                <div className="flex mt-7 mb-6">
                    <span className="text-[28px] font-normal text-white">$</span>
                    <input
                        type="text"
                        value={inputValue}
                        onChange={handleInputChange}
                        placeholder="0"
                        className="text-[28px] font-normal text-white bg-transparent border-none outline-none w-full"
                    />
                </div>
                <div className="flex justify-between items-center">
                    <p className="text-xs font-normal text-mm-gray-default">Available</p>
                    <div className="flex items-baseline gap-1">
                        <p className="text-xs font-normal text-white">{formatNumberWithCommas(balance)}</p>
                        <p className="text-xs font-normal text-mm-gray-default">USDT</p>
                    </div>
                </div>
            </div>
            <ButtonDefault 
                theme="outline"
                disabled={withdrawAmount <= 0 || withdrawAmount > balance}
            >
                Request Withdraw
            </ButtonDefault>
        </div>
    )
}