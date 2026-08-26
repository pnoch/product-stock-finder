import { resolvePrice } from "./price-source";
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
}

// Searches every distributor for a model number and returns one listing per
// hit. Misses/errors are skipped — discovery is best-effort.
export async function discoverListings(
  modelNumber: string,
  opts: DiscoverOptions = {},
): Promise<DistributorListing[]> {
  const {
    parserIds = getAllParserIds(),
    productId = customProductSlug(modelNumber),
    fetchPrice = resolvePrice,
    now = Date.now(),
    onProgress,
  } = opts;

  const found: DistributorListing[] = [];
  let done = 0;
  const total = parserIds.length;

  for (let i = 0; i < parserIds.length; i += CONCURRENCY) {
    const batch = parserIds.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (distributorId) => {
        try {
          const result = await fetchPrice(distributorId, modelNumber);
          if (result?.snapshot) {
            const iso = new Date(now).toISOString();
            found.push({
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
            });
          }
        } catch {
          // Best-effort: skip failing distributors.
        } finally {
          done += 1;
          onProgress?.(done, total);
        }
      }),
    );
  }

  return found;
}
