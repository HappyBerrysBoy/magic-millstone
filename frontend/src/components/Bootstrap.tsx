"use client";

import { ReactNode } from "react";
import {
  useKaiaWalletSecurity,
} from "@/app/hooks/walletSdk.hooks";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export type BootstrapProps = {
  className?: string;
  children?: ReactNode;
};

export const Bootstrap = ({ className, children }: BootstrapProps) => {
  const { isSuccess } = useKaiaWalletSecurity();
  return (
    <>
      <ToastContainer
        position="top-center"
        autoClose={1500}
        hideProgressBar
        closeOnClick
        pauseOnHover={false}
      />
      <div className={className}>{isSuccess && children}</div>
    </>
  );
};
