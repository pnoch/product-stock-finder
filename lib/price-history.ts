import type { PricePoint } from "@/lib/types";

export function appendPricePoint(
  history: PricePoint[],
  point: PricePoint,
  maxDays = 90,
  now = new Date().toISOString(),
): PricePoint[] {
  const day = point.date.slice(0, 10);
  const existingIdx = history.findIndex((p) => p.date.slice(0, 10) === day);

  const result =
    existingIdx >= 0
      ? history.map((p, i) => (i === existingIdx ? point : p))
      : [...history, point];

  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - maxDays);
  const cutoffDay = cutoff.toISOString().slice(0, 10);

  return result.filter((p) => p.date.slice(0, 10) >= cutoffDay);
}

export function mergePriceHistory(
  local: PricePoint[],
  server: PricePoint[],
  maxDays = 90,
  now = new Date().toISOString(),
): PricePoint[] {
  const byDay = new Map<string, PricePoint>();
  for (const p of [...local, ...server]) {
    const day = p.date.slice(0, 10);
    const existing = byDay.get(day);
    if (!existing || p.date > existing.date) byDay.set(day, p);
  }
  const merged = [...byDay.values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - maxDays);
  const cutoffDay = cutoff.toISOString().slice(0, 10);
  return merged.filter((p) => p.date.slice(0, 10) >= cutoffDay);
}
