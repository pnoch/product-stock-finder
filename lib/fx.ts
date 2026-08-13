import { createTRPCClient } from "./trpc";
import { defaultStorage, type Storage } from "./storage";
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

export async function refreshFxRates(
  storage: Storage = defaultStorage,
): Promise<void> {
  const result = await fetchFxRates();
  if (!result || result.fetchedAt === null) return;
  await storage.saveFxRates({
    rates: result.rates,
    fetchedAt: result.fetchedAt,
  });
  setExchangeRates(result.rates);
}

export async function maybeRefreshFxRates(
  storage: Storage = defaultStorage,
): Promise<void> {
  const stored = await storage.getFxRates();
  const fresh =
    stored !== null &&
    stored.fetchedAt > 0 &&
    Date.now() - stored.fetchedAt < FX_TTL_MS;
  if (!fresh) await refreshFxRates(storage);
}
