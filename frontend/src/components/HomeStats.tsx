import { formatBigNumber } from "@/app/_utils/formatFuncs";
import React from "react";

interface VaultStatsProps {
  tvl: string | number;
  apy: string | number;
}

const HomeStats: React.FC<VaultStatsProps> = ({ tvl, apy }) => {
  return (
    <div className="flex w-full items-center justify-center gap-16">
      <div className="flex flex-col items-center">
        <p className="text-mm-gray-light text-base font-medium">TVL</p>
        <p className="text-[40px] font-medium">
          {formatBigNumber(Number(tvl))}
        </p>
      </div>
      <div className="flex flex-col items-center">
        <p className="text-mm-gray-light text-base font-medium">Next APY</p>
        <p className="text-primary text-[40px] font-medium">
          {Number(apy).toFixed(2)} %
        </p>
      </div>
    </div>
  );
};

export default HomeStats;
