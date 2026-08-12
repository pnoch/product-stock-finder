import { getParserByDistributorId } from "../lib/scrapers/registry";
import { fetchWithParser } from "../lib/scrapers/utils";
import type { PriceSnapshot, ServerPriceResult } from "../lib/types";
import {
  getCachedPrice,
  setCachedPrice,
  listNearExpiry,
} from "./price-cache";
import { getHistory, recordHistoryPoint, purgeOldHistory } from "./price-history";

export const PRICE_TTL_MS = 60 * 60 * 1000; // 1 hour
const WARMER_INTERVAL_MS = 5 * 60 * 1000; // every 5 min
const WARMER_LEAD_MS = 10 * 60 * 1000; // refresh 10 min before expiry

const inFlight = new Map<string, Promise<PriceSnapshot | null>>();

function cacheKey(distributorId: string, modelNumber: string): string {
  return `${distributorId}:${modelNumber}`;
}

async function refreshPrice(
  distributorId: string,
  modelNumber: string,
): Promise<PriceSnapshot | null> {
  const parser = getParserByDistributorId(distributorId);
  if (!parser) return null;
  try {
    const url = parser.buildSearchUrl(modelNumber);
    const html = await fetchWithParser(parser, url);
    const result = parser.parsePrice(html);
    if (!result) return null;
    const snapshot: PriceSnapshot = { ...result, fetchedAt: Date.now() };
    await setCachedPrice(distributorId, modelNumber, snapshot);
    await recordHistoryPoint(distributorId, modelNumber, snapshot);
    return snapshot;
  } catch (error) {
    console.warn(
      `[Prices] Scrape failed for ${distributorId}/${modelNumber}:`,
      error,
    );
    return null;
  }
}

function refreshSingleFlight(
  distributorId: string,
  modelNumber: string,
): Promise<PriceSnapshot | null> {
  const key = cacheKey(distributorId, modelNumber);
  const existing = inFlight.get(key);
  if (existing) return existing;
  const promise = refreshPrice(distributorId, modelNumber).finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}

export async function getPrice(
  distributorId: string,
  modelNumber: string,
): Promise<ServerPriceResult> {
  const cached = await getCachedPrice(distributorId, modelNumber);
  const fresh =
    cached !== null && Date.now() - cached.fetchedAt < PRICE_TTL_MS;
  if (!fresh) {
    void refreshSingleFlight(distributorId, modelNumber);
  }
  const history = await getHistory(distributorId, modelNumber);
  return { snapshot: cached, history };
}

export async function refreshNearExpiry(now: number): Promise<void> {
  const entries = await listNearExpiry(now, PRICE_TTL_MS - WARMER_LEAD_MS);
  for (const entry of entries) {
    await refreshSingleFlight(entry.distributorId, entry.modelNumber);
  }
}

let warmerTimer: ReturnType<typeof setInterval> | null = null;

export function startWarmer(opts?: { intervalMs?: number }): () => void {
  const intervalMs = opts?.intervalMs ?? WARMER_INTERVAL_MS;
  if (process.env.NODE_ENV === "test") return () => {};
  if (warmerTimer) return () => {};
  warmerTimer = setInterval(() => {
    void refreshNearExpiry(Date.now());
    void purgeOldHistory(Date.now());
  }, intervalMs);
  return () => {
    if (warmerTimer) clearInterval(warmerTimer);
    warmerTimer = null;
  };
}

startWarmer();