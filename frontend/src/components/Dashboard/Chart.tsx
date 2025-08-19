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

export function ChartAreaLinear({ data, seriesLabel, color }: ChartAreaLinearProps) {
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
        <CartesianGrid vertical={false} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" hideLabel />} />
        <Area
          dataKey="desktop"
          type="linear"
          fill="var(--color-desktop)"
          fillOpacity={0.4}
          stroke="var(--color-desktop)"
        />
      </AreaChart>
    </ChartContainer>
  );
}
