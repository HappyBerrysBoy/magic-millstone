"use server";

import { callApi } from "@/utils/callApi";
import { PortfolioStats } from "../page";

export default async function getStatus(id: string) {
  try {
    const res = await callApi({
      endpoint: `/portfolio/${id}/status`,
      method: "GET",
    });

    if (res) {
      return res as unknown as PortfolioStats;
    }

    if (res) {
      console.error({ header: "getStatus", message: res });
    }
  } catch (e) {
    console.error({ header: "getStatus", message: e });
  }

  return null;
}
