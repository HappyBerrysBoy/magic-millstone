import React from "react";

interface VaultStatsProps {
  tvl: string | number;
  apy: string | number;
}

const HomeStats: React.FC<VaultStatsProps> = ({ tvl, apy }) => {
  return (
    <div>
      {/* Content */}
      <div className="flex items-center justify-between mb-[28px]">
        <div>
          <div className="mb-[6px] text-[28px] ">${tvl}</div>
          <div className="text-[10px] text-[#C7D2D3] font-normal">Total Value Locked</div>
        </div>
      </div>
      <div>
        <div className="mb-[6px] text-[28px] font-normal">{apy}</div>
        <div className="text-[10px] text-[#C7D2D3]">Next APY (24h)</div>
      </div>
    </div>
  );
};

export default HomeStats;
