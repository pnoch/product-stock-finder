import { describe, expect, it, vi } from "vitest";
import { MAX_MARKETPLACE_URL_LENGTH } from "../shared/const";
import { marketplaceResolutionMessage, type MarketplaceResolution } from "../shared/marketplace-url";
const query = vi.hoisted(() => vi.fn());
vi.mock("../lib/trpc", () => ({ createTRPCClient: () => ({ products: { resolveMarketplace: { query } } }) }));
import { fetchMarketplaceResolution } from "../lib/server-marketplace";

describe("marketplace import outcomes", () => {
  it.each<MarketplaceResolution>([
    { kind: "unsupported", reason: "livestream" },
    { kind: "blocked", reason: "url" },
    { kind: "error", reason: "network" },
  ])("preserves $kind without fabricating a product", async (outcome) => {
    query.mockResolvedValue(outcome);
    const result = await fetchMarketplaceResolution("https://th.shp.ee/a");
    expect(result).toEqual(outcome);
    expect(result).not.toHaveProperty("identity");
  });
  it("gives livestream-specific instructions", () => expect(marketplaceResolutionMessage({ kind: "unsupported", reason: "livestream" })).toMatch(/individual product/));
  it("returns a retryable network result rather than generic parsing fallback", async () => {
    query.mockRejectedValue(new Error("offline"));
    expect(await fetchMarketplaceResolution("https://th.shp.ee/a")).toEqual({ kind: "error", reason: "network" });
  });
  it("enforces the shared cap before sending and never truncates a URL into a different target", async () => {
    query.mockClear();
    expect(await fetchMarketplaceResolution("x".repeat(MAX_MARKETPLACE_URL_LENGTH + 1))).toEqual({ kind: "blocked", reason: "url" });
    expect(query).not.toHaveBeenCalled();
  });
});
