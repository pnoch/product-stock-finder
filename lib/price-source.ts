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

export async function scrapePriceOnDevice(
  distributorId: string,
  modelNumber: string,
): Promise<ResolvedPrice | null> {
  const parser = getParserByDistributorId(distributorId);
  if (!parser) return null;
  try {
    const url = parser.buildSearchUrl(modelNumber);
    const outcome = await resilientFetch({ parser, url, state: breakerStore });
    if (outcome.status !== "ok" || !outcome.html) return null;
    const result = parser.parsePrice(outcome.html, modelNumber);
    if (!result) return null;
    return {
      snapshot: { ...result, fetchedAt: Date.now() },
      history: [],
      source: "device",
    };
  } catch {
    return null;
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
