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
    let arr = newRates[code];
    if (arr.length > trimmedTimestamps.length) {
      arr = arr.slice(-MAX_POINTS);
    } else if (arr.length < trimmedTimestamps.length) {
      while (arr.length < trimmedTimestamps.length) {
        arr.unshift(null);
      }
    } else if (arr.length > MAX_POINTS) {
      arr = arr.slice(-MAX_POINTS);
    }
    if (arr.length > MAX_POINTS) arr = arr.slice(-MAX_POINTS);
    newRates[code] = arr;
  }
  return {
    rates: newRates,
    timestamps: trimmedTimestamps,
  };
}

export function getFxChange(
  history: FxHistory,
): Record<string, number | null> {
  const change: Record<string, number | null> = {};
  for (const [code, rates] of Object.entries(history.rates)) {
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
