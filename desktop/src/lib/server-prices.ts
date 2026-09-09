import type { DistributorListing, ServerPriceResult } from "../../../lib/types";

export const QUERY_TIMEOUT_MS = 20_000;

export interface PriceQueryClient {
  prices: {
    get: {
      query: (input: { distributorId: string; modelNumber: string }) => Promise<ServerPriceResult>;
    };
  };
}

export async function fetchListingsWithTimeout(
  client: PriceQueryClient,
  listings: DistributorListing[],
  modelNumber: string,
  onItem?: () => void,
  timeoutMs: number = QUERY_TIMEOUT_MS,
): Promise<(ServerPriceResult | null)[]> {
  const results: (ServerPriceResult | null)[] = [];
  for (const listing of listings) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      results.push(
        await Promise.race([
          client.prices.get.query({
            distributorId: listing.distributorId,
            modelNumber,
          }),
          new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => reject(new Error("price query timeout")), timeoutMs);
          }),
        ]),
      );
    } catch {
      results.push(null);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
    onItem?.();
  }
  return results;
}
