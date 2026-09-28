import { isServerConfigured } from "@/constants/oauth";
import { isFreshPriceSnapshot } from "@/lib/price-freshness";
import { fetchServerPrice } from "@/lib/server-prices";
import { getParserByDistributorId } from "@/lib/scrapers/registry";
import {
  createMemoryBreakerStore,
  fetchAndParse,
} from "@/lib/scrapers/resilient";
import type { ServerPriceResult } from "@/lib/types";
import { createSemaphore } from "@/lib/concurrency";

export interface ResolvedPrice extends ServerPriceResult {
  source: "server" | "device";
}

const breakerStore = createMemoryBreakerStore();

// Device scrapes are bounded so a product view with many listings doesn't
// fire dozens of simultaneous outbound requests from the phone.
const MAX_CONCURRENT_DEVICE_SCRAPEES = 3;
const scrapeSlots = createSemaphore(MAX_CONCURRENT_DEVICE_SCRAPEES);

export async function scrapePriceOnDevice(
  distributorId: string,
  modelNumber: string,
): Promise<ResolvedPrice | null> {
  const parser = getParserByDistributorId(distributorId);
  if (!parser) return null;
  await scrapeSlots.acquire();
  try {
    const { result } = await fetchAndParse(parser, modelNumber, breakerStore);
    if (!result) return null;
    return {
      snapshot: { ...result, fetchedAt: Date.now() },
      history: [],
      source: "device",
    };
  } catch {
    return null;
  } finally {
    scrapeSlots.release();
  }
}

export async function resolvePrice(
  distributorId: string,
  modelNumber: string,
): Promise<ResolvedPrice | null> {
  let server: ServerPriceResult | null = null;
  if (isServerConfigured()) {
    server = await fetchServerPrice(distributorId, modelNumber);
    // A fresh server snapshot is authoritative.
    if (server && isFreshPriceSnapshot(server.snapshot)) {
      return { ...server, source: "server" };
    }
  }
  // Stale or absent server data: an on-device scrape may still succeed. Returning
  // the stale snapshot here meant the distributor was silently missed — the
  // discovery layer rejects stale snapshots, and the server only *triggers* a
  // background refresh, so the fresh price never arrived in time.
  const device = await scrapePriceOnDevice(distributorId, modelNumber);
  if (device) {
    return server?.history?.length ? { ...device, history: server.history } : device;
  }
  // Nothing fresh on device: a stale server snapshot still beats nothing.
  return server ? { ...server, source: "server" } : null;
}
