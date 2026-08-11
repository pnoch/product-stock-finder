import type { PricePoint } from "@/lib/types";

export function appendPricePoint(
  history: PricePoint[],
  point: PricePoint,
  maxDays = 90,
  now = new Date().toISOString(),
): PricePoint[] {
  const day = point.date.slice(0, 10);
  const existingIdx = history.findIndex(
    (p) => p.date.slice(0, 10) === day,
  );

  const result =
    existingIdx >= 0
      ? history.map((p, i) => (i === existingIdx ? point : p))
      : [...history, point];

  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - maxDays);
  const cutoffDay = cutoff.toISOString().slice(0, 10);

  return result.filter((p) => p.date.slice(0, 10) >= cutoffDay);
}
