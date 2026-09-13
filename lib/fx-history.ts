import type { FxHistory } from "./storage/fx-history";

const MAX_POINTS = 90;

export function appendFxHistory(
  existing: FxHistory | null,
  rates: Record<string, number>,
  timestamp: number,
): FxHistory {
  if (!existing) {
    const historyRates: Record<string, (number | null)[]> = {};
    for (const [code, value] of Object.entries(rates)) {
      historyRates[code] = [value];
    }
    return { rates: historyRates, timestamps: [timestamp] };
  }

  const isDuplicateTs =
    existing.timestamps[existing.timestamps.length - 1] === timestamp;

  const newRates: Record<string, (number | null)[]> = {};
  const allCodes = new Set([
    ...Object.keys(existing.rates),
    ...Object.keys(rates),
  ]);

  for (const code of allCodes) {
    const prev = existing?.rates[code] ?? [];
    const hasIncoming = code in rates;
    const rawVal = rates[code];
    const incomingValid =
      hasIncoming && rawVal !== undefined && Number.isFinite(rawVal);

    if (isDuplicateTs) {
      if (incomingValid) {
        const newVal = rawVal as number;
        newRates[code] =
          prev.length === 0 ? [newVal] : [...prev.slice(0, -1), newVal];
      } else {
        newRates[code] = [...prev];
      }
    } else if (incomingValid) {
      const newVal = rawVal as number;
      let base: (number | null)[] = [...prev];
      if (base.length < existing.timestamps.length) {
        const pad = existing.timestamps.length - base.length;
        for (let i = 0; i < pad; i++) base.push(null);
      }
      newRates[code] = [...base, newVal];
    } else {
      if (!(code in rates)) {
        let base: (number | null)[] = [...prev];
        if (base.length < existing.timestamps.length) {
          const pad = existing.timestamps.length - base.length;
          for (let i = 0; i < pad; i++) base.push(null);
        }
        newRates[code] =
          base.length === 0 ? [null] : [...base, null];
        continue;
      }
      let base: (number | null)[] = [...prev];
      if (base.length < existing.timestamps.length) {
        const pad = existing.timestamps.length - base.length;
        for (let i = 0; i < pad; i++) base.push(null);
      }
      newRates[code] =
        base.length === 0 ? [null] : [...base, null];
    }
  }

  const newTimestamps = isDuplicateTs
    ? [...existing.timestamps]
    : [...existing.timestamps, timestamp];
  const trimmedTimestamps = newTimestamps.slice(-MAX_POINTS);
  for (const code of Object.keys(newRates)) {
    let arr = newRates[code].slice(-trimmedTimestamps.length);
    if (arr.length < trimmedTimestamps.length) {
      const pad = trimmedTimestamps.length - arr.length;
      arr = [...Array(pad).fill(null), ...arr];
    }
    console.assert(
      arr.length === trimmedTimestamps.length,
      `FX invariant violated for ${code}: rates length ${arr.length} !== timestamps length ${trimmedTimestamps.length}`,
    );
    if (arr.length !== trimmedTimestamps.length) {
      throw new Error(
        `FX history invariant violated for ${code}: rates length ${arr.length} !== timestamps length ${trimmedTimestamps.length}`,
      );
    }
    newRates[code] = arr;
  }
  return {
    rates: newRates,
    timestamps: trimmedTimestamps,
  };
}

export function getFxChange(
  history: FxHistory,
): Record<string, number | null> {  const change: Record<string, number | null> = {};
  for (const [code] of Object.entries(history.rates)) {
    const safeRates = (history?.rates[code] ?? []) as (number | null)[];
    if (safeRates.length < 2) {
      change[code] = null;
    } else {
      const prev = safeRates[safeRates.length - 2];
      const curr = safeRates[safeRates.length - 1];
      if (prev === null || curr === null || !Number.isFinite(prev as number) || !Number.isFinite(curr as number)) {
        change[code] = null;
      } else {
        change[code] = (prev as number) !== 0 ? (((curr as number) - (prev as number)) / Math.abs(prev as number)) * 100 : 0;
      }
    }
  }
  return change;
}

// ─── Windowed views (Rates 1W/1M/All toggle) ────────────────────────────────
export type FxWindow = "1W" | "1M" | "All";
export const FX_WINDOWS: FxWindow[] = ["1W", "1M", "All"];

const FX_WINDOW_DAYS: Record<FxWindow, number> = {
  "1W": 7,
  "1M": 30,
  All: 9999,
};

export function sliceFxHistoryByRange(
  history: FxHistory,
  range: FxWindow,
): FxHistory {
  if (range === "All") return history;
  const ts = history.timestamps ?? [];
  if (ts.length === 0) return history;
  const anchor = Math.min(Date.now(), Math.max(...ts));
  const cutoff = anchor - FX_WINDOW_DAYS[range] * 86400000;
  const keep = ts.map((t) => t >= cutoff);
  return {
    rates: Object.fromEntries(
      Object.entries(history.rates ?? {}).map(([code, arr]) => [
        code,
        (arr ?? []).filter((_, i) => keep[i] ?? false),
      ]),
    ),
    timestamps: ts.filter((_, i) => keep[i]),
  };
}

export function getFxWindowChange(
  history: FxHistory,
  range: FxWindow,
): Record<string, number | null> {
  const sliced = sliceFxHistoryByRange(history, range);
  const change: Record<string, number | null> = {};
  for (const [code, arr] of Object.entries(sliced.rates ?? {})) {
    const valid = (arr ?? []).filter(
      (v): v is number => v !== null && Number.isFinite(v),
    );
    if (valid.length < 2) {
      change[code] = null;
      continue;
    }
    const first = valid[0];
    const last = valid[valid.length - 1];
    change[code] =
      first !== 0 ? ((last - first) / Math.abs(first)) * 100 : 0;
  }
  return change;
}
