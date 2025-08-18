"use client";

import { create } from "zustand";

type ToastType = "default" | "success" | "error";

type BottomToastState = {
  isOpen: boolean;
  message: string;
  type: ToastType;
  timeoutId: ReturnType<typeof setTimeout> | null;
  show: (message: string, type?: ToastType, durationMs?: number) => void;
  hide: () => void;
};

export const useBottomToastStore = create<BottomToastState>((set, get) => ({
  isOpen: false,
  message: "",
  type: "default",
  timeoutId: null,
  show: (message: string, type: ToastType = "default", durationMs = 1500) => {
    const { timeoutId } = get();
    if (timeoutId) clearTimeout(timeoutId);
    set({ isOpen: true, message, type });
    const id = setTimeout(() => set({ isOpen: false, timeoutId: null }), durationMs);
    set({ timeoutId: id });
  },
  hide: () => {
    const { timeoutId } = get();
    if (timeoutId) clearTimeout(timeoutId);
    set({ isOpen: false, timeoutId: null });
  },
}));


