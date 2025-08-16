"use client";

import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const chartData = [
  { month: "January", desktop: 186 },
  { month: "February", desktop: 305 },
  { month: "March", desktop: 237 },
  { month: "April", desktop: 73 },
  { month: "May", desktop: 209 },
  { month: "June", desktop: 214 },
];

const chartConfig = {
  desktop: {
    label: "Daily APY",
    color: "#00FBFF",
  },
} satisfies ChartConfig;

export function ChartAreaLinear() {
  return (
    <ChartContainer className="h-[250px] w-full" config={chartConfig}>
      <AreaChart accessibilityLayer data={chartData}>
        <CartesianGrid vertical={false} />
       
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent indicator="dot" hideLabel />}
        />
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
