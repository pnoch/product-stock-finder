import { getParserByDistributorId } from "../lib/scrapers/registry";
import {
  createMemoryBreakerStore,
  resilientFetch,
} from "../lib/scrapers/resilient";
import type { PriceSnapshot, ServerPriceResult } from "../lib/types";
import { getCachedPrice, setCachedPrice, listNearExpiry } from "./price-cache";
import {
  getHistory,
  recordHistoryPoint,
  purgeOldHistory,
} from "./price-history";
import { buildCatalogPairs, pickPairsToWarm } from "./catalog-warmer";
import { getAllFetchedAt } from "./price-cache";
import { getProductImage, listProductsMissingImage } from "./product-images";
import { evaluateNotifications } from "./notifications";

export const PRICE_TTL_MS = 60 * 60 * 1000; // 1 hour
const WARMER_INTERVAL_MS = 5 * 60 * 1000; // every 5 min
const WARMER_LEAD_MS = 10 * 60 * 1000; // refresh 10 min before expiry
const CATALOG_WARM_PER_TICK = 3;
const IMAGES_PER_TICK = 2;

const inFlight = new Map<string, Promise<PriceSnapshot | null>>();
const breakerStore = createMemoryBreakerStore();

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
    const outcome = await resilientFetch({ parser, url, state: breakerStore });
    if (outcome.status !== "ok" || !outcome.html) return null;
    const result = parser.parsePrice(outcome.html);
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
  const fresh = cached !== null && Date.now() - cached.fetchedAt < PRICE_TTL_MS;
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

export async function warmCatalogRotation(count: number): Promise<number> {
  const pairs = buildCatalogPairs();
  if (pairs.length === 0) return 0;
  const fetchedRows = await getAllFetchedAt();
  const fetchedAtMap = new Map<string, number>();
  for (const row of fetchedRows) {
    fetchedAtMap.set(`${row.distributorId}:${row.modelNumber}`, row.fetchedAt);
  }
  const toWarm = pickPairsToWarm(pairs, fetchedAtMap, count);
  for (const pair of toWarm) {
    await refreshSingleFlight(pair.distributorId, pair.modelNumber);
  }
  return toWarm.length;
}

export async function warmProductImages(count: number): Promise<number> {
  const missing = await listProductsMissingImage();
  const toGenerate = missing.slice(0, count);
  for (const productId of toGenerate) {
    await getProductImage(productId);
  }
  return toGenerate.length;
}

let warmerTickInFlight = false;

export async function runWarmerTick(): Promise<void> {
  if (warmerTickInFlight) return;
  warmerTickInFlight = true;
  try {
    await refreshNearExpiry(Date.now());
    await warmCatalogRotation(CATALOG_WARM_PER_TICK);
    await warmProductImages(IMAGES_PER_TICK);
    await evaluateNotifications(Date.now());
    await purgeOldHistory(Date.now());
  } catch (error) {
    console.warn("[Prices] Warmer tick failed:", error);
  } finally {
    warmerTickInFlight = false;
  }
}

let warmerTimer: ReturnType<typeof setInterval> | null = null;

export function startWarmer(opts?: { intervalMs?: number }): () => void {
  const intervalMs = opts?.intervalMs ?? WARMER_INTERVAL_MS;
  if (process.env.NODE_ENV === "test") return () => {};
  if (warmerTimer) return () => {};
  warmerTimer = setInterval(() => {
    void runWarmerTick();
  }, intervalMs);
  return () => {
    if (warmerTimer) clearInterval(warmerTimer);
    warmerTimer = null;
  };
}

startWarmer();
