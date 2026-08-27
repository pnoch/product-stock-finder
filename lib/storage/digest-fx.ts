import type { DigestSnapshot } from "../price-digest";
import type { StorageContext } from "./context";

export function createDigestFxStorage(ctx: StorageContext) {
  const { adapter, KEYS, enqueue } = ctx;

  // ─── Price Digest Snapshot ──────────────────────────────────────────────────

  async function getPriceDigestSnapshot(): Promise<DigestSnapshot | null> {
    try {
      const raw = await adapter.getItem(KEYS.DIGEST_SNAPSHOT);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async function savePriceDigestSnapshot(
    snapshot: DigestSnapshot,
  ): Promise<void> {
    await enqueue(KEYS.DIGEST_SNAPSHOT, async () => {
      await adapter.setItem(KEYS.DIGEST_SNAPSHOT, JSON.stringify(snapshot));
    });
  }

  // ─── FX Rates ───────────────────────────────────────────────────────────────

  async function getFxRates(): Promise<{
    rates: Record<string, number>;
    fetchedAt: number;
  } | null> {
    try {
      const raw = await adapter.getItem(KEYS.FX_RATES);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as {
        rates?: unknown;
        fetchedAt?: unknown;
      };
      if (!parsed || typeof parsed !== "object" || !parsed.rates) return null;
      const rates: Record<string, number> = {};
      for (const [code, value] of Object.entries(
        parsed.rates as Record<string, unknown>,
      )) {
        if (typeof value === "number" && Number.isFinite(value)) {
          rates[code] = value;
        }
      }
      if (Object.keys(rates).length === 0) return null;
      return {
        rates,
        fetchedAt: typeof parsed.fetchedAt === "number" ? parsed.fetchedAt : 0,
      };
    } catch {
      return null;
    }
  }

  async function saveFxRates(payload: {
    rates: Record<string, number>;
    fetchedAt: number;
  }): Promise<void> {
    await enqueue(KEYS.FX_RATES, async () => {
      await adapter.setItem(KEYS.FX_RATES, JSON.stringify(payload));
    });
  }

  return {
    getPriceDigestSnapshot,
    savePriceDigestSnapshot,
    getFxRates,
    saveFxRates,
  };
}
