// Deprecated: prefer @shared/fx. Kept for one release.
// Pure fetch stays in @shared/fx; storage persistence + setExchangeRates stays here.
import { fetchFxRates, FX_TTL_MS } from "@shared/fx";
export { fetchFxRates, FX_TTL_MS };
import { defaultStorage, type Storage } from "./storage";
import { appendFxHistory } from "./fx-history";
import { setExchangeRates } from "./currency";

export async function loadFxRates(storage: Storage = defaultStorage): Promise<void> {
  const stored = await storage.getFxRates();
  if (stored) setExchangeRates(stored.rates);
}

const refreshInFlight = new WeakMap<Storage, Promise<void>>();

function ratesEqual(a: Record<string, number>, b: Record<string, number>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (!(k in b)) return false;
    if (Math.abs(a[k] - b[k]) >= 1e-6) return false;
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

function deterministicJitter(fetchedAt: number): number {
  // Deterministic hash seeded by fetchedAt so TTL window is stable per fetch.
  // Uses Knuth multiplicative hash variant to spread across [-300k, +300k).
  const hash = (fetchedAt * 9301 + 49297) % 600_000;
  return hash - 300_000;
}

export async function maybeRefreshFxRates(storage: Storage = defaultStorage): Promise<void> {
  const stored = await storage.getFxRates();
  const jitter = stored ? deterministicJitter(stored.fetchedAt) : 0;
  const fresh =
    stored !== null && stored.fetchedAt > 0 && Date.now() - stored.fetchedAt < FX_TTL_MS + jitter;
  if (!fresh) await refreshFxRates(storage);
}
