"use client";
import { WalletButton } from "@/components/Button/WalletButton";
import { useState, useEffect } from "react";
import { useWalletAccountStore } from "@/app/hooks/auth.hooks";
import { useKaiaWalletSdk } from "@/app/hooks/walletSdk.hooks";
import { keiHexToKaiaDecimal, microUSDTHexToUSDTDecimal } from "@/utils/format";
import HomeStats from "@/components/HomeStats";
import { useRouter } from "next/navigation";
import { callApi } from "./_utils/callApi";
import MillstoneIcon from "public/svgs/MillstoneIcon";
import MillstoneTextIcon from "public/svgs/MillstoneTextIcon";
import StakeForm from "./_components/StakeForm";
import ButtonDefault from "./_components/ButtonDefault";

const USDTContractAddress = "0xf6A77faA9d860a9218E0ab02Ac77AEe03c027372";

type PortfolioStats = {
  tvl: number;
  apy: number;
};

export default function Home() {
  const { account } = useWalletAccountStore();
  const { getBalance, getErc20TokenBalance } = useKaiaWalletSdk();
  const [kaiaBalance, setKaiaBalance] = useState<number | string>("-");
  const [usdtBalance, setUsdtBalance] = useState<number | string>("-");
  const [depositOpen, setDepositOpen] = useState(false);
  const [tvl, setTvl] = useState(0);
  const [apy, setApy] = useState(0);

  const router = useRouter();
  // 임시 데이터
  useEffect(() => {
    const handleUpdateVaultStats = async () => {
      try {
        const res = await callApi({
          endpoint: `/portfolio/magic-millstone-usdt/stats`,
          method: "GET",
        });
        const data = (res as any).data ?? res;
        setTvl(data.tvl);
        setApy(data.apy);
      } catch (err) {
        console.error("API error", err);
      }
    };
    handleUpdateVaultStats();
  }, []);

  const timeLeft = "01:23:45";

  // balance 불러오기
  const fetchBalance = async () => {
    if (account) {
      getBalance([account, "latest"]).then((balance) => {
        const formattedKaiaBalance = Number(
          keiHexToKaiaDecimal(balance as string),
        ).toFixed(4);
        setKaiaBalance(formattedKaiaBalance);
      });
      getErc20TokenBalance(USDTContractAddress, account).then((balance) => {
        console.log(balance);
        const formattedUSDTBalance = Number(
          microUSDTHexToUSDTDecimal(balance as string),
        ).toFixed(2);
        setUsdtBalance(formattedUSDTBalance);
      });
    }
  };

  useEffect(() => {
    fetchBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

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
        {/*<div className="mt-auto">
          {account ? (
            <div className="mx-4 mb-4">
              <ButtonDefault
                theme="primary"
                onClick={() => router.push("/holdings/stake")}
              >
                Stake USDT
              </ButtonDefault>
            </div>
          ) : (
            <WalletButton />
          )}
        </div>*/}
      </main>
    </div>
  );
}
