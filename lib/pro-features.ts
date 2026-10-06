// The free/Pro boundary as a single source of truth. Free stays genuinely
// useful (5 products, manual refresh, standalone scraping); Pro unlocks the
// continuous, server-backed experience.

export const FREE_WATCHLIST_LIMIT = 5;

export type ProFeature =
  | "unlimited_watchlist"
  | "background_monitoring"
  | "digests"
  | "server_sync"
  | "bulk_import"
  | "landed_cost_sourcing";

const PRO_FEATURES: ReadonlySet<ProFeature> = new Set<ProFeature>([
  "unlimited_watchlist",
  "background_monitoring",
  "digests",
  "server_sync",
  "bulk_import",
  "landed_cost_sourcing",
]);

export function isProFeature(feature: ProFeature): boolean {
  return PRO_FEATURES.has(feature);
}

/** Whether a free user may add another product at the given watchlist size. */
export function canAddToWatchlist(currentCount: number, isPro: boolean): boolean {
  if (isPro) return true;
  return currentCount < FREE_WATCHLIST_LIMIT;
}
