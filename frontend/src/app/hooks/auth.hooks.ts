"use client";

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type walletAccountState = {
  account: string | null;
  setAccount: (account: string| null) => void;
};

export const useWalletAccountStore = create<walletAccountState>()(
  persist(
    (set) => ({
      account: null,
      setAccount: (account) => set({ account }),
    }),
    {
      name: "account-storage", // localStorage key
    }
  )
);