import { MAX_UPLOAD_HISTORY_POINTS } from "../../../shared/const";
import type { PricePoint, Product } from "../../../lib/types";

export interface HistoryUploadClient {
  prices: {
    uploadHistory: {
      mutate: (input: {
        distributorId: string;
        modelNumber: string;
        points: PricePoint[];
      }) => Promise<{ accepted: number }>;
    };
  };
}

/**
 * Uploads local price history to the server so it is shared across devices.
 * Mobile calls the equivalent on sign-in (`backfillLocalHistory`); the desktop
 * never did, so history collected locally stayed invisible to the server and to
 * other devices.
 */
export async function backfillLocalHistory(
  client: HistoryUploadClient,
  watchlist: Product[],
): Promise<number> {
  let uploaded = 0;
  for (const product of watchlist) {
    for (const listing of product.listings ?? []) {
      const history = listing.priceHistory ?? [];
      if (history.length === 0) continue;
      // The server rejects an upload over MAX_UPLOAD_HISTORY_POINTS outright;
      // local history can hold more, so send the newest slice.
      const points =
        history.length > MAX_UPLOAD_HISTORY_POINTS
          ? history.slice(-MAX_UPLOAD_HISTORY_POINTS)
          : history;
      try {
        await client.prices.uploadHistory.mutate({
          distributorId: listing.distributorId,
          modelNumber: product.modelNumber,
          points,
        });
        uploaded += 1;
      } catch {
        // Per-listing failures (including a rejected unknown distributor/model)
        // are non-fatal and must not abort the rest of the backfill.
      }
    }
  }
  return uploaded;
}
