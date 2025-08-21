/* GUIDELINE https://docs.dappportal.io/mini-dapp/design-guide#connect-button */
import styles from "./WalletButton.module.css";
import { Logo } from "public/svgs/Logo";
import { useKaiaWalletSdk } from "@/app/hooks/walletSdk.hooks";
import { useWalletAccountStore } from "@/app/hooks/auth.hooks";
import { callApi } from "@/app/_utils/callApi";

export const WalletButton = () => {
  const { connectAndSign } = useKaiaWalletSdk();

  const { setAccount } = useWalletAccountStore();

  const handleConnect = async () => {
    try {
      const [account] = await connectAndSign("connect");
      sessionStorage.setItem("ACCOUNT", account);
      setAccount(account);
      await callApi({
        endpoint: `/user`,
        method: "POST",
        body: {
          address: account,
        },
      });
    } catch (error: unknown) {
      console.log(error);
    }
  };

  return (
    <button className={styles.root} onClick={handleConnect}>
      <Logo className={styles.icon} />
      <p className={styles.description}>connect</p>
    </button>
  );
};
