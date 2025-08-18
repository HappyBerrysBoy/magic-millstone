"use client";

import { useRouter } from "next/navigation";
import ButtonDefault from "../../_components/ButtonDefault";

export default function HoldingButtons() {
  const router = useRouter();

  return (
    <div className="mt-auto flex flex-col gap-2">
      <ButtonDefault
        theme="primary"
        onClick={() => router.push("/holdings/stake")}
      >
        Stake
      </ButtonDefault>
      <ButtonDefault
        theme="outline"
        onClick={() => router.push("/holdings/withdraw")}
      >
        Withdraw
      </ButtonDefault>
    </div>
  );
}
