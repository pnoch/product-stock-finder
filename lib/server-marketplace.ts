import { MAX_MARKETPLACE_URL_LENGTH } from "../shared/const";
import type { MarketplaceResolution } from "../shared/marketplace-url";
import { createTRPCClient } from "./trpc";
import { withTimeout } from "./with-timeout";
import { EBAY_SEARCH_QUERY_MAX, type EbaySearchResult } from "../shared/ebay-search";
import { isServerConfigured } from "@/constants/oauth";

export async function fetchEbaySearch(query: string): Promise<EbaySearchResult> {
  const trimmed = query.trim();
  if (trimmed.length < 2 || trimmed.length > EBAY_SEARCH_QUERY_MAX) return { kind: "unavailable", reason: "unreadable" };
  if (!isServerConfigured()) return { kind: "unavailable", reason: "not_configured" };
  try {
    return (await withTimeout(createTRPCClient().products.searchEbay.query({ query: trimmed }), 45000)) ?? { kind: "unavailable", reason: "network" };
  } catch { return { kind: "unavailable", reason: "network" }; }
}

export async function fetchMarketplaceResolution(url: string): Promise<MarketplaceResolution> {
  if (url.trim().length > MAX_MARKETPLACE_URL_LENGTH) return { kind: "blocked", reason: "url" };
  try {
    const result = await withTimeout(createTRPCClient().products.resolveMarketplace.query({ url: url.trim() }), 8000);
    return result ?? { kind: "error", reason: "network" };
  } catch {
    return { kind: "error", reason: "network" };
  }
}
