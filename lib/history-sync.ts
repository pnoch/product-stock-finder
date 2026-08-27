import { isServerConfigured } from "@/constants/oauth";
import { getWatchlist } from "./storage";
import { uploadServerHistory } from "./server-prices";

export async function backfillLocalHistory(): Promise<number> {
  if (!isServerConfigured()) return 0;
  try {
    const watchlist = await getWatchlist();
    let uploaded = 0;
    for (const product of watchlist) {
      for (const listing of product.listings ?? []) {
        if (listing.priceHistory.length === 0) continue;
        uploaded += 1;
        try {
          await uploadServerHistory(
            listing.distributorId,
            product.modelNumber,
            listing.priceHistory,
          );
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
