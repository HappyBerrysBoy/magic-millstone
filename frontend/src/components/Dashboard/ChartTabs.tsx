import React, { useState } from "react";
import { ChartAreaLinear } from "./Chart";

const TAB_LIST = [
  { key: "apy", label: "APY" },
  { key: "pps", label: "Price per share" },
  { key: "tvl", label: "TVL History" },
];

const ChartTabs: React.FC = () => {
  const [selected, setSelected] = useState("apy");

  return (
    <div className="w-full">
      {/* 탭 버튼 */}
      <div className="mb-4 flex gap-[12px] overflow-hidden">
        {TAB_LIST.map((tab) => (
          <button
            key={tab.key}
            className={`border-primary flex-1 border-b-1 py-2 text-[12px] ${selected === tab.key ? "text-primary" : "text-[#ABB4B4]"}`}
            onClick={() => setSelected(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {/* 차트 영역 (임시) */}
      <div className="flex h-[250px] items-center justify-center">
        {selected === "apy" && <ChartAreaLinear />}
        {selected === "pps" && <ChartAreaLinear />}
        {selected === "tvl" && <ChartAreaLinear />}
      </div>
    </div>
  );
};

export default ChartTabs;
