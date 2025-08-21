"use client";

import ButtonBack from "@/app/_components/ButtonBack";
import Stake from "../_components/Stake";
import { useRouter } from "next/navigation";

export default function StakePage() {
  const router = useRouter();

  // balance 불러오기

  return (
    <div className="flex min-h-[calc(100vh-148px)] flex-col gap-[20px]">
      <ButtonBack onClick={() => router.back()} />
      <Stake />
    </div>
  );
}
