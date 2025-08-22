"use client";

import { WalletButton } from "@/components/Button/WalletButton";
import { useWalletAccountStore } from "@/app/hooks/auth.hooks";
import HomeStats from "@/components/HomeStats";
import MillstoneIcon from "public/svgs/MillstoneIcon";
import MillstoneTextIcon from "public/svgs/MillstoneTextIcon";
import StakeForm from "@/components/Home/StakeForm";
import getStats from "./_services/getStats";
import { useEffect, useState } from "react";

export type PortfolioStats = {
  tvl: string;
  apy: string;
};

export default function Home() {
  const { account } = useWalletAccountStore();
  const [tvl, setTvl] = useState<string>("");
  const [apy, setApy] = useState<string>("");

  useEffect(() => {
    const fetchStats = async () => {
      const stats = await getStats("magic-millstone-usdt");
      setTvl(stats?.tvl ?? "0");
      setApy(stats?.apy ?? "0");
    };
    fetchStats();
  }, []);

  return (
    <div className="flex min-h-[calc(100vh-124px)] flex-col gap-[68px] pt-[50px]">
      <header className="flex w-full justify-center">
        <div className="flex flex-col items-center gap-10">
          <div className="flex flex-col gap-3">
            <MillstoneIcon className="h-10 w-10" />
            <MillstoneTextIcon className="h-[46px] w-[285px]" />
          </div>
          <p className="text-lg font-medium text-white">Stake more and more</p>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-col gap-20">
        {account ? (
          <StakeForm />
        ) : (
          <div className="flex h-[180px] items-center justify-center">
            <WalletButton />
          </div>
        )}
        <HomeStats tvl={tvl} apy={apy} />
      </main>
    </div>
  );
}
