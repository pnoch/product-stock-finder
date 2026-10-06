// The free/Pro boundary as a single source of truth. Free stays genuinely
// useful (5 products, manual refresh, standalone scraping); Pro unlocks the
// continuous, server-backed experience.

export const FREE_WATCHLIST_LIMIT = 5;

export const PRO_FEATURES = [
  "unlimited_watchlist",
  "background_monitoring",
  "digests",
  "server_sync",
  "bulk_import",
  "landed_cost_sourcing",
] as const;

export type ProFeature = (typeof PRO_FEATURES)[number];

export function isProFeature(feature: string): feature is ProFeature {
  return (PRO_FEATURES as readonly string[]).includes(feature);
}

/** Whether a free user may add another product at the given watchlist size. */
export function canAddToWatchlist(currentCount: number, isPro: boolean): boolean {
  if (isPro) return true;
  return currentCount < FREE_WATCHLIST_LIMIT;
}
