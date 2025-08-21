"use client";

import { useEffect, useState } from "react";
import ClaimCard from "./ClaimCard";
import { useKaiaWalletSdk } from "@/app/hooks/walletSdk.hooks";
import { useWalletAccountStore } from "@/app/hooks/auth.hooks";
import { withdrawNFTABI } from "@/app/_abis/withdrawNFT";
import {
  vaultContractAddress,
  withdrawNFTAddress,
} from "@/utils/contractAddress";
import { formatUnits } from "ethers";
import { vaultABI } from "@/app/_abis/vault";

// 1) 컨트랙트 반환 타입(제네릭에 쓸 것)
type UserWithdrawalsRet = readonly [
  readonly bigint[], // tokenIds
  readonly bigint[], // amounts
  bigint, // totalAmount
];

// getWithdrawRequestFromVault(uint256) 의 리턴이
// [amount, requestTime, readyTime, status, requester] 라고 가정
type WithdrawRequestRet = readonly [
  bigint,
  bigint,
  bigint,
  bigint | number,
  string,
];

// 2) UI에 쓰일 가공 타입
type WithdrawalItemUI = {
  id: string; // 표시/키용 string
  amountText: string; // 사람이 읽는 문자열 (예: 6 decimals)
  status: "available" | "pending";
};

export default function Claim() {
  const { callContractFunction, sendContractTransaction } = useKaiaWalletSdk();
  const { account } = useWalletAccountStore();

  const [isLoading, setIsLoading] = useState(true);
  const [userWithdraws, setUserWithdraws] = useState<WithdrawalItemUI[]>([]);

  const fetchPendingWithdraws = async () => {
    if (!account) {
      setIsLoading(false);
      setUserWithdraws([]);
      return;
    }

    try {
      setIsLoading(true);

      // [tokenIds[], amounts[], totalAmount]
      const [tokenIds] = await callContractFunction(
        withdrawNFTAddress,
        withdrawNFTABI as unknown as unknown[],
        "getUserWithdrawals(address)",
        [account],
      );

      if (!Array.isArray(tokenIds)) {
        setUserWithdraws([]);
        return;
      }

      const details: WithdrawalItemUI[] = await Promise.all(
        tokenIds.map(async (id) => {
          const [amount, , , status] = await callContractFunction(
            withdrawNFTAddress,
            withdrawNFTABI as unknown as unknown[],
            "getWithdrawRequestFromVault(uint256)", // 오버로드면 풀 시그니처 유지
            [id],
          );

          const statusNum = Number(status);
          return {
            id: id.toString(),
            amountText: formatUnits(amount, 6), // 여기서 문자열로 변환
            status: statusNum === 0 ? "available" : "pending",
          };
        }),
      );

      setUserWithdraws(details);
    } catch (error) {
      console.error("Error fetching withdraws:", error);
      setUserWithdraws([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingWithdraws();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, callContractFunction]);
  const handleClaim = async (id: string) => {
    if (status === "pending") return;
    try {
      await sendContractTransaction(
        vaultContractAddress,
        vaultABI as unknown as unknown[],
        "executeWithdraw",
        [id],
      );

      console.log("✅ Claim request sent successfully!");
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
      setTimeout(() => {
        fetchPendingWithdraws();
      }, 1000);
    }
  };

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
              key={w.id}
              id={w.id}
              status={w.status}
              amount={w.amountText}
              handleClaim={handleClaim}
            />
          ))}
        </div>
      )}
    </div>
  );
}
