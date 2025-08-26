"use client";

import Lottie from "lottie-react";
import magicAnimation from "@/lotties/MM_magictime2.json";

export default function MagicTime2() {
  return (
    <div className="flex min-h-[calc(100vh-124px)] flex-col items-center justify-center gap-[120px] bg-black">
      <Lottie
        animationData={magicAnimation}
        loop={true}
        className="h-[120px] w-[120px]"
      />
      <div className="flex flex-col items-center justify-center">
        <div className="text-primary mb-5 text-center text-3xl font-medium">
          Magic Time
        </div>
        <div className="text-center">
          Processing withdrawal request. <br />
          Unstaking required USDT amount <br />
          from external lending protocols <br />
          and bridging funds back to vault…
        </div>
      </div>
    </div>
  );
}
