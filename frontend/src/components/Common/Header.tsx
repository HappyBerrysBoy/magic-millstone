"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWalletAccountStore } from "@/app/hooks/auth.hooks";
import Modal from "@/components/Common/Modal";

const Header: React.FC = () => {
  const router = useRouter();
  const { account } = useWalletAccountStore();
  const [walletOpen, setWalletOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (account) {
      await navigator.clipboard.writeText(account);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }
  };

  return (
    <header className="flex items-center justify-between w-full max-w-md mx-auto px-4 py-3 bg-white shadow-sm sticky top-0 z-20">
      {/* 좌측: 프로필 아이콘 */}
      <button
        className="p-2 rounded-full hover:bg-gray-100"
        onClick={() => router.push("/profile")}
        aria-label="프로필"
      >
        <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-gray-700">
          <circle cx="12" cy="8" r="4" strokeWidth="1.5" />
          <path d="M4 20c0-2.5 3.5-4 8-4s8 1.5 8 4" strokeWidth="1.5" />
        </svg>
      </button>
      <div className="text-lg font-bold text-gray-800 select-none">MAGIC MILLSTONE</div>
      {/* 우측: 지갑 아이콘 */}
      <button
        className="p-2 rounded-full hover:bg-gray-100"
        onClick={() => setWalletOpen(true)}
        aria-label="지갑"
      >
        <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-gray-700">
          <rect x="3" y="7" width="18" height="10" rx="3" strokeWidth="1.5" />
          <circle cx="17" cy="12" r="1" strokeWidth="1.5" />
        </svg>
      </button>
      {/* 지갑 주소 모달 */}
      <Modal open={walletOpen} onClose={() => setWalletOpen(false)}>
        <div className="text-center p-2">
          <div className="mb-2 text-lg font-bold">지갑 주소</div>
          <div className="mb-3 break-all text-gray-700 text-sm bg-gray-100 rounded p-2 select-all">
            {account || "-"}
          </div>
          <button
            className="w-full bg-green-600 text-white rounded-lg py-2 font-semibold flex items-center justify-center gap-2"
            onClick={handleCopy}
            disabled={!account}
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <rect x="8" y="8" width="10" height="12" rx="2" strokeWidth="1.5" />
              <rect x="4" y="4" width="10" height="12" rx="2" strokeWidth="1.5" />
            </svg>
            {copied ? "복사됨!" : "카피"}
          </button>
        </div>
      </Modal>
    </header>
  );
};

export default Header;
