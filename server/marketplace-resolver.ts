import { MARKETPLACE_REDIRECT_LIMIT } from "../shared/const";
import { parseMarketplaceUrl, type MarketplaceIdentity, type MarketplaceResolution } from "../shared/marketplace-url";
import { renderWithBrowser } from "./browser-render";
import { fetchPinned, readCapped, resolvePublicAddresses } from "./product-parse";

const LAZADA_SHORT_HOST = "s.lazada.co.th";
const FB_SHARE_HOST = "www.facebook.com";
const EBAY_SHORT_HOST = "ebay.io";
const FB_RENDER_TIMEOUT_MS = 20_000;
const EBAY_RENDER_TIMEOUT_MS = 20_000;
const LANDING_HTML_CAP = 500_000;

export interface FacebookRenderDeps {
  renderHtml: (url: string) => Promise<string>; // headed browser render
}

interface ResolverDeps {
  fetchPinned: typeof fetchPinned;
  resolvePublicAddresses: typeof resolvePublicAddresses;
  renderHtml?: FacebookRenderDeps["renderHtml"];
}

// Extracts the marketplace item id from a rendered share-link page.
export function parseFacebookShareRender(html: string): string | null {
  const m =
    html.match(/marketplace\/item\/([1-9]\d{0,19})/) ??
    html.match(/"item_id"\s*:\s*"?([1-9]\d{0,19})"?/);
  return m ? m[1]! : null;
}

async function resolveFacebookShare(
  shareUrl: string,
  renderHtml: FacebookRenderDeps["renderHtml"],
): Promise<MarketplaceResolution> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const html = await Promise.race([
      renderHtml(shareUrl),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("facebook render timed out")), FB_RENDER_TIMEOUT_MS);
      }),
    ]);
    const itemId = parseFacebookShareRender(html);
    if (!itemId) return { kind: "error", reason: "unresolved" };
    // Defense in depth: the extracted id must round-trip through the shared
    // parser as a canonical www.facebook.com item URL before it is trusted.
    const validated = parseMarketplaceUrl(`https://www.facebook.com/marketplace/item/${itemId}/`);
    if (validated.kind !== "product" || validated.identity.platform !== "facebook") {
      return { kind: "error", reason: "unresolved" };
    }
    return { kind: "product", identity: validated.identity };
  } catch {
    return { kind: "error", reason: "network" };
  } finally {
    clearTimeout(timer);
  }
}

// Extracts an eBay item id from a final (post-render) item URL, but only when
// the host is the canonical www.ebay.com — a short link could otherwise render
// a lookalike page pointing at another host.
export function parseEbayItemFromUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" || parsed.hostname !== "www.ebay.com") return null;
  const match = parsed.pathname.match(/^\/itm\/(?:[^/]+\/)?([1-9]\d{0,19})\/?$/);
  return match ? match[1]! : null;
}

function ebayFinalUrlFromHtml(html: string): string | null {
  const canonical =
    html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1] ??
    html.match(/<link[^>]+href=["']([^"']+)["'][^>]*rel=["']canonical["']/i)?.[1];
  if (canonical) return canonical;
  const og =
    html.match(/<meta[^>]+property=["']og:url["'][^>]*content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:url["']/i)?.[1];
  if (og) return og;
  const direct = html.match(/https:\/\/www\.ebay\.com\/itm\/[1-9]\d{0,19}/);
  return direct ? direct[0] : null;
}

async function resolveEbayShort(
  shortUrl: string,
  renderHtml: FacebookRenderDeps["renderHtml"],
): Promise<MarketplaceResolution> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const html = await Promise.race([
      renderHtml(shortUrl),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("ebay render timed out")), EBAY_RENDER_TIMEOUT_MS);
      }),
    ]);
    const finalUrl = ebayFinalUrlFromHtml(html);
    const itemId = finalUrl ? parseEbayItemFromUrl(finalUrl) : null;
    if (!itemId) return { kind: "error", reason: "unresolved" };
    // Defense in depth: the extracted id must round-trip through the shared
    // parser as a canonical www.ebay.com item URL before it is trusted.
    const validated = parseMarketplaceUrl(`https://www.ebay.com/itm/${itemId}`);
    if (validated.kind !== "product" || validated.identity.platform !== "ebay") {
      return { kind: "error", reason: "unresolved" };
    }
    return { kind: "product", identity: validated.identity };
  } catch {
    return { kind: "error", reason: "network" };
  } finally {
    clearTimeout(timer);
  }
}

export function parseLazadaLanding(html: string): MarketplaceIdentity | null {
  const appUrl = html.match(/lazada:\/\/th\/d\?[^"'`\s<>]+/i);
  if (appUrl) {
    const query = (appUrl[0].split("?")[1] ?? "").replace(/&amp;/g, "&");
    const itemId = query.match(/(?:^|&)itemId=([1-9]\d{0,19})(?:&|$)/)?.[1];
    const skuId = query.match(/(?:^|&)skuId=([1-9]\d{0,19})(?:&|$)/)?.[1];
    if (itemId && skuId) {
      return {
        platform: "lazada", region: "TH", itemId, skuId,
        canonicalUrl: `https://www.lazada.co.th/products/i${itemId}-s${skuId}.html`,
      };
    }
  }
  const ogUrl =
    html.match(/<meta[^>]+property=["']og:url["'][^>]*content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:url["']/i);
  if (ogUrl) {
    const parsed = parseMarketplaceUrl(ogUrl[1]!.trim());
    if (parsed.kind === "product" && parsed.identity.platform === "lazada") return parsed.identity;
  }
  return null;
}

export async function resolveMarketplaceLink(
  raw: string,
  deps: ResolverDeps = { fetchPinned, resolvePublicAddresses },
): Promise<MarketplaceResolution> {
  const initial = parseMarketplaceUrl(raw.trim());
  if (initial.kind === "short_link" && new URL(initial.url).hostname === FB_SHARE_HOST) {
    return resolveFacebookShare(initial.url, deps.renderHtml ?? renderWithBrowser);
  }
  if (initial.kind === "short_link" && new URL(initial.url).hostname === EBAY_SHORT_HOST) {
    return resolveEbayShort(initial.url, deps.renderHtml ?? renderWithBrowser);
  }
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<MarketplaceResolution>((resolve) => {
    timer = setTimeout(() => { controller.abort(); resolve({ kind: "error", reason: "network" }); }, 6000);
  });
  const resolve = async (): Promise<MarketplaceResolution> => {
    let current = raw.trim();
    const visited = new Set<string>();
    for (let hop = 0; hop <= MARKETPLACE_REDIRECT_LIMIT; hop++) {
      const parsed = parseMarketplaceUrl(current);
      if (parsed.kind === "invalid") return { kind: "blocked", reason: "url" };
      if (parsed.kind === "product") return parsed;
      if (parsed.kind === "livestream") return { kind: "unsupported", reason: "livestream" };
      current = parsed.url;
      if (visited.has(current)) return { kind: "blocked", reason: "redirect_loop" };
      if (hop === MARKETPLACE_REDIRECT_LIMIT) return { kind: "blocked", reason: "redirect_limit" };
      visited.add(current);
      const pinned = await deps.resolvePublicAddresses(new URL(current).hostname);
      if (!pinned) return { kind: "blocked", reason: "dns" };
      if (controller.signal.aborted) return { kind: "error", reason: "network" };
      const response = await deps.fetchPinned(current, {
        redirect: "manual", signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ProductStockFinder/1.0)" },
      }, pinned);
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel();
        const location = response.headers.get("location");
        if (!location) return { kind: "error", reason: "unresolved" };
        current = new URL(location, current).href;
        continue;
      }
      if (response.status === 200 && new URL(current).hostname === LAZADA_SHORT_HOST) {
        const html = await readCapped(response, LANDING_HTML_CAP);
        if (html) {
          const identity = parseLazadaLanding(html);
          if (identity) return { kind: "product", identity };
        }
        return { kind: "error", reason: "unresolved" };
      }
      await response.body?.cancel();
      return { kind: "error", reason: "unresolved" };
    }
    return { kind: "blocked", reason: "redirect_limit" };
  };
  try {
    return await Promise.race([resolve(), deadline]);
  } catch {
    return { kind: "error", reason: "network" };
  } finally {
    clearTimeout(timer);
  }
}
