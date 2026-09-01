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

const refreshInFlight = new WeakMap<Storage, Promise<void>>();

function ratesEqual(a: Record<string, number>, b: Record<string, number>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  const EPSILON = 1e-9;
  for (const k of aKeys) {
    if (!(k in b)) return false;
    const diff = Math.abs(a[k] - b[k]);
    const maxAbs = Math.max(1, Math.abs(a[k]), Math.abs(b[k]));
    if (diff > EPSILON * maxAbs) return false;
  }
  return true;
}

export function refreshFxRates(
  storage: Storage = defaultStorage,
): Promise<void> {
  const doRefresh = async () => {
    const result = await fetchFxRates();
    if (!result || typeof result.fetchedAt !== "number" || result.fetchedAt <= 0) return;
    const stored = await storage.getFxRates();
    if (
      stored &&
      stored.fetchedAt === result.fetchedAt &&
      ratesEqual(stored.rates, result.rates)
    ) {
      setExchangeRates(result.rates);
      return;
    }
    await storage.saveFxRates({
      rates: result.rates,
      fetchedAt: result.fetchedAt,
    });
    setExchangeRates(result.rates);
    const existingHistory = await storage.getFxHistory();
    const updatedHistory = appendFxHistory(existingHistory, result.rates, result.fetchedAt);
    await storage.saveFxHistory(updatedHistory);
  };

  const existing = refreshInFlight.get(storage);
  if (existing) return existing;
  const promise = doRefresh().finally(() => {
    refreshInFlight.delete(storage);
  });
  refreshInFlight.set(storage, promise);
  return promise;
}

export async function maybeRefreshFxRates(
  storage: Storage = defaultStorage,
): Promise<void> {
  const stored = await storage.getFxRates();
  // 0–5m positive jitter to avoid thundering herd — never expires early
  const jitter = Math.floor(Math.random() * 300_000);
  const fresh =
    stored !== null &&
    stored.fetchedAt > 0 &&
    Date.now() - stored.fetchedAt < FX_TTL_MS + jitter;
  if (!fresh) await refreshFxRates(storage);
}
