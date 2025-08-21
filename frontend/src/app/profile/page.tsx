"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWalletAccountStore } from "@/app/hooks/auth.hooks";
import { useKaiaWalletSdk } from "@/app/hooks/walletSdk.hooks";
import CopyIcon from "public/svgs/CopyIcon";
import { useBottomToastStore } from "@/app/hooks/bottomToast.hooks";
import ProfileDefaultIcon from "public/svgs/ProfileDefaultIcon";

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
