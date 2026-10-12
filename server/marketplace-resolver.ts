import { MARKETPLACE_REDIRECT_LIMIT } from "../shared/const";
import { parseMarketplaceUrl, type MarketplaceResolution } from "../shared/marketplace-url";
import { fetchPinned, resolvePublicAddresses } from "./product-parse";

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
      await response.body?.cancel();
      if (![301, 302, 303, 307, 308].includes(response.status)) return { kind: "error", reason: "unresolved" };
      const location = response.headers.get("location");
      if (!location) return { kind: "error", reason: "unresolved" };
      current = new URL(location, current).href;
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
