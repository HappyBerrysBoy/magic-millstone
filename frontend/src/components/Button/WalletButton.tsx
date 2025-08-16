/* GUIDELINE https://docs.dappportal.io/mini-dapp/design-guide#connect-button */
import styles from "./WalletButton.module.css";
import { Logo } from "public/svgs/Logo";
import { useKaiaWalletSdk } from "@/app/hooks/walletSdk.hooks";
import { useWalletAccountStore } from "@/app/hooks/auth.hooks";
import { errorRetry, successToast } from "@/utils/notifications";

export const WalletButton = () => {
  const { connectAndSign } = useKaiaWalletSdk();

  const { setAccount } = useWalletAccountStore();

  const handleClick = async () => {
    try {
      const [account] = await connectAndSign("connect");
      sessionStorage.setItem("ACCOUNT", account);
      setAccount(account);
    } catch (error: unknown) {
      console.log(error);
    }
  };

  return (
    <button className={styles.root} onClick={handleClick}>
      <Logo className={styles.icon} />
      <p className={styles.description}>connect</p>
    </button>
  );
};
