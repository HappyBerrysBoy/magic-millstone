"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWalletAccountStore } from "@/app/hooks/auth.hooks";
import { useKaiaWalletSdk } from "@/app/hooks/walletSdk.hooks";
import StarIcon from "public/svgs/StarIcon";
import CopyIcon from "public/svgs/CopyIcon";
import { useBottomToastStore } from "@/app/hooks/bottomToast.hooks";

export default function ProfilePage() {
  const { account, setAccount } = useWalletAccountStore();
  const { disconnectWallet } = useKaiaWalletSdk();
  const router = useRouter();
  const showToast = useBottomToastStore((s) => s.show);

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

  return (
    <div className="flex min-h-[calc(100vh-124px)] flex-col items-center">
      <div className="mt-4 flex items-center justify-center">
        <div className="border-mm-gray-light flex h-[72px] w-[72px] items-center justify-center rounded-full border">
          <StarIcon className="h-[40px] w-[40px]" />
        </div>
      </div>
      <div className="flex w-full justify-baseline">
        <div className="mt-[70px] text-left text-[16px] text-white">Wallet</div>
      </div>

      <div className="mt-4 flex w-full max-w-md items-center justify-between">
        <div className="text-[12px] break-all text-white">{account || "-"}</div>
        <button className="text-[12px] text-white" onClick={handleCopy}>
          <CopyIcon />
        </button>
      </div>

      <button
        className="mt-auto h-[26px] w-full max-w-md rounded-[4px] bg-[#808787] text-[10px] text-white"
        onClick={handleDisconnect}
      >
        Disconnect
      </button>
    </div>
  );
}
