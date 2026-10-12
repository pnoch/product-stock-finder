import { MARKETPLACE_REDIRECT_LIMIT } from "../shared/const";
import { parseMarketplaceUrl, type MarketplaceIdentity, type MarketplaceResolution } from "../shared/marketplace-url";
import { fetchPinned, readCapped, resolvePublicAddresses } from "./product-parse";

const LAZADA_SHORT_HOST = "s.lazada.co.th";
const LANDING_HTML_CAP = 500_000;

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
  deps = { fetchPinned, resolvePublicAddresses },
): Promise<MarketplaceResolution> {
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
