'use client';
import { WalletButton } from '@/components/Wallet/Button/WalletButton';
import { useState } from 'react';
import { useWalletAccountStore } from '@/components/Wallet/Account/auth.hooks';

export default function Home() {
  const { account } = useWalletAccountStore();
  const [count, setCount] = useState(0);

  return (
    <div className="flex">
      <main className="">
        {account ? (
          <button className={``} onClick={() => setCount((count) => count + 1)}>
            {count} combo
          </button>
        ) : (
          <WalletButton />
        )}

        <div className="text-red-700 text-4xl">test message</div>
      </main>
    </div>
  );
}
