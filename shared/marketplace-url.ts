import { MAX_MARKETPLACE_URL_LENGTH } from "./const";

export interface ShopeeIdentity {
  platform: "shopee";
  region: "TH";
  shopId: string;
  itemId: string;
  canonicalUrl: string;
}

export interface LazadaIdentity {
  platform: "lazada";
  region: "TH";
  itemId: string;
  skuId: string;
  canonicalUrl: string;
}

export interface FacebookIdentity {
  platform: "facebook";
  itemId: string; // digits, no leading zero
  canonicalUrl: string; // https://www.facebook.com/marketplace/item/{itemId}/
}

export type MarketplaceIdentity = ShopeeIdentity | LazadaIdentity | FacebookIdentity;

export function isMarketplaceKey(modelNumber?: string): boolean {
  return typeof modelNumber === "string" &&
    (modelNumber.startsWith("shopee-th-") || modelNumber.startsWith("lazada-th-") || modelNumber.startsWith("fbmp-"));
}

export type MarketplaceUrl =
  | { kind: "product"; identity: MarketplaceIdentity }
  | { kind: "short_link"; url: string }
  | { kind: "livestream" }
  | { kind: "invalid" };

export type MarketplaceResolution =
  | { kind: "product"; identity: MarketplaceIdentity }
  | { kind: "unsupported"; reason: "livestream" }
  | { kind: "blocked"; reason: "url" | "dns" | "redirect_limit" | "redirect_loop" }
  | { kind: "error"; reason: "network" | "unresolved" };

export function parseMarketplaceUrl(raw: string): MarketplaceUrl {
  if (raw.length > MAX_MARKETPLACE_URL_LENGTH || /[\\\s]/.test(raw)) return { kind: "invalid" };
  let url: URL;
  try { url = new URL(raw); } catch { return { kind: "invalid" }; }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return { kind: "invalid" };
  if (url.hostname === "live.shopee.co.th" && url.pathname === "/share") return { kind: "livestream" };
  if (["s.shopee.co.th", "th.shp.ee"].includes(url.hostname) && /^\/[A-Za-z0-9]+\/?$/.test(url.pathname)) {
    return { kind: "short_link", url: url.href };
  }
  if (url.hostname === "s.lazada.co.th" && /^\/s\.[A-Za-z0-9]{1,64}\/?$/.test(url.pathname)) {
    return { kind: "short_link", url: url.href };
  }
  if (url.hostname === "www.lazada.co.th") {
    const lazada = url.pathname.match(/^\/products\/(?:[^/]+-)?i([1-9]\d{0,19})-s([1-9]\d{0,19})\.html\/?$/);
    if (!lazada) return { kind: "invalid" };
    const [, itemId, skuId] = lazada;
    return { kind: "product", identity: { platform: "lazada", region: "TH", itemId, skuId, canonicalUrl: `https://www.lazada.co.th${url.pathname.replace(/\/?$/, "")}` } };
  }
  if (url.hostname === "www.facebook.com" || url.hostname === "web.facebook.com") {
    if (url.hostname === "www.facebook.com") {
      const share = url.pathname.match(/^\/share\/[A-Za-z0-9]{5,32}\/?$/);
      if (share) return { kind: "short_link", url: url.href };
    }
    const item = url.pathname.match(/^\/marketplace\/item\/([1-9]\d{0,19})\/?$/);
    if (item) {
      const [, itemId] = item;
      return { kind: "product", identity: { platform: "facebook", itemId, canonicalUrl: `https://www.facebook.com/marketplace/item/${itemId}/` } };
    }
    return { kind: "invalid" };
  }
  if (url.hostname !== "shopee.co.th") return { kind: "invalid" };
  const match = url.pathname.match(/^\/(?:product|opaanlp)\/([1-9]\d{0,19})\/([1-9]\d{0,19})\/?$/)
    ?? url.pathname.match(/^\/[^/]+-i\.([1-9]\d{0,19})\.([1-9]\d{0,19})\/?$/);
  if (!match) return { kind: "invalid" };
  const [, shopId, itemId] = match;
  return { kind: "product", identity: { platform: "shopee", region: "TH", shopId, itemId, canonicalUrl: `https://shopee.co.th/product/${shopId}/${itemId}` } };
}

export function isShopeeInput(raw: string): boolean {
  return /shopee|shp\.ee/i.test(raw);
}

export function isLazadaInput(raw: string): boolean {
  return /lazada/i.test(raw);
}

export function isFacebookInput(raw: string): boolean {
  return /facebook/i.test(raw);
}

export function isMarketplaceInput(raw: string): boolean {
  return isShopeeInput(raw) || isLazadaInput(raw) || isFacebookInput(raw);
}

export function marketplaceResolutionMessage(result: Exclude<MarketplaceResolution, { kind: "product" }>, platform: MarketplaceIdentity["platform"] = "shopee"): string {
  if (result.kind === "unsupported") return "This is a Shopee livestream. Share an individual product instead.";
  if (platform === "facebook") {
    if (result.kind === "blocked") return "This Facebook Marketplace link could not be resolved safely. Copy the individual Marketplace item link.";
    return "Couldn't resolve the Facebook Marketplace link. Try again or copy the individual Marketplace item link.";
  }
  const brand = platform === "lazada" ? "Lazada" : "Shopee";
  if (result.kind === "blocked") return `This ${brand} link could not be resolved safely. Paste the individual product's canonical URL.`;
  return `Couldn't resolve the ${brand} link. Try again or paste the individual product's canonical URL.`;
}
