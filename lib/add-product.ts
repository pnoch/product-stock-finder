import { log } from "@shared/log";
import {
  addToWatchlist,
  getWatchlist,
  updateProductListings,
} from "./storage";
import { canAddToWatchlist, shouldEnforceFreeLimits } from "./pro-features";
import { discoverProduct } from "./llm-discovery";
import { rediscoverProduct } from "./manual-add";
import { discoverListings } from "./listing-discovery";
import { productIdentityKey } from "./product-identity";
import type { Product } from "./types";

export type AddProductResult =
  | { status: "added"; product: Product; discovered: number }
  | { status: "duplicate"; product: Product }
  | { status: "paywall" }
  | { status: "not_found" };

async function discoverListingsFor(product: Product): Promise<number> {
  try {
    const { discovered } = await rediscoverProduct({
      storage: { updateProductListings },
      discover: discoverListings,
      productId: product.id,
      modelNumber: product.modelNumber,
    });
    return discovered;
  } catch (e) {
    log.warn("[AddProduct] listing discovery failed", e);
    return 0;
  }
}

/**
 * Adds a catalog product to the watchlist, then discovers its listings.
 * Returns a discriminated result so the screen owns alerts/paywall/navigation.
 */
export async function addCatalogProduct(
  item: Omit<Product, "addedAt" | "isWatched" | "listings">,
  opts: { tags: string[]; isPro: boolean },
): Promise<AddProductResult> {
  const product: Product = {
    ...item,
    addedAt: new Date().toISOString(),
    isWatched: true,
    listings: [],
    tags: opts.tags,
  };
  const watchlist = await getWatchlist();
  if (watchlist.some((p) => p.id === item.id)) {
    return { status: "duplicate", product };
  }
  if (
    shouldEnforceFreeLimits() &&
    !canAddToWatchlist(watchlist.length, opts.isPro)
  ) {
    return { status: "paywall" };
  }
  const added = await addToWatchlist(product);
  if (!added) return { status: "duplicate", product };
  return {
    status: "added",
    product,
    discovered: await discoverListingsFor(product),
  };
}

/**
 * Discovers a product from a free-text query, dedupes by brand+model, then adds
 * it. Discovery errors propagate so the screen can map them with
 * `toDiscoverErrorState`.
 */
export async function discoverAndAddProduct(
  query: string,
  opts: { isPro: boolean },
): Promise<AddProductResult> {
  const result = await discoverProduct(query);
  if (!result) return { status: "not_found" };

  const watchlist = await getWatchlist();
  const identity = productIdentityKey(result.product);
  const existing = watchlist.find((p) =>
    identity
      ? productIdentityKey(p) === identity
      : p.id === result.product.id,
  );
  if (existing) return { status: "duplicate", product: existing };
  if (
    shouldEnforceFreeLimits() &&
    !canAddToWatchlist(watchlist.length, opts.isPro)
  ) {
    return { status: "paywall" };
  }

  const product: Product = {
    ...result.product,
    addedAt: new Date().toISOString(),
    isWatched: true,
    listings: [],
    tags: [],
  };
  const added = await addToWatchlist(product);
  if (!added) return { status: "duplicate", product };
  return {
    status: "added",
    product,
    discovered: await discoverListingsFor(product),
  };
}
