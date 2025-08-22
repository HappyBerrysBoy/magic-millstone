import { formatNumberWithCommas } from "@/app/_utils/formatFuncs";
import React from "react";

interface VaultStatsProps {
  tvl: string | number;
  apy: string | number;
}

const VaultStats: React.FC<VaultStatsProps> = ({ tvl, apy }) => {
  return (
    <div>
      {/* Header */}
      <div className="mb-[12px] text-left text-base">Vault stats</div>
      {/* Content */}
      <div className="mb-[28px] flex items-center justify-between">
        <div>
          <div className="mb-[6px] text-[28px] font-normal">
            ${formatNumberWithCommas(tvl)}
          </div>
          <div className="text-[10px] text-[#C7D2D3]">TVL</div>
        </div>
        <div className="text-[12px] text-[#ABB4B4]">USDT</div>
      </div>
      <div>
        <div className="mb-[6px] text-[28px] font-normal">
          ${Number(apy).toFixed(2)}%
        </div>
        <div className="text-[10px] text-[#C7D2D3]">APY (24h)</div>
      </div>
    </div>
  );
};

export default VaultStats;
