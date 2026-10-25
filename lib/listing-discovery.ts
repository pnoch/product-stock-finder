import { resolvePrice } from "./price-source";
import { isMarketplaceKey } from "../shared/marketplace-url";
import { isFreshPriceSnapshot } from "./price-freshness";
import { getAllParserIds } from "./scrapers/registry";
import type { DistributorListing } from "./types";

const CONCURRENCY = 3;

export function customProductSlug(modelNumber: string): string {
  const slug = modelNumber
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `custom-${slug || "product"}`;
}

type FetchPrice = typeof resolvePrice;

export interface DiscoverOptions {
  parserIds?: string[];
  productId?: string;
  fetchPrice?: FetchPrice;
  now?: number;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
  onResult?: (distributorId: string, listing: DistributorListing | null, failed: boolean) => Promise<void>;
}

// Searches every distributor for a model number and returns one listing per
// hit. Misses/errors are skipped — discovery is best-effort.
export async function discoverListings(
  modelNumber: string,
  opts: DiscoverOptions = {},
): Promise<DistributorListing[]> {
  if (isMarketplaceKey(modelNumber)) return [];
  const {
    parserIds = getAllParserIds(),
    productId = customProductSlug(modelNumber),
    fetchPrice = resolvePrice,
    now = Date.now(),
    onProgress,
    onResult,
    signal,
  } = opts;

  const found: DistributorListing[] = [];
  let done = 0;
  const total = parserIds.length;

  let next = 0;
  async function worker() {
    while (!signal?.aborted && next < parserIds.length) {
      const distributorId = parserIds[next++];
      let listing: DistributorListing | null = null;
      let failed = false;
      try {
        const result = await fetchPrice(distributorId, modelNumber);
        if (signal?.aborted) return;
        // Stale snapshots would masquerade as fresh discoveries.
        if (result?.snapshot && isFreshPriceSnapshot(result.snapshot, now)) {
          const iso = new Date(now).toISOString();
          listing = {
            distributorId,
            productId,
            price: result.snapshot.price,
            currency: result.snapshot.currency,
            stockStatus: result.snapshot.stockStatus,
            expectedDate: result.snapshot.expectedDate,
            url: result.snapshot.url,
            lastChecked: iso,
            priceHistory: [
              {
                date: iso,
                price: result.snapshot.price,
                currency: result.snapshot.currency,
                stockStatus: result.snapshot.stockStatus,
              },
            ],
          };
          found.push(listing);
        }
      } catch {
        failed = true;
      }
      if (signal?.aborted) return;
      await onResult?.(distributorId, listing, failed);
      if (signal?.aborted) return;
      done += 1;
      onProgress?.(done, total);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, worker));

  return found;
}
