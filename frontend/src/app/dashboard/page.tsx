"use client";
import { useState } from "react";
import ChartTabs from "@/components/Dashboard/ChartTabs";
import { useWalletAccountStore } from "@/app/hooks/auth.hooks";
import Header from "@/components/Common/Header";
import VaultStats from "@/components/Dashboard/VaultStats";
import Composition from "@/components/Dashboard/Composition";

export default function Dashboard() {
  const { account } = useWalletAccountStore();
  const [depositOpen, setDepositOpen] = useState(false);

  // 임시 데이터
  const tvl = "1,234,567 USDT";
  const apy = "8.5%";
  const timeLeft = "01:23:45";

  return (
    <div className="flex min-h-screen flex-col">
      <main className="mx-auto w-full max-w-md flex-1">
        <VaultStats tvl={tvl} apy={apy} timeLeft={timeLeft} />
        {/* 차트 탭 영역 */}
        <ChartTabs />
        <Composition />
      </main>
    </div>
  );
}
