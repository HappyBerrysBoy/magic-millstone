'use client'

import ButtonBack from "@/app/_components/ButtonBack";
import Withdraw from "../_components/Withdraw";
import Claim from "../_components/Claim";
import { useRouter } from "next/navigation";
import { useWalletAccountStore } from "@/app/hooks/auth.hooks";
import { useEffect } from "react";

export default function WithdrawPage() {
  const router = useRouter();
  const { account } = useWalletAccountStore();
  useEffect(() => {
    if (!account) {
      router.replace("/"); // 뒤로가기 눌러도 못돌아오게
    }
  }, [account, router]);
  if (!account) return;
  return (
    <div className="flex flex-col gap-[26px]">
      <ButtonBack href="/holdings" />
      <div className="flex flex-col gap-16">
        <Withdraw />
        <Claim />
      </div>
    </div>
  );
}
