"use client";

import ButtonBack from "@/app/_components/ButtonBack";
import { useWalletAccountStore } from "@/app/hooks/auth.hooks";
import { useKaiaWalletSdk } from "@/app/hooks/walletSdk.hooks";
import DepositForm from "@/components/DepositForm";
import { keiHexToKaiaDecimal, microUSDTHexToUSDTDecimal } from "@/utils/format";
import { useEffect, useState } from "react";
import Stake from "../_components/Stake";
import ButtonDefault from "@/app/_components/ButtonDefault";
import { useRouter } from "next/navigation";

const USDTContractAddress = "0xf6A77faA9d860a9218E0ab02Ac77AEe03c027372";

export default function StakePage() {
  const { account } = useWalletAccountStore();
  const { getBalance, getErc20TokenBalance } = useKaiaWalletSdk();
  const router = useRouter();
  const [kaiaBalance, setKaiaBalance] = useState<number | string>("-");
  const [usdtBalance, setUsdtBalance] = useState<number | string>("-");
  const [stakeAmount, setStakeAmount] = useState<number>(0);
  const [depositOpen, setDepositOpen] = useState(false);

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
    setDepositOpen(false);
    await fetchBalance(); // 예치 후 잔액 새로고침
  };

  return (
    <div className="flex min-h-[calc(100vh-148px)] flex-col gap-[26px]">
      <ButtonBack onClick={() => router.back()} />
      <div className="flex flex-col gap-16">
        <Stake setStakeAmount={setStakeAmount} />
        <div className="flex flex-col items-center">
          <div className="text-mm-gray-default text-[10px]">
            Next vault settlement in approx.
          </div>
          <div className="text-[16px] text-white">00:00:00</div>
        </div>
      </div>
      <div className="mt-auto flex flex-col gap-2">
        <ButtonDefault theme="primary" onClick={() => alert(`Stake amount: ${stakeAmount}`)}>Stake</ButtonDefault>
        <ButtonDefault
          theme="outline"
          onClick={() => router.push("/holdings")}
        >
          Cancel
        </ButtonDefault>
      </div>
    </div>
  );
}
