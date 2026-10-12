import { MAX_MARKETPLACE_URL_LENGTH } from "./const";

export interface ShopeeIdentity {
  platform: "shopee";
  region: "TH";
  shopId: string;
  itemId: string;
  canonicalUrl: string;
}

export type MarketplaceUrl =
  | { kind: "product"; identity: ShopeeIdentity }
  | { kind: "short_link"; url: string }
  | { kind: "livestream" }
  | { kind: "invalid" };

export type MarketplaceResolution =
  | { kind: "product"; identity: ShopeeIdentity }
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

export function marketplaceResolutionMessage(result: Exclude<MarketplaceResolution, { kind: "product" }>): string {
  if (result.kind === "unsupported") return "This is a Shopee livestream. Share an individual product instead.";
  if (result.kind === "blocked") return "This Shopee link could not be resolved safely. Paste the individual product's canonical URL.";
  return "Couldn't resolve the Shopee link. Try again or paste the individual product's canonical URL.";
}
