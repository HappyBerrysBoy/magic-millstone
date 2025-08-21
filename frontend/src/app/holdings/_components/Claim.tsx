"use client";

import { useEffect, useState } from "react";
import ClaimCard from "./ClaimCard";
import { useKaiaWalletSdk } from "@/app/hooks/walletSdk.hooks";
import { useWalletAccountStore } from "@/app/hooks/auth.hooks";
import { withdrawNFTABI } from "@/app/_abis/withdrawNFT";
import { withdrawNFTAddress } from "@/utils/contractAddress";

export default function Claim() {
  const { callContractFunction } = useKaiaWalletSdk();
  const { account } = useWalletAccountStore();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [userWithdraws, setUserWithdraws] = useState([]);

  const fetchPendingWithdraws = async () => {
    if (!account) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      console.log("balanceof",await callContractFunction(
        withdrawNFTAddress,
        withdrawNFTABI as unknown as unknown[],
        "balanceOf",
        [account],
      ))
      const userWithdrawData = await callContractFunction(
        withdrawNFTAddress,
        withdrawNFTABI as unknown as unknown[],
        "getUserWithdrawals",
        [account],
      );
      console.log("userWithdrawData", userWithdrawData)
      console.log("totalamount", userWithdrawData.totalAmount);
      console.log("tokenIds : ", userWithdrawData.tokenIds);
      console.log("amounts : ", userWithdrawData.amounts);
      setIsLoading(userWithdrawData);
    } catch (error) {
      console.error("Error fetching withdraws balance:", error);
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    fetchPendingWithdraws();
  }, []);
  return (
    <div className="flex flex-col gap-[10px]">
      <h1 className="text-base font-medium text-white">Claim</h1>
      <div className="flex flex-col gap-2">
        <ClaimCard status="available" amount={100} />
        <ClaimCard status="pending" amount={100} />
      </div>
    </div>
  );
}
