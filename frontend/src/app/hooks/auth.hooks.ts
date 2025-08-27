"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type WalletAccountState = {
  account: string | null;
  setAccount: (account: string | null) => void;
};

export const useWalletAccountStore = create<WalletAccountState>()(
  persist(
    (set) => ({
      account: null,
      setAccount: (account) => set({ account }),
    }),
    {
      name: "wallet-account", // localStorage 키
      // storage: createJSONStorage(() => sessionStorage), // 세션 유지 원하면 이거 사용
    }
  )
);
