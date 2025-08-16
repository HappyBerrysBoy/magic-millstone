export function formatNumberWithCommas(num: string | number): string {
    if (typeof num === "string" && num.trim() === "") return "0";
    const n = typeof num === "number" ? num : Number(num.replace(/,/g, ""));
    if (isNaN(n)) return String(num);
    return n.toLocaleString("en-US");
  }