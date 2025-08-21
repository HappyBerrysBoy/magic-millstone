"use client";

import { useEffect, useState } from "react";
import ClaimCard from "./ClaimCard";
import { useKaiaWalletSdk } from "@/app/hooks/walletSdk.hooks";
import { useWalletAccountStore } from "@/app/hooks/auth.hooks";
import { withdrawNFTABI } from "@/app/_abis/withdrawNFT";
import { withdrawNFTAddress } from "@/utils/contractAddress";
import { Interface } from "ethers";

type WithdrawalItem = {
  id: bigint;
  amount: bigint;
  requestTime: bigint;
  readyTime: bigint;
  status: bigint;
  requester: bigint;
};

export default function Claim() {
  const { callContractFunction } = useKaiaWalletSdk();
  const { account } = useWalletAccountStore();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [userWithdraws, setUserWithdraws] = useState([]);

  const fetchPendingWithdraws = async () => {
    if (!account) {
      setIsLoading(false);
      setUserWithdraws([]);
      return;
    }

    try {
      setIsLoading(true);

      // 2) getUserWithdrawals -> [tokenIds[], amounts[], totalAmount]
      const decoded = await callContractFunction(
        withdrawNFTAddress,
        withdrawNFTABI as unknown as unknown[],
        // 오버로드가 있다면 "getUserWithdrawals(address)"로 시그니처를 명시
        "getUserWithdrawals(address)",
        [account],
      );

      console.log(decoded);
      const [tokenIds, amounts, total] = decoded;

      if (!Array.isArray(tokenIds)) {
        console.warn("ABI mismatch? decoded:", decoded);
        setUserWithdraws([]);
        // setTotalAmount(0n);
        return;
      }

      const details = await Promise.all(
        tokenIds.map(async (id) => {
          const data = await callContractFunction(
            withdrawNFTAddress,
            withdrawNFTABI as unknown as unknown[],
            "getWithdrawRequestFromVault",
            [id],
          );
          // console.log(data);
          return {
            id,
            amount: data.amount,
            requestTime: data.requestTime,
            readyTime: data.readyTime,
            status: data.status,
            requester: data.requester,
          };
        }),
      );
      console.log(details);
      setUserWithdraws(details);
      // console.log(details);
    } catch (error) {
      console.error("Error fetching withdraws:", error);
      setUserWithdraws([]);
    } finally {
      setIsLoading(false);
    }
  };

  // account 바뀌면 다시 로드
  useEffect(() => {
    fetchPendingWithdraws();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, callContractFunction]);

  // 표시는 문자열로 변환 (필요시 formatUnits)
  const renderAmount = (a: bigint) => a.toString(); // or formatUnits(a, 18)

  return (
    <div className="flex flex-col gap-[10px]">
      <h1 className="text-base font-medium text-white">Claim</h1>

      {isLoading ? (
        <div className="text-white/70">Loading...</div>
      ) : userWithdraws.length === 0 ? (
        <div className="text-white/70">No pending withdrawals</div>
      ) : (
        <div className="flex flex-col gap-2">
          {userWithdraws.map((w) => (
            <ClaimCard
              key={w.id.toString()}
              status="available"
              amount={Number(w.amount)} // ClaimCard가 number 받으면 이렇게, 크면 문자열로
              // amountText={renderAmount(w.amount)} // 컴포넌트에 문자열 prop 추가 권장
            />
          ))}
        </div>
      )}
    </div>
  );
}
