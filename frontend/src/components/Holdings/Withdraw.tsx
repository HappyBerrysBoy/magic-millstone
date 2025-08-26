"use client";

import { useState, useEffect } from "react";
import ButtonDefault from "@/components/Common/ButtonDefault";
import { formatNumberWithCommas } from "@/utils/formatFuncs";
import { useWalletAccountStore } from "@/app/hooks/auth.hooks";
import { useKaiaWalletSdk } from "@/app/hooks/walletSdk.hooks";
import { mmUSDTABI } from "@/abis/mmUSDT";
import { vaultABI } from "@/abis/vault";
import { formatUnits, parseUnits } from "ethers";
import {
  mmUSDTContractAddress,
  vaultContractAddress,
} from "@/utils/contractAddress";
import { useBottomToastStore } from "@/app/hooks/bottomToast.hooks";

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

interface WithdrawProps {
  onWithdrawSuccess?: () => void;
}

export default function Withdraw({ onWithdrawSuccess }: WithdrawProps) {
  const { account } = useWalletAccountStore();
  const { callContractFunction, sendContractTransaction } = useKaiaWalletSdk();
  const showToast = useBottomToastStore((s) => s.show);

  const [balance, setBalance] = useState<number>(0);
  const [withdrawAmount, setWithdrawAmount] = useState<number>(0);
  const [selectedPercentage, setSelectedPercentage] = useState<number | null>(
    null,
  );
  const [inputValue, setInputValue] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isWithdrawing, setIsWithdrawing] = useState<boolean>(false);

  const percentages = [25, 50, 75, 100];

  // Fetch mmUSDT balance
  const fetchBalance = async () => {
    if (!account) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const mmBalance = await callContractFunction(
        mmUSDTContractAddress,
        mmUSDTABI as unknown as unknown[],
        "balanceOf",
        [account],
      );
      const formattedBalance = Number(formatUnits(mmBalance[0], 6));
      setBalance(formattedBalance);
    } catch (error) {
      console.error("Error fetching mmUSDT balance:", error);
      setBalance(0);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  // Handle withdrawal request
  const handleWithdrawRequest = async () => {
    if (!account || withdrawAmount <= 0 || isWithdrawing) return;

    try {
      setIsWithdrawing(true);

      // Convert withdrawal amount to wei (6 decimals for mmUSDT)
      console.log(`input value : ${withdrawAmount}`);
      const withdrawAmountWei = parseUnits(withdrawAmount.toString(), 6);

      console.log(`Requesting withdrawal of ${withdrawAmount} mmUSDT`);
      console.log(`Amount in wei: ${withdrawAmountWei.toString()}`);

      // Call requestWithdraw on the VaultContract
      await sendContractTransaction(
        vaultContractAddress,
        vaultABI as unknown as unknown[],
        "requestWithdraw",
        [withdrawAmountWei],
      );

      console.log("✅ Withdrawal request sent successfully!");

      // Refresh balance after successful withdrawal request
      await fetchBalance();

      // Reset form
      setWithdrawAmount(0);
      setInputValue("");
      setSelectedPercentage(null);
      showToast("Withdrawal request sent successfully.", "success");

      // Trigger claim refresh
      if (onWithdrawSuccess) {
        onWithdrawSuccess();
      }
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
      setIsWithdrawing(false);
      setTimeout(() => {
        fetchBalance();
      }, 1000);
    }
  };

  const formatDisplayValue = (value: string): string => {
    // Split into whole and decimal parts
    const [wholePart, decimalPart] = value.split(".");

    // Format the whole part with commas
    const formattedWhole = parseInt(wholePart || "0").toLocaleString("en-US",{maximumFractionDigits:6});

    // Return with decimal part if it exists
    return decimalPart !== undefined
      ? `${formattedWhole}.${decimalPart}`
      : formattedWhole;
  };

  const handlePercentageClick = (percentage: number) => {
    const amount = (balance * percentage) / 100;
    setSelectedPercentage(percentage);
    setInputValue(formatDisplayValue(amount.toFixed(6)));
    setWithdrawAmount(parseFloat(amount.toFixed(6)));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Remove commas but keep numbers and dots
    const cleanValue = value.replace(/,/g, "");

    // Only allow numbers and one decimal point
    if (!/^\d*\.?\d*$/.test(cleanValue)) return;

    const numValue = parseFloat(cleanValue) || 0;
    setWithdrawAmount(numValue);
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
        <div className="mt-7 mb-6 flex items-baseline">
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            placeholder="0"
            className="w-full border-none bg-transparent text-[28px] font-normal text-white outline-none"
          />
          <span className="text-[14px] font-normal text-white">mmUSDT</span>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-mm-gray-default text-xs font-normal">Available</p>
          <div className="flex items-baseline gap-1">
            <p className="text-xs font-normal text-white">
              {isLoading ? "-" : formatNumberWithCommas(balance)}
            </p>
            <p className="text-mm-gray-default text-xs font-normal">mmUSDT</p>
          </div>
        </div>
      </div>
      <ButtonDefault
        theme="outline"
        disabled={
          isLoading ||
          isWithdrawing ||
          withdrawAmount <= 0 ||
          withdrawAmount > balance
        }
        onClick={handleWithdrawRequest}
      >
        {isWithdrawing ? "Processing..." : "Request Withdraw"}
      </ButtonDefault>
    </div>
  );
}
