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
): Promise<(ServerPriceResult | null)[]> {
  const results: (ServerPriceResult | null)[] = [];
  for (const listing of listings) {
    try {
      results.push(
        await Promise.race([
          client.prices.get.query({
            distributorId: listing.distributorId,
            modelNumber,
          }),
          new Promise<never>((_resolve, reject) =>
            setTimeout(() => reject(new Error("price query timeout")), QUERY_TIMEOUT_MS),
          ),
        ]),
      );
    } catch {
      results.push(null);
    }
    onItem?.();
  }
  return results;
}
