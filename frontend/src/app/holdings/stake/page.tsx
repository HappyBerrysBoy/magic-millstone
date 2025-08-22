"use client";

import ButtonBack from "@/components/ButtonBack";
import { useRouter } from "next/navigation";
import { useWalletAccountStore } from "@/app/hooks/auth.hooks";
import { useEffect } from "react";
import Stake from "@/components/Holdings/Stake";

export default function StakePage() {
  const router = useRouter();
  const { account } = useWalletAccountStore();
  useEffect(() => {
    if (!account) {
      router.replace("/"); // 뒤로가기 눌러도 못돌아오게
    }
  }, [account, router]);
  if (!account) return;
  return (
    <div className="flex min-h-[calc(100vh-148px)] flex-col gap-[20px]">
      <ButtonBack onClick={() => router.back()} />
      <Stake />
    </div>
  );
}
