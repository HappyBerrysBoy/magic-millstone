"use client";

import { testUSDTABI } from "@/abis/testUSDT";
import { vaultABI } from "@/abis/vault";
import ButtonDefault from "@/components/ButtonDefault";
import { formatNumberWithCommas } from "@/utils/formatFuncs";
import { useWalletAccountStore } from "@/app/hooks/auth.hooks";
import { useBottomToastStore } from "@/app/hooks/bottomToast.hooks";
import { useCountdownToNoonMidnight } from "@/app/hooks/time.hooks";
import { useKaiaWalletSdk } from "@/app/hooks/walletSdk.hooks";
import { vaultContractAddress } from "@/utils/contractAddress";
import { microUSDTHexToUSDTDecimal } from "@/utils/format";
import { usdtTokenAddress } from "@/utils/tokenAddress";
import { parseUnits, formatUnits } from "ethers";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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

export default function Stake() {
  const { account } = useWalletAccountStore();
  const {
    getErc20TokenBalance,
    sendContractTransaction,
    web3Provider,
    callContractFunction,
  } = useKaiaWalletSdk();

  const { timeLeft, targetLabel } = useCountdownToNoonMidnight();
  const showToast = useBottomToastStore((s) => s.show);

  const [stakeAmount, setStakeAmount] = useState<number>(0);
  const [inputValue, setInputValue] = useState<string>("");
  const [selectedPercentage, setSelectedPercentage] = useState<number | null>(
    null,
  );
  const [usdtBalance, setUsdtBalance] = useState<number | string>("-");
  const [isStaking, setIsStaking] = useState<boolean>(false);
  const [exchangeRate, setExchangeRate] = useState<number>(0);

  const router = useRouter();

  const fetchBalance = async () => {
    if (account) {
      getErc20TokenBalance(usdtTokenAddress, account).then((balance) => {
        const formattedUSDTBalance = Number(
          microUSDTHexToUSDTDecimal(balance as string),
        ).toFixed(2);
        console.log(`balance updated ${formattedUSDTBalance}`);
        setUsdtBalance(formattedUSDTBalance);
      });
    }
  };

  const fetchExchangeRate = async () => {
    try {
      const rate = await callContractFunction(
        vaultContractAddress,
        vaultABI as unknown as unknown[],
        "exchangeRate",
      );
      console.log("Exchange rate:", rate);
      const formattedRate = Number(formatUnits(rate[0], 6));
      setExchangeRate(formattedRate);
    } catch (error) {
      console.error("Error fetching exchangeRate:", error);
      setExchangeRate(0);
    }
  };

  useEffect(() => {
    fetchBalance();
    fetchExchangeRate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  // Handle stake request
  const handleStakeRequest = async () => {
    if (!account || stakeAmount <= 0 || isStaking) return;

    try {
      setIsStaking(true);

      // Convert withdrawal amount to wei (6 decimals for mmUSDT)
      console.log(stakeAmount);
      const withdrawAmountWei = parseUnits(stakeAmount.toString(), 6);
      console.log(`Allowance USDT : ${usdtBalance}`);
      console.log(`Requesting withdrawal of ${stakeAmount} USDT`);
      console.log(`Amount in wei: ${withdrawAmountWei.toString()}`);

      // Call requestWithdraw on the VaultContract

      const approveHash = await sendContractTransaction(
        usdtTokenAddress,
        testUSDTABI as unknown as unknown[],
        "approve",
        [vaultContractAddress, withdrawAmountWei],
      );
      console.log("response : ", approveHash);
      const approveReceipt = await web3Provider!.waitForTransaction(
        approveHash as string,
      );
      if (!approveReceipt || approveReceipt.status !== 1) {
        throw new Error("Approve failed");
      }
      console.log("✅ Approve confirmed!");

      const depositTx = await sendContractTransaction(
        vaultContractAddress,
        vaultABI as unknown as unknown[],
        "deposit",
        [withdrawAmountWei],
      );
      console.log("depositTx :", depositTx);
      console.log("✅ Stake request sent successfully!");

      // Reset form
      setStakeAmount(0);
      setInputValue("");
      setSelectedPercentage(null);
      showToast("Stake completed successfully.", "success");
    } catch (error: any) {
      console.error("❌ Stake request failed:", error);

      // Handle specific error cases
      if (error.message?.includes("Insufficient mmUSDT balance")) {
        alert("Insufficient mmUSDT balance for Stake");
      } else if (error.message?.includes("Amount too small")) {
        alert("Stake amount is below minimum requirement");
      } else {
        alert(`Stake failed: ${error.message || "Unknown error"}`);
      }
    } finally {
      setIsStaking(false);
      setTimeout(() => {
        fetchBalance();
      }, 1000);
    }
  };

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
    const amount = (Number(usdtBalance) * percentage) / 100;
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
    <>
      <div className="flex flex-col gap-16">
        <div className="flex flex-col gap-16">
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
                <p className="text-mm-gray-default text-xs font-normal">
                  Available
                </p>
                <div className="flex items-baseline gap-1">
                  <p className="text-xs font-normal text-white">
                    {formatNumberWithCommas(usdtBalance)}
                  </p>
                  <p className="text-mm-gray-default text-xs font-normal">
                    USDT
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-1">
                <p className="text-mm-gray-default text-xs font-normal">
                  1 mmUSDT = ${exchangeRate} USDT
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center">
            <div className="text-mm-gray-default text-[10px]">
              Next vault settlement (to {targetLabel}) in approx.
            </div>
            <div className="text-[16px] text-white">{timeLeft}</div>
          </div>
        </div>
      </div>
      <div className="mt-auto flex flex-col gap-2">
        <ButtonDefault theme="primary" onClick={handleStakeRequest}>
          Stake
        </ButtonDefault>
        <ButtonDefault theme="outline" onClick={() => router.push("/holdings")}>
          Cancel
        </ButtonDefault>
      </div>
    </>
  );
}
