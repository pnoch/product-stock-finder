import { getParserByDistributorId } from "../lib/scrapers/registry";
import {
  createMemoryBreakerStore,
  resilientFetch,
} from "../lib/scrapers/resilient";
import type { PriceSnapshot, ServerPriceResult } from "../lib/types";
import { getCachedPrice, setCachedPrice, listNearExpiry, purgeStalePriceCache } from "./price-cache";
import {
  getHistory,
  recordHistoryPoint,
  purgeOldHistory,
} from "./price-history";
import { buildCatalogPairs, pickPairsToWarm } from "./catalog-warmer";
import { getAllFetchedAt } from "./price-cache";
import { getProductImage, listProductsMissingImage, purgeOrphanedImages } from "./product-images";
import { purgeOrphanedInsights } from "./price-insights";
import { evaluateNotifications } from "./notifications";
import { purgeOldNotificationEvents } from "./notifications";
import { purgeExpiredAuthTokens } from "./db";
import { purgeOldRevokedDevices } from "./devices";
import { PRICE_SNAPSHOT_TTL_MS } from "../shared/const";

export const PRICE_TTL_MS = PRICE_SNAPSHOT_TTL_MS; // 1 hour
const WARMER_INTERVAL_MS = 5 * 60 * 1000; // every 5 min
const WARMER_LEAD_MS = 10 * 60 * 1000; // refresh 10 min before expiry
const CATALOG_WARM_PER_TICK = 3;
const IMAGES_PER_TICK = 2;

const inFlight = new Map<string, Promise<PriceSnapshot | null>>();
const breakerStore = createMemoryBreakerStore();

// `prices.get` is public and triggers a real outbound scrape on a cache miss.
// Per-IP rate limits bound one caller, but rotating IPs could still fan out to
// unbounded concurrent scrapes (each up to 25 distributors). This global
// semaphore caps total in-flight scrapes per process; excess requests queue
// rather than being dropped, and the single-flight map still dedupes identical
// (distributor, model) requests.
const MAX_CONCURRENT_SCRAPES = 6;
let activeScrapes = 0;
const scrapeQueue: Array<() => void> = [];

function acquireScrapeSlot(): Promise<void> {
  if (activeScrapes < MAX_CONCURRENT_SCRAPES) {
    activeScrapes++;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    scrapeQueue.push(() => {
      activeScrapes++;
      resolve();
    });
  });
}

function releaseScrapeSlot(): void {
  activeScrapes--;
  const next = scrapeQueue.shift();
  if (next) next();
}

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
    const result = parser.parsePrice(outcome.html, modelNumber, url);
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
  const promise = acquireScrapeSlot()
    .then(() => refreshPrice(distributorId, modelNumber))
    .finally(() => {
      releaseScrapeSlot();
      inFlight.delete(key);
    });
  inFlight.set(key, promise);
  return promise;
}

export async function getPrice(
  distributorId: string,
  modelNumber: string,
): Promise<ServerPriceResult> {
  const [cached, history] = await Promise.all([
    getCachedPrice(distributorId, modelNumber),
    getHistory(distributorId, modelNumber),
  ]);
  const fresh =
    cached !== null &&
    cached.fetchedAt <= Date.now() &&
    Date.now() - cached.fetchedAt < PRICE_TTL_MS;
  if (!fresh) {
    void refreshSingleFlight(distributorId, modelNumber);
  }
  return { snapshot: cached, history };
}

function pLimit(concurrency: number) {
  const slots = Math.max(1, Math.floor(concurrency) || 1);
  let active = 0;
  const queue: Array<() => void> = [];
  const next = () => {
    active--;
    const fn = queue.shift();
    if (fn) fn();
  };
  return <T>(fn: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const run = () => {
        active++;
        // A synchronous throw must not leak the slot or wedge the queue.
        let result: Promise<T>;
        try {
          result = fn();
        } catch (error) {
          next();
          reject(error);
          return;
        }
        result.then(resolve, reject).finally(next);
      };
      if (active < slots) run();
      else queue.push(run);
    });
}

export { pLimit };

export async function refreshNearExpiry(now: number): Promise<void> {
  const entries = await listNearExpiry(now, PRICE_TTL_MS - WARMER_LEAD_MS);
  const limit = pLimit(3);
  await Promise.all(
    entries.map((entry) =>
      limit(() => refreshSingleFlight(entry.distributorId, entry.modelNumber)),
    ),
  );
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
  const limit = pLimit(3);
  await Promise.all(
    toWarm.map((pair) =>
      limit(() => refreshSingleFlight(pair.distributorId, pair.modelNumber)),
    ),
  );
  return toWarm.length;
}

export async function warmProductImages(count: number): Promise<number> {
  const missing = await listProductsMissingImage();
  const toGenerate = missing.slice(0, count);
  const limit2 = pLimit(3);
  await Promise.all(toGenerate.map((productId) => limit2(() => getProductImage(productId))));
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
    await purgeOldNotificationEvents(Date.now());
    await purgeExpiredAuthTokens(Date.now());
    await purgeOrphanedInsights();
    await purgeOrphanedImages();
    await purgeStalePriceCache(Date.now());
    await purgeOldRevokedDevices(Date.now());
  } catch (error) {
    console.warn("[Prices] Warmer tick failed:", error);
  } finally {
    warmerTickInFlight = false;
  }
}

let warmerTimer: ReturnType<typeof setInterval> | null = null;

// Singleton: a second call while the warmer runs returns a no-op cleanup
// (it does NOT stop the timer — ownership stays with the first caller).
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
