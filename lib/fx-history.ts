import { EXCHANGE_RATES } from "./currency";
import type { FxHistory } from "./storage/fx-history";

const MAX_POINTS = 90;

export function appendFxHistory(
  existing: FxHistory | null,
  rates: Record<string, number>,
  timestamp: number,
): FxHistory {
  if (!existing) {
    const historyRates: Record<string, number[]> = {};
    for (const [code, value] of Object.entries(rates)) {
      historyRates[code] = [value];
    }
    return { rates: historyRates, timestamps: [timestamp] };
  }

  const newRates: Record<string, number[]> = {};
  const allCodes = new Set([
    ...Object.keys(existing.rates),
    ...Object.keys(rates),
  ]);

  for (const code of allCodes) {
    const prev = existing.rates[code] ?? [];
    let newVal = rates[code] ?? prev[prev.length - 1] ?? EXCHANGE_RATES[code];
    if (newVal === undefined) continue;
    if (!Number.isFinite(newVal)) continue;
    newRates[code] = [...prev, newVal];
    if (newRates[code].length > MAX_POINTS) {
      newRates[code] = newRates[code].slice(-MAX_POINTS);
    }
  }

  const newTimestamps = [...existing.timestamps, timestamp];
  return {
    rates: newRates,
    timestamps: newTimestamps.slice(-MAX_POINTS),
  };
}

export function getFxChange(
  history: FxHistory,
): Record<string, number> {
  const change: Record<string, number> = {};
  for (const [code, rates] of Object.entries(history.rates)) {
    if (rates.length < 2) {
      change[code] = 0;
    } else {
      const prev = rates[rates.length - 2];
      const curr = rates[rates.length - 1];
      change[code] = prev !== 0 ? ((curr - prev) / Math.abs(prev)) * 100 : 0;
    }
  }
  return change;
}
