import { PRODUCT_CATALOG } from "@shared/catalog";
import { SAMPLE_LISTINGS } from "@/lib/sample-data";
import { addToWatchlist, getWatchlist } from "@/lib/storage";
import { canAddToWatchlist, shouldEnforceFreeLimits } from "@/lib/pro-features";
import { track } from "@/lib/telemetry";
import type { DistributorListing } from "@/lib/types";

export interface EnsureResult {
  ok: boolean;
  /** True when the free limit blocked the add (caller should show the paywall). */
  paywall: boolean;
}

/**
 * The product detail screen reads the watchlist, so a product discovered from a
 * server feed (trending, available board) must be added before navigating or the
 * detail screen shows "Product not found". Returns whether the caller may
 * proceed, and whether a paywall should be shown.
 */
export async function ensureWatchlistProduct(
  product: { id: string; name: string; brand: string; category: string; modelNumber?: string },
  isPro: boolean,
): Promise<EnsureResult> {
  const catalogProduct = PRODUCT_CATALOG.find((p) => p.id === product.id);
  const modelNumber = catalogProduct?.modelNumber ?? product.modelNumber ?? product.id;
  const existing = await getWatchlist().catch(() => []);
  if (existing.some((p) => p.id === product.id)) return { ok: true, paywall: false };
  if (shouldEnforceFreeLimits() && !canAddToWatchlist(existing.length, isPro)) {
    track("paywall_shown");
    return { ok: false, paywall: true };
  }
  const fallbackListings: DistributorListing[] = SAMPLE_LISTINGS[product.id] ?? [];
  try {
    await addToWatchlist({
      id: product.id,
      name: product.name,
      modelNumber,
      brand: product.brand,
      category: product.category,
      description: catalogProduct?.description ?? "",
      isWatched: true,
      addedAt: new Date().toISOString(),
      listings: fallbackListings,
      tags: [],
    });
  } catch {
    return { ok: false, paywall: false };
  }
  return { ok: true, paywall: false };
}
