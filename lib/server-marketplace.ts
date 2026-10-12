import { MAX_MARKETPLACE_URL_LENGTH } from "../shared/const";
import type { MarketplaceResolution } from "../shared/marketplace-url";
import { createTRPCClient } from "./trpc";
import { withTimeout } from "./with-timeout";

export async function fetchMarketplaceResolution(url: string): Promise<MarketplaceResolution> {
  if (url.trim().length > MAX_MARKETPLACE_URL_LENGTH) return { kind: "blocked", reason: "url" };
  try {
    const result = await withTimeout(createTRPCClient().products.resolveMarketplace.query({ url: url.trim() }), 8000);
    return result ?? { kind: "error", reason: "network" };
  } catch {
    return { kind: "error", reason: "network" };
  }
}
