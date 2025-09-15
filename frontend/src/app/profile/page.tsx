"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWalletAccountStore } from "@/app/hooks/auth.hooks";
import { useKaiaWalletSdk } from "@/app/hooks/walletSdk.hooks";
import CopyIcon from "public/svgs/CopyIcon";
import { useBottomToastStore } from "@/app/hooks/bottomToast.hooks";
import ProfileDefaultIcon from "public/svgs/ProfileDefaultIcon";
import ButtonDefault from "@/components/Common/ButtonDefault";
import { testUSDTABI } from "@/abis/testUSDT";
import { ethers } from "ethers";
import { usdtTokenAddress } from "@/utils/tokenAddress";

export default function ProfilePage() {
  const { account, setAccount } = useWalletAccountStore();
  const { disconnectWallet, sendContractTransaction, web3Provider } =
    useKaiaWalletSdk();
  const router = useRouter();
  const showToast = useBottomToastStore((s) => s.show);
  const [isRunningFaucet, setIsRunningFaucet] = useState(false);

  useEffect(() => {
    if (!account) router.replace("/");
  }, [account, router]);

  const handleCopy = async () => {
    if (!account) return;
    try {
      await navigator.clipboard.writeText(account);
      showToast("Copied to clipboard.", "success");
    } catch (_) {
      // noop
    }
  };

  const handleDisconnect = async () => {
    await disconnectWallet();
    setAccount(null);
  };

  const handleFaucet = async () => {
    if (!account || isRunningFaucet) return;

    try {
      setIsRunningFaucet(true);

      const amount = ethers.parseUnits("10000", 6);

      const txHash = await sendContractTransaction(
        usdtTokenAddress,
        testUSDTABI as unknown as unknown[],
        "faucet",
        [amount],
        "faucet(uint256)",
      );


      if (!web3Provider) {
        throw new Error("Web3 provider not available");
      }

      const receipt = await web3Provider.waitForTransaction(txHash as string);

      if (receipt && receipt.status === 1) {
        showToast("Faucet successful!", "success");
        console.log("Faucet successful, receipt:", receipt);
      } else {
        throw new Error("Faucet transaction failed");
      }
    } catch (error: any) {
      console.error("❌ Faucet request failed:", error);
      alert(`Faucet failed: ${error.message || "Unknown error"}`);
    } finally {
      setIsRunningFaucet(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-124px)] pt-[50px]">
      <div className="flex w-full flex-col gap-10">
        <div className="flex flex-col items-center gap-4">
          <ProfileDefaultIcon className="h-[72px] w-[72px]" />
          <p className="text-sm font-medium text-white">@username</p>
        </div>
        <div className="flex w-full flex-col gap-4">
          <p className="text-base font-medium text-white">Wallet</p>
          <div className="flex w-full items-center justify-between">
            <div className="text-[12px] break-all text-white">
              {account || "-"}
            </div>
            <button className="text-[12px] text-white" onClick={handleCopy}>
              <CopyIcon />
            </button>
          </div>
          <ButtonDefault
            theme="primary"
            onClick={handleFaucet}
            disabled={isRunningFaucet}
          >
            {isRunningFaucet ? "Processing..." : "Get 100 Test USDT"}
          </ButtonDefault>
          <button
            className="h-[26px] w-full rounded-[4px] bg-[#808787] text-[10px] text-white"
            onClick={handleDisconnect}
          >
            Disconnect
          </button>
        </div>
      </div>
    </div>
  );
}
