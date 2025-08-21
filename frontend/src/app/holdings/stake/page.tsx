"use client";

import ButtonBack from "@/app/_components/ButtonBack";
import { useWalletAccountStore } from "@/app/hooks/auth.hooks";
import {
  useKaiaWalletSdk,
  useKaiaWalletSdkStore,
} from "@/app/hooks/walletSdk.hooks";
import DepositForm from "@/components/DepositForm";
import { keiHexToKaiaDecimal, microUSDTHexToUSDTDecimal } from "@/utils/format";
import { useEffect, useMemo, useState } from "react";
import Stake from "../_components/Stake";
import ButtonDefault from "@/app/_components/ButtonDefault";
import { useRouter } from "next/navigation";
import { useCountdownToNoonMidnight } from "@/app/hooks/time.hooks";
import { ethers, formatUnits, parseUnits } from "ethers";
import {
  mmUSDTContractAddress,
  vaultContractAddress,
  withdrawNFTAddress,
} from "@/utils/contractAddress";
import { vaultABI } from "@/app/_abis/vault";
import { withdrawNFTABI } from "@/app/_abis/withdrawNFT";
import { usdtTokenAddress } from "@/utils/tokenAddress";
import { mmUSDTABI } from "@/app/_abis/mmUSDT";
import { Web3Provider } from "@kaiachain/ethers-ext/v6";
import { testUSDTABI } from "@/app/_abis/testUSDT";

const USDTContractAddress = "0xf6A77faA9d860a9218E0ab02Ac77AEe03c027372";

export default function StakePage() {
  const { account } = useWalletAccountStore();
  const { sdk } = useKaiaWalletSdkStore();
  const {
    getAccount,
    getBalance,
    getErc20TokenBalance,
    sendTransaction,
    sendContractTransaction,
    callContractFunction,
    web3Provider
  } = useKaiaWalletSdk();
  const router = useRouter();
  const [stakeAmount, setStakeAmount] = useState<number>(0);
  const [inputValue, setInputValue] = useState<string>("");
  const [selectedPercentage, setSelectedPercentage] = useState<number | null>(
    null,
  );
  const [usdtBalance, setUsdtBalance] = useState<number | string>("-");
  const [isStaking, setIsStaking] = useState<boolean>(false);
  // 임시 데이터
  const tvl = "1,234,567";
  const apy = "8.5%";
  const { timeLeft, targetLabel } = useCountdownToNoonMidnight();
  // balance 불러오기
  const fetchBalance = async () => {
    if (account) {
      getErc20TokenBalance(USDTContractAddress, account).then((balance) => {
        const formattedUSDTBalance = Number(
          microUSDTHexToUSDTDecimal(balance as string),
        ).toFixed(2);
        setUsdtBalance(formattedUSDTBalance);
      });
      // callContractFunction(
      //   vaultContractAddress,
      //   vaultABI as unknown as unknown[],
      //   "mmUSDTToken",
      //   // [account],
      // ).then((balance) => {
      //   console.log(balance)
      //   const formattedUSDTBalance = Number(
      //     microUSDTHexToUSDTDecimal(balance as string),
      //   ).toFixed(2);
      //   setUsdtBalance(formattedUSDTBalance);
      // });
    }
  };
  useEffect(() => {
    fetchBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  // Handle stake request
  const handleStakeRequest = async () => {
    if (!account || stakeAmount <= 0 || isStaking) return;

    try {
      setIsStaking(true);

      // Convert withdrawal amount to wei (6 decimals for mmUSDT)
      const withdrawAmountWei = parseUnits(stakeAmount.toString(), 6);
      console.log(`Allowance USDT : ${usdtBalance}`);
      console.log(`Requesting withdrawal of ${stakeAmount} USDT`);
      console.log(`Amount in wei: ${withdrawAmountWei.toString()}`);

      // Call requestWithdraw on the VaultContract

      const approveHash = await sendContractTransaction(
        USDTContractAddress,
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
      fetchBalance();
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-148px)] flex-col gap-[20px]">
      <ButtonBack onClick={() => router.back()} />
      <div className="flex flex-col gap-16">
        <Stake
          usdtAmount={Number(usdtBalance)}
          setStakeAmount={setStakeAmount}
          inputValue={inputValue}
          setInputValue={setInputValue}
          selectedPercentage={selectedPercentage}
          setSelectedPercentage={setSelectedPercentage}
        />
        <div className="flex flex-col items-center">
          <div className="text-mm-gray-default text-[10px]">
            Next vault settlement (to {targetLabel}) in approx.
          </div>
          <div className="text-[16px] text-white">{timeLeft}</div>
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
    </div>
  );
}
