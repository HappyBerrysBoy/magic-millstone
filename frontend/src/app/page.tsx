"use client";
import { WalletButton } from "@/components/Button/WalletButton";
import { useState, useEffect } from "react";
import { useWalletAccountStore } from "@/app/hooks/auth.hooks";
import { useKaiaWalletSdk } from "@/app/hooks/walletSdk.hooks";
import Modal from "@/components/Common/Modal";
import DepositForm from "@/components/DepositForm";
import { keiHexToKaiaDecimal, microUSDTHexToUSDTDecimal } from "@/utils/format";
import Image from "next/image";
import VaultStats from "@/components/Dashboard/VaultStats";
import HomeStats from "@/components/HomeStats";
import NextMagicTime from "@/components/NextMagicTime";
import { time } from "console";
import ButtonDefault from "@/app/_components/ButtonDefault";
import { useRouter } from "next/navigation";

const USDTContractAddress = "0xf6A77faA9d860a9218E0ab02Ac77AEe03c027372";

export default function Home() {
  const { account } = useWalletAccountStore();
  const { getBalance, getErc20TokenBalance } = useKaiaWalletSdk();
  const [kaiaBalance, setKaiaBalance] = useState<number | string>("-");
  const [usdtBalance, setUsdtBalance] = useState<number | string>("-");
  const [depositOpen, setDepositOpen] = useState(false);
  const router = useRouter();
  // 임시 데이터
  const tvl = "1,234,567";
  const apy = "8.5%";
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

  const handleStake = async (amount: number) => {
    // TODO: 실제 deposit 로직으로 대체
    // await deposit(amount);
    // setDepositOpen(false);
    // await fetchBalance(); // 예치 후 잔액 새로고침
    // router.push("/holdings/stake");
  };

  return (
    <div className="flex min-h-[calc(100vh-124px)] flex-col gap-[20px]">
      <header className=" flex justify-center">
        <Image src="/images/MillstoneIcon.png" alt="Magic Millstone" width={20} height={20} />
        {/* <span className="text-primary">MagicMillstone</span> */}
      </header>
      <main className="mx-auto w-full max-w-md flex flex-1 flex-col">
        <HomeStats tvl={tvl} apy={apy} />
        <div className="mt-[60px]">
          <NextMagicTime timeLeft={timeLeft} />
        </div>
        <div className="mt-auto">
          {account ? (
            <div className="mx-4 mb-4">
              <ButtonDefault theme="primary" onClick={() => router.push("/holdings/stake")}>Stake USDT</ButtonDefault>
            </div>
          ) : (
            <WalletButton />
          )}
        </div>
      </main>
    </div>
  );
}
