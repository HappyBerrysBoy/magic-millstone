"use client";

import { callApi } from "@/app/_utils/callApi";
import { Web3Provider } from "@kaiachain/ethers-ext/v6";
import DappPortalSDK, {
  PaymentProvider,
  WalletType,
} from "@linenext/dapp-portal-sdk";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

type DappPortalContextType = {
  dappPortalSDK: DappPortalSDK | undefined;
  provider: Web3Provider | undefined;
  paymentProvider: PaymentProvider | undefined;
  account: string | undefined;
  walletType: WalletType | undefined | null;
  isConnected: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
};

const DappPortalContext = createContext<DappPortalContextType | null>(null);

export const DappPortalProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // ==================================================
  // DappPortalSDK Initialization
  // ==================================================

  const [dappPortalSDK, setDappPortalSDK] = useState<DappPortalSDK | undefined>(
    undefined,
  );

  const initDappPortalSDK = async () => {
    const sdk = await DappPortalSDK.init({
      clientId: "fde65b92-201f-4cb8-aa96-8d7d16b35a04",
      chainId: process.env.NEXT_PUBLIC_CHAIN_ID as string,
    });
    setDappPortalSDK(sdk);
  };

  useEffect(() => {
    initDappPortalSDK();
  }, []);

  // ==================================================
  // Wallet Provider
  // ==================================================

  const router = useRouter();

  const [provider, setProvider] = useState<Web3Provider | undefined>(undefined);
  const [paymentProvider, setPaymentProvider] = useState<
    PaymentProvider | undefined
  >(undefined);
  const [account, setAccount] = useState<string | undefined>(undefined);
  const [walletType, setWalletType] = useState<WalletType | undefined | null>(
    undefined,
  );
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    const handleProvider = async () => {
      if (dappPortalSDK) {
        const p = dappPortalSDK.getWalletProvider();
        const pp = dappPortalSDK.getPaymentProvider();
        setProvider(new Web3Provider(p));
        setPaymentProvider(pp);
      }

      if (!isConnected) {
        const p = dappPortalSDK?.getWalletProvider();
        p?.disconnectWallet();

        setProvider(undefined);
        setPaymentProvider(undefined);
        setAccount(undefined);
        setWalletType(undefined);
        setIsConnected(false);

        router.refresh();
      }
    };

    handleProvider();
  }, [dappPortalSDK]);

  // ==================================================
  // Connect Wallet
  // =================================================

  const connectWallet = async () => {
    try {
      const p = dappPortalSDK?.getWalletProvider();
      const w3p = new Web3Provider(p);
      const accounts = await w3p.send("eth_requestAccounts", []);
      const pp = dappPortalSDK?.getPaymentProvider();

      setProvider(w3p);
      setPaymentProvider(pp);
      setAccount(accounts[0]);
      setWalletType(p?.getWalletType());
      setIsConnected(true);

      await callApi({
        endpoint: `/user`,
        method: "POST",
        body: {
          address: account,
        },
      });

      router.refresh();
    } catch (error) {
      console.error(error);
      throw error;
    }
  };

  // ==================================================
  // Disconnect Wallet
  // ==================================================

  const disconnectWallet = async () => {
    if (provider) {
      const p = dappPortalSDK?.getWalletProvider();
      p?.disconnectWallet();

      setProvider(undefined);
      setPaymentProvider(undefined);
      setAccount(undefined);
      setWalletType(undefined);
      setIsConnected(false);

      router.refresh();
    }
  };

  const contextValue = useMemo(
    () => ({
      dappPortalSDK,
      provider,
      paymentProvider,
      account,
      walletType,
      isConnected,
      connectWallet,
      disconnectWallet,
    }),
    [dappPortalSDK, provider],
  );

  return (
    <DappPortalContext.Provider value={contextValue}>
      {children}
    </DappPortalContext.Provider>
  );
};

export const useDappPortal = () => {
  const context = useContext(DappPortalContext);
  if (!context) {
    throw new Error("useDappPortal must be used within a DappPortalProvider");
  }
  return context;
};
