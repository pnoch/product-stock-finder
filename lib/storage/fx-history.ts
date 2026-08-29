import type { StorageContext } from "./context";

export interface FxHistory {
  rates: Record<string, number[]>;
  timestamps: number[];
}

const MAX_POINTS = 90;

export function createFxHistoryStorage(ctx: StorageContext) {
  const { adapter, KEYS, enqueue } = ctx;

  async function getFxHistory(): Promise<FxHistory | null> {
    try {
      const raw = await adapter.getItem(KEYS.FX_RATE_HISTORY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (
        !parsed ||
        typeof parsed !== "object" ||
        !parsed.rates ||
        !parsed.timestamps
      )
        return null;
      return { rates: parsed.rates, timestamps: parsed.timestamps };
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
