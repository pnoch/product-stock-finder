import { isServerConfigured } from "@/constants/oauth";
import { fetchServerPrice } from "@/lib/server-prices";
import { getParserByDistributorId } from "@/lib/scrapers/registry";
import {
  createMemoryBreakerStore,
  resilientFetch,
} from "@/lib/scrapers/resilient";
import type { ServerPriceResult } from "@/lib/types";

export interface ResolvedPrice extends ServerPriceResult {
  source: "server" | "device";
}

const breakerStore = createMemoryBreakerStore();

// Device scrapes are bounded so a product view with many listings doesn't
// fire dozens of simultaneous outbound requests from the phone.
const MAX_CONCURRENT_DEVICE_SCRAPEES = 3;
let activeScrapes = 0;
const scrapeWaiters: Array<() => void> = [];

async function acquireScrapeSlot(): Promise<void> {
  if (activeScrapes < MAX_CONCURRENT_DEVICE_SCRAPEES) {
    activeScrapes += 1;
    return;
  }
  await new Promise<void>((resolve) => scrapeWaiters.push(resolve));
  activeScrapes += 1;
}

function releaseScrapeSlot(): void {
  activeScrapes -= 1;
  const next = scrapeWaiters.shift();
  if (next) next();
}

export async function scrapePriceOnDevice(
  distributorId: string,
  modelNumber: string,
): Promise<ResolvedPrice | null> {
  const parser = getParserByDistributorId(distributorId);
  if (!parser) return null;
  await acquireScrapeSlot();
  try {
    const url = parser.buildSearchUrl(modelNumber);
    const outcome = await resilientFetch({ parser, url, state: breakerStore });
    if (outcome.status !== "ok" || !outcome.html) return null;
    const result = parser.parsePrice(outcome.html, modelNumber, url);
    if (!result) return null;
    return {
      snapshot: { ...result, fetchedAt: Date.now() },
      history: [],
      source: "device",
    };
  } catch {
    return null;
  } finally {
    releaseScrapeSlot();
  }
}

export async function resolvePrice(
  distributorId: string,
  modelNumber: string,
): Promise<ResolvedPrice | null> {
  if (isServerConfigured()) {
    const server = await fetchServerPrice(distributorId, modelNumber);
    if (server) return { ...server, source: "server" };
  }
  return scrapePriceOnDevice(distributorId, modelNumber);
}
