"use client";

import PositionSummary from "./_components/PositionSummary";
import HoldingButtons from "./_components/HoldingButtons";
import { usdtTokenAddress } from "@/utils/tokenAddress";
import { ethers } from "ethers";
import {
  useKaiaWalletSdk,
  useKaiaWalletSdkStore,
} from "../hooks/walletSdk.hooks";
import { millstoneAIVault } from "../_abis/millstoneAIVault";
import { TxTypeValueTransfer, Web3Provider } from "@kaiachain/ethers-ext/v6";
import { useEffect, useMemo, useState } from "react";
import { vaultABI } from "../_abis/vault";
import { useWalletAccountStore } from "../hooks/auth.hooks";
import {
  mmUSDTContractAddress,
  vaultContractAddress,
  withdrawNFTAddress,
} from "@/utils/contractAddress";
import { withdrawNFTABI } from "../_abis/withdrawNFT";
import { mmUSDTABI } from "../_abis/mmUSDT";
import { formatNumberWithCommas } from "../_utils/formatFuncs";

export default function Holdings() {
  const USDT_ADDRESS = usdtTokenAddress;
  const { sdk } = useKaiaWalletSdkStore();
  const { getAccount, requestAccount, callContractFunction } =
    useKaiaWalletSdk();
  const { account } = useWalletAccountStore();

  const [withdrawals, setWithdrawals] = useState<string>("0.00");
  const [balance, setBalance] = useState<string>("0.00");
  const [exchangeRate, setExchangeRate] = useState<string>("0.00");

  const provider = useMemo(() => {
    if (!sdk) return null;
    const walletProvider = sdk.getWalletProvider();
    return new Web3Provider(walletProvider);
  }, [sdk]);

  useEffect(() => {
    if (!provider) return; // sdk 준비 전이면 패스
    (async () => {
      try {
        const contract = new ethers.Contract(
          withdrawNFTAddress,
          withdrawNFTABI,
          provider,
        );
        const contractCallData = await contract.getUserWithdrawals(account);
        setWithdrawals(contractCallData.totalAmount);
      } catch (err) {
        console.error("getUserWithdrawals 실패:", err);
      }
    })();
    (async () => {
      try {
        const contract = new ethers.Contract(
          mmUSDTContractAddress,
          mmUSDTABI,
          provider,
        );
        const contractCallData = await contract.balanceOf(account);
        setBalance(contractCallData);
      } catch (err) {
        console.error("balanceOf 실패:", err);
      }
    })();
    (async () => {
      try {
        const contract = new ethers.Contract(
          vaultContractAddress,
          vaultABI,
          provider,
        );
        const contractCallData = await contract.exchangeRate();
        setExchangeRate(ethers.formatUnits(contractCallData, 6));
        console.log(exchangeRate);
      } catch (err) {
        console.error("exchangeRate 실패:", err);
      }
    })();
  }, [provider, USDT_ADDRESS]);
  return (
    <div className="flex h-full min-h-[calc(100vh-148px)] flex-col">
      <div className="flex-1">
        <PositionSummary
          withdrawals={formatNumberWithCommas(withdrawals)}
          balance={formatNumberWithCommas(balance)}
          exchangeRate={formatNumberWithCommas(exchangeRate)}
        />
      </div>
      <HoldingButtons />
    </div>
  );
}
