"use client";

import { useWalletAccountStore } from "@/app/hooks/auth.hooks";
import { useKaiaWalletSdk } from "@/app/hooks/walletSdk.hooks";
import DepositForm from "@/components/DepositForm";
import { keiHexToKaiaDecimal, microUSDTHexToUSDTDecimal } from "@/utils/format";
import { useEffect, useState } from "react";

const USDTContractAddress = "0xf6A77faA9d860a9218E0ab02Ac77AEe03c027372";

export default function StakePage() {
  const { account } = useWalletAccountStore();
  const { getBalance, getErc20TokenBalance } = useKaiaWalletSdk();
  const [kaiaBalance, setKaiaBalance] = useState<number | string>("-");
  const [usdtBalance, setUsdtBalance] = useState<number | string>("-");
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
    <div>
      <header className="mb-[8px] flex h-14 items-center">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="flex items-center"
        >
          <svg
            width="24"
            height="24"
            fill="none"
            viewBox="0 0 24 24"
            className="text-primary"
          >
            <path
              d="M15 19l-7-7 7-7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </header>
      <DepositForm balance={Number(usdtBalance)} onStake={handleStake} />
    </div>
  );
}
