"use client";

import { usdtTokenAddress } from "@/utils/tokenAddress";
import { formatUnits } from "ethers";
import {
  useKaiaWalletSdk,
  useKaiaWalletSdkStore,
} from "../hooks/walletSdk.hooks";
import { Web3Provider } from "@kaiachain/ethers-ext/v6";
import { useEffect, useMemo, useState } from "react";
import { vaultABI } from "@/abis/vault";
import { useWalletAccountStore } from "../hooks/auth.hooks";
import {
  mmUSDTContractAddress,
  vaultContractAddress,
  withdrawNFTAddress,
} from "@/utils/contractAddress";
import { withdrawNFTABI } from "@/abis/withdrawNFT";
import { mmUSDTABI } from "@/abis/mmUSDT";
import { formatNumberWithCommas } from "@/utils/formatFuncs";
import { useRouter } from "next/navigation";
import PositionSummary from "@/components/Holdings/PositionSummary";
import HoldingButtons from "@/components/Holdings/HoldingButtons";

export default function Holdings() {
  const USDT_ADDRESS = usdtTokenAddress;
  const router = useRouter();
  const { sdk } = useKaiaWalletSdkStore();
  const { getAccount, requestAccount, callContractFunction } =
    useKaiaWalletSdk();
  const { account } = useWalletAccountStore();
  const [loading, setIsLoading] = useState(false);
  const [withdrawals, setWithdrawals] = useState<number>(0);
  const [balance, setBalance] = useState<number>(0);
  const [exchangeRate, setExchangeRate] = useState<number>(0);

  const provider = useMemo(() => {
    if (!sdk) return null;
    const walletProvider = sdk.getWalletProvider();
    return new Web3Provider(walletProvider);
  }, [sdk]);

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
      console.log(mmBalance);
      const formattedBalance = Number(formatUnits(mmBalance[0], 6));
      setBalance(formattedBalance);
    } catch (error) {
      console.error("Error fetching mmUSDT balance:", error);
      setBalance(0);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch userWithdrawals balance
  const fetchUserWithdrawals = async () => {
    if (!account) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const withdrawal = await callContractFunction(
        withdrawNFTAddress,
        withdrawNFTABI as unknown as unknown[],
        "getUserWithdrawals",
        [account],
      );
      console.log("withdrawals", withdrawal, withdrawal.totalAmount);
      const formattedWithdrawal = Number(
        formatUnits(withdrawal.totalAmount, 6),
      );
      setWithdrawals(formattedWithdrawal);
    } catch (error) {
      console.error("Error fetching getUserWithdrawals:", error);
      setWithdrawals(0);
    } finally {
      setIsLoading(false);
    }
  };
  // Fetch totalAmount balance
  const fetchTotalAmount = async () => {
    if (!account) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const rate = await callContractFunction(
        vaultContractAddress,
        vaultABI as unknown as unknown[],
        "exchangeRate",
      );
      console.log("rate", rate);
      const formattedRate = Number(formatUnits(rate[0], 6));
      setExchangeRate(formattedRate);
    } catch (error) {
      console.error("Error fetching exchangeRate:", error);
      setExchangeRate(0);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!provider) return; // sdk 준비 전이면 패스
    if (!account) {
      router.replace("/");
    }

    fetchBalance();
    fetchUserWithdrawals();
    fetchTotalAmount();
  }, [provider, USDT_ADDRESS]);
  if (!account) return;
  return (
    <div className="flex h-full min-h-[calc(100vh-148px)] flex-col">
      <div className="flex-1">
        <PositionSummary
          totalValue={formatNumberWithCommas(
            balance * exchangeRate + withdrawals,
          )}
          withdrawals={formatNumberWithCommas(withdrawals)}
          balance={formatNumberWithCommas(balance)}
          exchangeRate={formatNumberWithCommas(exchangeRate)}
        />
      </div>
      <HoldingButtons />
    </div>
  );
}
