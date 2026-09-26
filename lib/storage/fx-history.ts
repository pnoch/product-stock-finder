import type { StorageContext } from "./context";

export interface FxHistory {
  rates: Record<string, (number | null)[]>;
  timestamps: number[];
}

export function createFxHistoryStorage(ctx: StorageContext) {
  const { adapter, KEYS, enqueue } = ctx;

  async function getFxHistory(): Promise<FxHistory | null> {
    try {
      const raw = await adapter.getItem(KEYS.FX_RATE_HISTORY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Validate shapes: a corrupt payload with `timestamps` as a non-array (or
      // `rates` as a non-object) would make sliceFxHistoryByRange's `.filter` /
      // Object.entries throw inside the Rates screen's useMemo (no boundary).
      if (
        !parsed ||
        typeof parsed !== "object" ||
        !parsed.rates ||
        typeof parsed.rates !== "object" ||
        Array.isArray(parsed.rates) ||
        !Array.isArray(parsed.timestamps)
      )
        return null;
      // Each currency must itself be an array: the outer guard alone let
      // `{rates:{USD:7.3}}` through and sliceFxHistoryByRange's `.filter` threw
      // inside the Rates screen's useMemo. Drop invalid series, keep the rest.
      const rates: typeof parsed.rates = {};
      const rawRates = parsed.rates as Record<string, unknown>;
      for (const code of Object.keys(rawRates)) {
        const series = rawRates[code];
        if (Array.isArray(series)) {
          (rates as Record<string, unknown>)[code] = series;
        }
      }
      if (Object.keys(rates).length === 0) return null;
      return { rates, timestamps: parsed.timestamps };
    } catch {
      return null;
    }
  }

  async function saveFxHistory(history: FxHistory): Promise<void> {
    await enqueue(KEYS.FX_RATE_HISTORY, async () => {
      await adapter.setItem(KEYS.FX_RATE_HISTORY, JSON.stringify(history));
    });
  }

  return { getFxHistory, saveFxHistory };
}
