"use client";
import { useEffect, useState } from "react";
import ChartTabs from "@/components/Dashboard/ChartTabs";
import VaultStats from "@/components/Dashboard/VaultStats";
import Composition from "@/components/Dashboard/Composition";
import { ApiResponse } from "../_utils/callApi";
import getStatus from "../_services/getStatus";

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
      const res = await getStatus("magic-millstone-usdt");
      type MaybeWrapped<T> = ApiResponse<T> | T;
      const maybeWrapped = res as unknown as MaybeWrapped<PortfolioStatus>;
      const data =
        typeof maybeWrapped === "object" &&
        maybeWrapped !== null &&
        "data" in maybeWrapped
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
  const apy = status?.apy ?? "-";

  return (
    <div className="flex min-h-[calc(100vh-124px)] flex-col pt-[50px]">
      <main className="mx-auto flex h-full w-full max-w-md flex-1 flex-col gap-[28px]">
        <VaultStats tvl={tvl} apy={apy} />
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
