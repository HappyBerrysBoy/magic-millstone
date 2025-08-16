'use client';

import { useRouter } from 'next/navigation';
import ButtonDefault from "../../_components/ButtonDefault";

export default function HoldingButtons() {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-2 mt-auto">
      <ButtonDefault theme="primary">Stake</ButtonDefault>
      <ButtonDefault theme="outline" onClick={() => router.push('/holdings/withdraw')}>Withdraw</ButtonDefault>
    </div>
  );
}