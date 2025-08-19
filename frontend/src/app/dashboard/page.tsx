"use client";
import { useEffect, useState } from "react";
import ChartTabs from "@/components/Dashboard/ChartTabs";
import VaultStats from "@/components/Dashboard/VaultStats";
import Composition from "@/components/Dashboard/Composition";
import { callApi, ApiResponse } from "../_utils/callApi";

type ChartPoint = { datetime: string; value: string | number };
type PortfolioStatus = {
  apy: string | number;
  tvl: string | number;
  dailyApyChart: ChartPoint[];
  pricePerShareChart: ChartPoint[];
  tvlHistoryChart: ChartPoint[];
  composition: Record<string, number>;
};

export default function Dashboard() {
  const [status, setStatus] = useState<PortfolioStatus | null>(null);

  useEffect(() => {
    const handleUpdatePortfolioStatus = async () => {
      const res = await callApi<PortfolioStatus>({
        endpoint: `/portfolio/magic-millstone-usdt/status`,
        method: "GET",
      });
      type MaybeWrapped<T> = ApiResponse<T> | T;
      const maybeWrapped = res as unknown as MaybeWrapped<PortfolioStatus>;
      const data =
        typeof maybeWrapped === "object" && maybeWrapped !== null && "data" in maybeWrapped
          ? (maybeWrapped as ApiResponse<PortfolioStatus>).data
          : (maybeWrapped as PortfolioStatus);
      if (data) setStatus(data);
    };
    handleUpdatePortfolioStatus();
  }, []);

  const palette = [
    "#00FBFF",
    "#768AFF",
    "#E176FF",
    "#FFD376",
    "#63E6BE",
    "#FFA8A8",
  ];
  const compositionData = status
    ? Object.entries(status.composition || {}).map(
        ([protocol, fraction], idx) => ({
          protocol,
          percent: Number(fraction),
          color: palette[idx % palette.length],
        }),
      )
    : [];
  const tvl = status?.tvl ?? "-";
  const apy = status?.apy != null ? `${Number(status.apy).toFixed(2)}%` : "-";
  const timeLeft = "—";

  return (
    <div className="flex min-h-[calc(100vh-148px)] flex-col">
      <main className="mx-auto w-full h-full max-w-md flex flex-col flex-1 gap-[28px] pt-[30px]">
        <VaultStats tvl={tvl} apy={apy} timeLeft={timeLeft} />
        <ChartTabs
          apyData={status?.dailyApyChart || []}
          ppsData={status?.pricePerShareChart || []}
          tvlData={status?.tvlHistoryChart || []}
        />
        <Composition data={compositionData} />
      </main>
    </div>
  );
}
