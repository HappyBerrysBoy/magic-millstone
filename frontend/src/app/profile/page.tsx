"use client";
import Header from "@/components/Common/Header";
import { useWalletAccountStore } from "@/app/hooks/auth.hooks";
import { useKaiaWalletSdk } from "@/app/hooks/walletSdk.hooks";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ProfilePage() {
  const { account } = useWalletAccountStore();
  const { disconnectWallet } = useKaiaWalletSdk();
  const router = useRouter();
  useEffect(() => {
    if (!account) {
      router.replace("/");
    }
  }, [account, router]);

  // TODO: DB 연동 전 더미 데이터
  const nickname = "라인유저";
  const email = "user@line.me";
  const joinedAt = "2024-05-01";

  const handleDisconnectWallet = async () => {
    await disconnectWallet();
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Header />
      <main className="mx-auto w-full max-w-md flex-1 p-4">
        <div className="mt-8 flex flex-col items-center">
          {/* 프로필 이미지 더미 */}
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-200 text-3xl text-gray-400">
            <span>👤</span>
          </div>
          <div className="mb-1 text-xl font-bold">{nickname}</div>
          <div className="mb-2 text-sm text-gray-500">{email}</div>
          <div className="mb-4 text-xs text-gray-400">가입일: {joinedAt}</div>
          <div className="mb-4 w-full rounded-lg bg-white p-4 shadow">
            <div className="mb-1 text-xs text-gray-500">지갑 주소</div>
            <div className="text-sm break-all text-gray-700 select-all">
              {account || "-"}
            </div>
          </div>
          <button
            className="mt-2 w-full rounded-lg bg-red-500 py-2 font-semibold text-white"
            onClick={handleDisconnectWallet}
          >
            로그아웃
          </button>
        </div>
      </main>
    </div>
  );
}
