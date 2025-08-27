export function formatNumberWithCommas(num: string | number): string {
  if (typeof num === "string" && num.trim() === "") return "0";
  const n = typeof num === "number" ? num : Number(num.replace(/,/g, ""));
  if (isNaN(n)) return String(num);
  return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

export const formatBigNumber = (num: number): string => {
  const absNum = Math.abs(num);

  if (absNum >= 1e9) {
    const formatted = (num / 1e9).toFixed(2);
    return formatted.replace(/\.?0+$/, "") + "B";
  } else if (absNum >= 1e6) {
    const formatted = (num / 1e6).toFixed(2);
    return formatted.replace(/\.?0+$/, "") + "M";
  } else if (absNum >= 1e3) {
    const formatted = (num / 1e3).toFixed(2);
    return formatted.replace(/\.?0+$/, "") + "K";
  }

  const formatted = num.toFixed(2);
  return formatted.replace(/\.?0+$/, "");
};

export const clampToDecimals = (n: number, decimals: number) => {
  const f = Math.pow(10, decimals);
  return Math.floor(n * f) / f;
};
