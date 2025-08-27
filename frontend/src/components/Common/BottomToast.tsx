"use client";

import { useBottomToastStore } from "@/app/hooks/bottomToast.hooks";
import { useEffect } from "react";

export default function BottomToast() {
  const { isOpen, message, type, hide } = useBottomToastStore();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hide]);

  return (
    <div
      className={`pointer-events-none fixed left-1/2 z-[60] w-full max-w-sm -translate-x-1/2 px-4 transition-all duration-200 ${
        isOpen ? "bottom-[74px] opacity-100" : "bottom-[50px] opacity-0"
      }`}
    >
      <div
        className={`pointer-events-auto rounded-[10px] px-4 py-3 text-center text-[12px] text-white shadow ${
          type === "success"
            ? "bg-black/90"
            : type === "error"
            ? "bg-black/90"
            : "bg-black/90"
        }`}
        role="status"
      >
        {message}
      </div>
    </div>
  );
}


