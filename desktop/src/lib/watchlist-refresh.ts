import { getApiBaseUrl } from "./api-base";
import { createTRPCClient } from "./trpc";
import { storage } from "../storage";
import { fetchListingsWithTimeout } from "./server-prices";
import { composeLiveListings } from "../../../lib/live-prices";
import { isFreshPriceSnapshot } from "../../../lib/price-freshness";

const MAX_CONCURRENT_SERVER_FETCHES = 3;

export async function fetchServerPricesForWatchlist(
  onProgress?: (done: number, total: number) => void,
): Promise<{ refreshed: number; total: number } | null> {
  if (!getApiBaseUrl()) return null;
  const products = await storage.getWatchlist();
  const jobs = products
    .filter((p) => (p.listings ?? []).length > 0)
    .map((p) => ({
      productId: p.id,
      modelNumber: p.modelNumber,
      listings: p.listings ?? [],
    }));
  const total = jobs.reduce((n, j) => n + j.listings.length, 0);
  if (total === 0) return { refreshed: 0, total: 0 };
  const client = createTRPCClient();
  let refreshed = 0;
  let done = 0;
  let next = 0;
  await Promise.all(
    Array.from(
      { length: Math.min(MAX_CONCURRENT_SERVER_FETCHES, total) },
      async () => {
        while (next < jobs.length) {
          const job = jobs[next];
          next += 1;
          const results = await fetchListingsWithTimeout(
            client,
            job.listings,
            job.modelNumber,
            () => {
              done += 1;
              onProgress?.(done, total);
            },
          );
          if (results.some((r) => r !== null)) {
            const merged = composeLiveListings(job.listings, results);
            await storage.updateProductListings(job.productId, merged);
          }
          refreshed += results.filter((r) =>
            isFreshPriceSnapshot(r?.snapshot),
          ).length;
        }
      },
    ),
  );
  return { refreshed, total };
}
