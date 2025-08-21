import React from "react";

interface VaultStatsProps {
  tvl: string | number;
  apy: string | number;
  timeLeft: string;
}

const VaultStats: React.FC<VaultStatsProps> = ({ tvl, apy, timeLeft }) => {
  return (
    <div>
      {/* Header */}
      <div className="mb-[12px] text-left text-base">Vault stats</div>
      {/* Content */}
      <div className="mb-[28px] flex items-center justify-between">
        <div>
          <div className="mb-[6px] text-[28px] font-normal">${tvl}</div>
          <div className="text-[10px] text-[#C7D2D3]">TVL</div>
        </div>
        <div className="text-[12px] text-[#ABB4B4]">USDT</div>
      </div>
      <div>
        <div className="mb-[6px] text-[28px] font-normal">{apy}%</div>
        <div className="text-[10px] text-[#C7D2D3]">APY (24h)</div>
      </div>
    </div>
  );
};

export default VaultStats;
