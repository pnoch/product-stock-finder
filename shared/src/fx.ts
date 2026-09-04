import type { FxRatesResult } from "@/lib/types";

const TIMEOUT_MS = 4000;

export const FX_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function fetchFxRates(): Promise<FxRatesResult | null> {
  try {
    // Lazily loaded so importing this pure module never pulls the
    // Expo/native tRPC client chain (unimportable in offline unit tests).
    const { createTRPCClient } = await import("@/lib/trpc");
    const client = createTRPCClient();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<null>((resolve) => {
      timeoutId = setTimeout(() => resolve(null), TIMEOUT_MS);
    });
    const fetchPromise = client.fx.get.query();
    fetchPromise.catch(() => {});
    const result = await Promise.race([fetchPromise, timeoutPromise]);
    if (timeoutId) clearTimeout(timeoutId);
    if (!result || typeof result.rates !== "object" || result.rates === null) {
      return null;
    }
    return result;
  } catch {
    return null;
  }
}

// Pure stubs — lib wrapper adds AsyncStorage persistence and setExchangeRates.
export async function loadFxRates(): Promise<void> {}

let lastFetchedAt: number | null = null;
let inFlight: Promise<void> | null = null;

export function refreshFxRates(): Promise<void> {
  const doRefresh = async () => {
    const result = await fetchFxRates();
    if (!result || typeof result.fetchedAt !== "number" || result.fetchedAt <= 0) return;
    lastFetchedAt = result.fetchedAt;
  };
  if (inFlight) return inFlight;
  const promise = doRefresh().finally(() => {
    inFlight = null;
  });
  inFlight = promise;
  return promise;
}

function deterministicJitter(fetchedAt: number): number {
  // Deterministic hash seeded by fetchedAt so TTL window is stable per fetch.
  // Uses Knuth multiplicative hash variant to spread across [-300k, +300k).
  const hash = (fetchedAt * 9301 + 49297) % 600_000;
  return hash - 300_000;
}

export async function maybeRefreshFxRates(): Promise<void> {
  const jitter = lastFetchedAt !== null ? deterministicJitter(lastFetchedAt) : 0;
  const fresh =
    lastFetchedAt !== null &&
    lastFetchedAt > 0 &&
    Date.now() - lastFetchedAt < FX_TTL_MS + jitter;
  if (!fresh) await refreshFxRates();
}
