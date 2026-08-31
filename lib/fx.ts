import { createTRPCClient } from "./trpc";
import { defaultStorage, type Storage } from "./storage";
import { appendFxHistory } from "./fx-history";
import { setExchangeRates } from "./currency";
import type { FxRatesResult } from "./types";

const TIMEOUT_MS = 4000;

export const FX_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function fetchFxRates(): Promise<FxRatesResult | null> {
  try {
    const client = createTRPCClient();
    const result = await Promise.race([
      client.fx.get.query(),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), TIMEOUT_MS),
      ),
    ]);
    if (!result || typeof result.rates !== "object" || result.rates === null) {
      return null;
    }
    return result;
  } catch {
    return null;
  }
}

export async function loadFxRates(
  storage: Storage = defaultStorage,
): Promise<void> {
  const stored = await storage.getFxRates();
  if (stored) setExchangeRates(stored.rates);
}

let refreshInFlight: Promise<void> | null = null;

export function refreshFxRates(
  storage: Storage = defaultStorage,
): Promise<void> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const result = await fetchFxRates();
      if (!result || typeof result.fetchedAt !== "number" || result.fetchedAt <= 0) return;
      await storage.saveFxRates({
        rates: result.rates,
        fetchedAt: result.fetchedAt,
      });
      setExchangeRates(result.rates);
      const existingHistory = await storage.getFxHistory();
      const updatedHistory = appendFxHistory(existingHistory, result.rates, result.fetchedAt);
      await storage.saveFxHistory(updatedHistory);
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export async function maybeRefreshFxRates(
  storage: Storage = defaultStorage,
): Promise<void> {
  const stored = await storage.getFxRates();
  // ±5m jitter to avoid thundering herd on fleet launch, clamped >=0 so fresh never appears stale early
  const jitter = Math.max(0, Math.floor(Math.random() * 300_000) - 100_000);
  const fresh =
    stored !== null &&
    stored.fetchedAt > 0 &&
    Date.now() - stored.fetchedAt < FX_TTL_MS + jitter;
  if (!fresh) await refreshFxRates(storage);
}
