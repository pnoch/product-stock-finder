import { isPlausiblePrice } from "../shared/const";
import { parseMarketplaceUrl, type ShopeeIdentity } from "../shared/marketplace-url";
import type { DistributorListing, PricePoint, Product } from "./types";
import { parseShopeePrice } from "./scrapers/shopee-th";

export interface MarketplaceRefresh {
  status: "updated" | "login_required" | "unavailable" | "no_price";
  /** True when the observed variant matches the tracked variant (both non-empty, case-insensitive). */
  variantMatched: boolean;
}

export async function refreshMarketplaceListing(
  product: Product,
  deps?: {
    loadHtml?: (url: string) => Promise<string>;
    persist?: (productId: string, listings: DistributorListing[]) => Promise<void>;
    now?: () => string;
  },
): Promise<MarketplaceRefresh> {
  const marketplace = product.marketplace;
  const listing = product.listings[0];
  if (!marketplace || !listing) return { status: "unavailable", variantMatched: false };
  const loadHtml =
    deps?.loadHtml ??
    (async (url: string) => {
      const { getWebViewHost } = await import("./scrapers/webview-host");
      const host = getWebViewHost();
      if (!host) throw new Error("on-device webview renderer unavailable");
      return host.load(url, { timeoutMs: 20000 });
    });
  const persist =
    deps?.persist ??
    (async (productId: string, listings: DistributorListing[]) => {
      const { updateProductListings } = await import("./storage");
      await updateProductListings(productId, listings);
    });
  let html: string;
  try {
    html = await loadHtml(marketplace.canonicalUrl);
  } catch {
    return { status: "unavailable", variantMatched: false };
  }
  const found = parseShopeePrice(html, marketplace.shopId, marketplace.itemId);
  if (!found) {
    const wall = /ต้องเข้าสู่ระบบ|verify\/traffic|is_logged_in=false/.test(html);
    return { status: wall ? "login_required" : "no_price", variantMatched: false };
  }
  const tracked = marketplace.variant.trim().toLowerCase();
  const observed = found.variantName?.trim().toLowerCase() ?? "";
  const variantMatched = tracked.length > 0 && observed.length > 0 && tracked === observed;
  const now = (deps?.now ?? (() => new Date().toISOString()))();
  const point: PricePoint = {
    date: now, price: found.price, currency: "THB",
    stockStatus: found.inStock ? "in_stock" : "out_of_stock",
    priceSource: "manual",
  };
  await persist(product.id, [{
    ...listing, price: found.price, priceSource: "manual", lastChecked: now,
    priceHistory: [...listing.priceHistory, point],
  }]);
  return { status: "updated", variantMatched };
}

export function isAutomaticProduct(product: { marketplace?: unknown; modelNumber?: string }): boolean {
  const marketplace = product.marketplace as { monitoringStatus?: string } | undefined;
  if (marketplace) return marketplace.monitoringStatus === "automatic";
  return !product.modelNumber?.startsWith("shopee-th-");
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
