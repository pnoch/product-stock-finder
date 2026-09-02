// Deprecated: prefer @shared/fx. Kept for one release.
// Pure fetch stays in @shared/fx; storage persistence + setExchangeRates stays here.
import { fetchFxRates, FX_TTL_MS } from "@shared/fx";
export { fetchFxRates, FX_TTL_MS };
import { defaultStorage, type Storage } from "./storage";
import { appendFxHistory } from "./fx-history";
import { setExchangeRates } from "./currency";
import type { FxRatesResult } from "./types";

export async function loadFxRates(storage: Storage = defaultStorage): Promise<void> {
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

export function refreshFxRates(storage: Storage = defaultStorage): Promise<void> {
  const doRefresh = async () => {
    const result = await fetchFxRates();
    if (!result || typeof result.fetchedAt !== "number" || result.fetchedAt <= 0) return;
    const stored = await storage.getFxRates();
    if (stored && stored.fetchedAt === result.fetchedAt && ratesEqual(stored.rates, result.rates)) {
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

export async function maybeRefreshFxRates(storage: Storage = defaultStorage): Promise<void> {
  const stored = await storage.getFxRates();
  const jitter = Math.floor(Math.random() * 600_000);
  const fresh =
    stored !== null && stored.fetchedAt > 0 && Date.now() - stored.fetchedAt < FX_TTL_MS + jitter;
  if (!fresh) await refreshFxRates(storage);
}
