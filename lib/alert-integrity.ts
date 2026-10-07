import { median } from "./stats";

export interface PriceAnomaly {
  suspicious: boolean;
  reason?: "far_below_history" | "far_above_history";
  median: number;
  ratio: number;
}

export function checkPriceAnomaly(
  price: number,
  history: number[],
  opts: { lowRatio?: number; highRatio?: number; minPoints?: number } = {},
): PriceAnomaly {
  const lowRatio = opts.lowRatio ?? 0.3;
  const highRatio = opts.highRatio ?? 5;
  const minPoints = opts.minPoints ?? 3;
  const med = median(history);
  if (!Number.isFinite(price) || med <= 0 || history.length < minPoints) {
    return { suspicious: false, median: med, ratio: med > 0 ? price / med : 0 };
  }
  const ratio = price / med;
  if (ratio <= lowRatio) return { suspicious: true, reason: "far_below_history", median: med, ratio };
  if (ratio > highRatio) return { suspicious: true, reason: "far_above_history", median: med, ratio };
  return { suspicious: false, median: med, ratio };
}
