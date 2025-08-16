import React, { useState } from "react";

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
      <div className="flex rounded-lg bg-gray-100 mb-4 overflow-hidden">
        {TAB_LIST.map((tab) => (
          <button
            key={tab.key}
            className={`flex-1 py-2 text-sm font-semibold transition-colors duration-150
              ${selected === tab.key ? "bg-white text-green-600" : "text-gray-500 hover:bg-gray-200"}`}
            onClick={() => setSelected(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {/* 차트 영역 (임시) */}
      <div className="flex h-40 items-center justify-center rounded-lg bg-white shadow text-gray-400">
        {selected === "apy" && <span>APY 차트 (임시)</span>}
        {selected === "pps" && <span>Price per share 차트 (임시)</span>}
        {selected === "tvl" && <span>TVL History 차트 (임시)</span>}
      </div>
    </div>
  );
};

export default ChartTabs;
