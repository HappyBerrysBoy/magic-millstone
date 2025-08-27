import React, { useState } from "react";
import { ChartAreaLinear } from "./Chart";

const TAB_LIST = [
  { key: "apy", label: "APY" },
  { key: "pps", label: "Price per share" },
  { key: "tvl", label: "TVL History" },
];

type ChartPoint = { datetime: string; value: string | number };

type ChartTabsProps = {
  apyData: ChartPoint[];
  ppsData: ChartPoint[];
  tvlData: ChartPoint[];
};

const ChartTabs: React.FC<ChartTabsProps> = ({ apyData, ppsData, tvlData }) => {
  const [selected, setSelected] = useState("apy");

  return (
    <div className="w-full">
      <div className="mb-4 flex gap-[12px] overflow-hidden">
        {TAB_LIST.map((tab) => (
          <button
            key={tab.key}
            className={`flex-1 cursor-pointer border-b-1 py-2 text-[12px] ${selected === tab.key ? "text-primary border-primary" : "border-transparent text-[#ABB4B4]"}`}
            onClick={() => setSelected(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex h-[250px] items-center justify-center">
        {selected === "apy" && (
          <ChartAreaLinear
            data={apyData}
            seriesLabel="Daily APY"
            color="#00E6F2"
          />
        )}
        {selected === "pps" && (
          <ChartAreaLinear
            data={ppsData}
            seriesLabel="Price per share"
            color="#00E6F2"
          />
        )}
        {selected === "tvl" && (
          <ChartAreaLinear
            data={tvlData}
            seriesLabel="TVL History"
            color="#00E6F2"
          />
        )}
      </div>
    </div>
  );
};

export default ChartTabs;
