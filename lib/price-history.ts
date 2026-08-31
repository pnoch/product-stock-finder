import type { PricePoint } from "@/lib/types";

export function appendPricePoint(
  history: PricePoint[],
  point: PricePoint,
  maxDays = 90,
  now = new Date().toISOString(),
): PricePoint[] {
  if (Number.isNaN(Date.parse(point.date))) {
    // Drop invalid incoming point; also prune invalid history entries
    return history.filter((p) => !Number.isNaN(Date.parse(p.date)));
  }
  const validHistory = history.filter((p) => !Number.isNaN(Date.parse(p.date)));
  const day = point.date.slice(0, 10);
  const existingIdx = validHistory.findIndex((p) => p.date.slice(0, 10) === day);

  let result: PricePoint[];
  if (existingIdx >= 0) {
    const existing = validHistory[existingIdx];
    // Keep the newer point for the same day (full timestamp, not just day)
    result =
      point.date > existing.date
        ? validHistory.map((p, i) => (i === existingIdx ? point : p))
        : validHistory;
  } else {
    result = [...validHistory, point];
  }

  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - maxDays);
  const cutoffDay = cutoff.toISOString().slice(0, 10);

  return result.filter(
    (p) => !Number.isNaN(Date.parse(p.date)) && p.date.slice(0, 10) >= cutoffDay,
  );
}

export function mergePriceHistory(
  local: PricePoint[],
  server: PricePoint[],
  maxDays = 90,
  now = new Date().toISOString(),
): PricePoint[] {
  const byDay = new Map<string, PricePoint>();
  for (const p of [...local, ...server]) {
    if (Number.isNaN(Date.parse(p.date))) continue;
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
  return merged.filter(
    (p) => !Number.isNaN(Date.parse(p.date)) && p.date.slice(0, 10) >= cutoffDay,
  );
}
