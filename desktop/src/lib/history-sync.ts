import { sanitizeHistoryPoints } from "../../../shared/src/history-upload";
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
      // The server rejects the whole payload over MAX_UPLOAD_HISTORY_POINTS or
      // for any single malformed point, so sanitize (filter + trim to newest).
      const points = sanitizeHistoryPoints(history);
      if (points.length === 0) continue;
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
