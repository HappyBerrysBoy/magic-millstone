import React from "react";

const COMPOSITION_DATA = [
  { protocol: "AAVE", percent: 40, color: "#00FBFF" },
  { protocol: "Compound", percent: 30, color: "#768AFF" },
  { protocol: "Yearn", percent: 20, color: "#E176FF" },
  { protocol: "Convex", percent: 10, color: "#FFD376" },
];

export default function Composition() {
  return (
    <div className="w-full">
      {/* 헤더 */}
      <div className="mb-[6px] text-left text-base">Composition</div>

      <div className="mb-4 text-left text-[10px] text-[#C7D2D3]">
        By Protocol
      </div>
      {/* 바 차트 */}
      <div className="mb-6 flex h-4 w-full overflow-hidden rounded-[4p] bg-[#232828]">
        {COMPOSITION_DATA.map((item, idx) => (
          <div
            key={item.protocol}
            style={{
              width: `${item.percent}%`,
              backgroundColor: item.color,
            }}
            className="h-full"
          />
        ))}
      </div>
      {/* 프로토콜 라벨 - flex wrap으로 2줄 */}
      <div className="flex flex-wrap gap-[8px]">
        {COMPOSITION_DATA.map((item) => (
          <div
            key={item.protocol}
            className="flex w-[calc(50%-8px)] items-center"
          >
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: item.color }}
            ></span>
            <span className="text-sm text-[#C7D2D3]">{item.protocol}</span>
            <span className="ml-auto text-xs text-[#C7D2D3]">
              {item.percent}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
