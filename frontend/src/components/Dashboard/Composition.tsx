import React from "react";

type CompositionSlice = {
  protocol: string;
  percent: number;
  color: string;
};

type CompositionProps = {
  data: CompositionSlice[];
};

export default function Composition({ data }: CompositionProps) {
  const total = (data || []).reduce((acc, cur) => acc + cur.percent, 0) || 1;
  return (
    <div className="w-full">
      <div className="mb-[6px] text-left text-base">Composition</div>

      <div className="mb-[12px] text-left text-[10px] text-[#C7D2D3]">
        By Protocol
      </div>
      <div className="mb-[12px] flex h-4 w-full overflow-hidden rounded-[4px] bg-[#232828]">
        {(data || []).map((item) => (
          <div
            key={item.protocol}
            style={{
              width: `${(item.percent / total) * 100}%`,
              backgroundColor: item.color,
            }}
            className="h-full"
          />
        ))}
      </div>
      <div className="flex flex-col flex-wrap gap-x-[16px] gap-y-[8px]">
        {(data || []).map((item) => (
          <div key={item.protocol} className="flex items-center">
            <span
              className="mr-[8px] inline-block h-[10px] w-[10px] rounded-full"
              style={{ backgroundColor: item.color }}
            ></span>
            <span className="text-[10px] text-[#C7D2D3]">{item.protocol}</span>
            <span className="ml-auto text-[10px] text-[#C7D2D3]">
              {(item.percent * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
