import { isPlausiblePrice } from "../shared/const";
import { parseMarketplaceUrl, type ShopeeIdentity } from "../shared/marketplace-url";
import type { Product } from "./types";

export function isAutomaticProduct(product: { marketplace?: unknown; modelNumber?: string }): boolean {
  return !product.marketplace && !product.modelNumber?.startsWith("shopee-th-");
}

export function parseManualPrice(raw: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw.trim())) return null;
  const price = Number(raw);
  return isPlausiblePrice(price) ? price : null;
}

export function buildMarketplaceProduct(input: {
  identity: ShopeeIdentity; name: string; variant: string; seller: string; price: string;
}, now = new Date().toISOString()): Product {
  const parsed = parseMarketplaceUrl(input.identity.canonicalUrl);
  if (parsed.kind !== "product" || parsed.identity.shopId !== input.identity.shopId || parsed.identity.itemId !== input.identity.itemId) throw new Error("Invalid Shopee identity");
  const name = input.name.trim();
  const variant = input.variant.trim();
  const seller = input.seller.trim();
  const price = parseManualPrice(input.price);
  if (!name || !variant || !seller || price === null) throw new Error("Enter a name, variant (or Single option), seller and positive THB price.");
  if ([name, variant, seller].some((value) => value.length > 200)) throw new Error("Name, variant and seller must each be at most 200 characters.");
  const key = `shopee-th-${input.identity.shopId}-${input.identity.itemId}`;
  const id = key;
  return {
    id, name, modelNumber: key, brand: "", category: "Other", description: "",
    marketplace: { ...parsed.identity, variant, seller, monitoringStatus: "manual" },
    addedAt: now, isWatched: true,
    listings: [{ distributorId: key, productId: id, price, currency: "THB", stockStatus: "unknown", url: parsed.identity.canonicalUrl,
      priceSource: "manual", lastChecked: now,
      priceHistory: [{ date: now, price, currency: "THB", stockStatus: "unknown", priceSource: "manual" }] }],
  };
}

export function updateMarketplacePrice(product: Product, raw: string, now = new Date().toISOString()): Product {
  const price = parseManualPrice(raw);
  if (!product.marketplace || price === null || product.listings.length !== 1) throw new Error("Enter a positive THB price.");
  return { ...product, listings: product.listings.map((listing) => ({
    ...listing, price, priceSource: "manual", lastChecked: now,
    priceHistory: [...listing.priceHistory, { date: now, price, currency: "THB", stockStatus: listing.stockStatus, priceSource: "manual" }],
  })) };
}
