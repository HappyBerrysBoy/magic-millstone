"use client";

import ButtonBack from "@/components/Common/ButtonBack";

import { useRouter } from "next/navigation";
import { useWalletAccountStore } from "@/app/hooks/auth.hooks";
import { useEffect, useRef } from "react";
import Withdraw from "@/components/Holdings/Withdraw";
import Claim from "@/components/Holdings/Claim";

export default function WithdrawPage() {
  const router = useRouter();
  const { account } = useWalletAccountStore();
  const claimRefreshRef = useRef<{ refresh: () => void }>(null);

  useEffect(() => {
    if (!account) {
      router.replace("/"); // 뒤로가기 눌러도 못돌아오게
    }
  }, [account, router]);

  if (!account) return;

  const handleWithdrawSuccess = () => {
    if (claimRefreshRef.current) {
      claimRefreshRef.current.refresh();
    }
  };

  return (
    <div className="flex flex-col gap-[26px]">
      <ButtonBack href="/holdings" />
      <div className="flex flex-col gap-16">
        <Withdraw onWithdrawSuccess={handleWithdrawSuccess} />
        <Claim ref={claimRefreshRef} />
      </div>
    </div>
  );
}
