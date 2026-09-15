import { isServerConfigured } from "@/constants/oauth";
import { getWatchlist } from "./storage";
import { uploadServerHistory } from "./server-prices";
import { MAX_UPLOAD_HISTORY_POINTS } from "@/shared/const";

export async function backfillLocalHistory(): Promise<number> {
  if (!isServerConfigured()) return 0;
  try {
    const watchlist = await getWatchlist();
    let uploaded = 0;
    for (const product of watchlist) {
      for (const listing of product.listings ?? []) {
        if (listing.priceHistory.length === 0) continue;
        // The server rejects an upload over MAX_UPLOAD_HISTORY_POINTS outright,
        // and local history can hold up to 500 points. Send the newest slice so
        // the upload succeeds instead of silently failing.
        const points =
          listing.priceHistory.length > MAX_UPLOAD_HISTORY_POINTS
            ? listing.priceHistory.slice(-MAX_UPLOAD_HISTORY_POINTS)
            : listing.priceHistory;
        try {
          const ok = await uploadServerHistory(
            listing.distributorId,
            product.modelNumber,
            points,
          );
          // Count only confirmed uploads, not attempts.
          if (ok) uploaded += 1;
        } catch {
          // swallow per-listing upload errors so one failure doesn't abort the backfill
        }
      }
    }
    return uploaded;
  } catch {
    return 0;
  }
}
