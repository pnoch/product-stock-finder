import { isServerConfigured } from "@/constants/oauth";
import { getWatchlist } from "./storage";
import { uploadServerHistory } from "./server-prices";
import { sanitizeHistoryPoints } from "@shared/history-upload";

export async function backfillLocalHistory(): Promise<number> {
  if (!isServerConfigured()) return 0;
  try {
    const watchlist = await getWatchlist();
    let uploaded = 0;
    for (const product of watchlist) {
      for (const listing of product.listings ?? []) {
        // Mirror desktop/src/lib/history-sync.ts: a listing restored without
        // history must be skipped, not abort the whole backfill.
        const history = listing.priceHistory ?? [];
        if (history.length === 0) continue;
        // The server rejects the whole payload over MAX_UPLOAD_HISTORY_POINTS
        // or for any single malformed point, so sanitize (filter + trim to the
        // newest) before sending instead of silently losing the listing's
        // history.
        const points = sanitizeHistoryPoints(history);
        if (points.length === 0) continue;
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
