// The free/Pro boundary as a single source of truth. Free stays genuinely
// useful (5 products, manual refresh, standalone scraping); Pro unlocks the
// continuous, server-backed experience.

import { getEntitlementProvider } from "./entitlements";

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

/**
 * Whether the free-tier limits should be enforced at all. Without a billing
 * provider there is nothing to upgrade to, so blocking users would be hostile;
 * limits apply only once a provider can actually sell Pro.
 */
export function shouldEnforceFreeLimits(): boolean {
  return getEntitlementProvider()?.purchase != null;
}
