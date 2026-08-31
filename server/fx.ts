import { EXCHANGE_RATES, setExchangeRates } from "../lib/currency";
import type { FxRatesResult } from "../lib/types";

export const FX_TTL_MS = 60 * 60 * 1000; // 1 hour

interface FxCache {
  rates: Record<string, number>;
  fetchedAt: number;
}

let cache: FxCache | null = null;
let inFlight: Promise<FxCache | null> | null = null;

function providerUrl(): string {
  return process.env.FX_API_URL ?? "https://open.er-api.com/v6/latest/USD";
}

function parseRates(body: unknown): Record<string, number> | null {
  if (!body || typeof body !== "object") return null;
  const rates = (body as { rates?: unknown }).rates;
  if (!rates || typeof rates !== "object" || rates === null) return null;
  const out: Record<string, number> = {};
  for (const [code, value] of Object.entries(
    rates as Record<string, unknown>,
  )) {
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value <= 0 ||
      value > 1e6
    )
      continue;
    out[code] = value;
  }
  return Object.keys(out).length > 0 ? out : null;
}

async function refreshFromProvider(): Promise<FxCache | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(providerUrl(), { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body: unknown = await response.json();
    const rates = parseRates(body);
    if (!rates) return null;
    const next: FxCache = { rates, fetchedAt: Date.now() };
    cache = next;
    setExchangeRates(rates);
    return next;
  } catch (error) {
    console.warn("[Fx] Failed to fetch rates:", error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function refreshSingleFlight(): Promise<FxCache | null> {
  if (inFlight) return inFlight;
  inFlight = refreshFromProvider().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

export async function getFxRates(): Promise<FxRatesResult> {
  if (cache && Date.now() - cache.fetchedAt < FX_TTL_MS) {
    return {
      rates: { ...EXCHANGE_RATES, ...cache.rates },
      fetchedAt: cache.fetchedAt,
    };
  }
  if (cache) {
    void refreshSingleFlight();
    return {
      rates: { ...EXCHANGE_RATES, ...cache.rates },
      fetchedAt: cache.fetchedAt,
    };
  }
  const fetched = await refreshSingleFlight();
  if (fetched) {
    return {
      rates: { ...EXCHANGE_RATES, ...fetched.rates },
      fetchedAt: fetched.fetchedAt,
    };
  }
  return { rates: EXCHANGE_RATES, fetchedAt: null };
}

export function clearFxCache(): void {
  cache = null;
  inFlight = null;
}
