"use client";

import { Area, AreaChart, CartesianGrid } from "recharts";

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

type ChartPoint = { datetime: string; value: string | number };

type ChartAreaLinearProps = {
  data: ChartPoint[];
  seriesLabel: string;
  color: string;
};

export function ChartAreaLinear({
  data,
  seriesLabel,
  color,
}: ChartAreaLinearProps) {
  const chartData = (data || []).map((p) => ({
    datetime: p.datetime,
    desktop: Number(p.value),
  }));

  const chartConfig = {
    desktop: {
      label: seriesLabel,
      color,
    },
  } satisfies ChartConfig;

  return (
    <ChartContainer className="h-[250px] w-full" config={chartConfig}>
      <AreaChart accessibilityLayer data={chartData}>
        <CartesianGrid vertical={false} horizontal={false} />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              indicator="dot"
              className="rounded-[4px] border-[1px] bg-black text-[10px] text-[#ABB4B4]"
              labelFormatter={(_, payload) => {
                const iso =
                  payload && Array.isArray(payload)
                    ? (payload[0] as any)?.payload?.datetime
                    : undefined;
                if (!iso) return "";
                const d = new Date(iso);
                const mm = String(d.getMonth() + 1).padStart(2, "0");
                const dd = String(d.getDate()).padStart(2, "0");
                const yyyy = d.getFullYear();
                return `${mm}/${dd}/${yyyy}`;
              }}
            />
          }
        />
        <Area
          dataKey="desktop"
          // type="natural"
          type="linear"
          fill="var(--color-desktop)"
          fillOpacity={0.4}
          stroke="var(--color-desktop)"
        />
      </AreaChart>
    </ChartContainer>
  );
}
