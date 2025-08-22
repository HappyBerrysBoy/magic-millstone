"use server";

import { callApi } from "../_utils/callApi";
import { PortfolioStats } from "../page";

export default async function getStats(id: string) {
  try {
    const res = await callApi({
      endpoint: `/portfolio/${id}/stats`,
      method: "GET",
    });

    if (res) {
      return res as unknown as PortfolioStats;
    }

    if (res) {
      console.error({ header: "getStats", message: res });
    }
  } catch (e) {
    console.error({ header: "getStats", message: e });
  }

  return null;
}
