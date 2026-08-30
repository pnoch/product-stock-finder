import { describe, it, expect, vi } from "vitest";

describe("trending server", () => {
  it("fetchRssFeeds returns parsed items from valid RSS", async () => {
    const mockXml = `<?xml version="1.0"?><rss><channel><item><title>NVIDIA RTX 5090 — $2000 at Newegg</title><link>https://example.com</link></item></channel></rss>`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(mockXml) }));
    const { fetchRssFeeds } = await import("../server/routers/trending");
    const items = await fetchRssFeeds();
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].title).toContain("RTX 5090");
  });

  it("fetchRssFeeds skips failed feeds gracefully", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    const { fetchRssFeeds } = await import("../server/routers/trending");
    const items = await fetchRssFeeds();
    expect(items).toEqual([]);
  });
});

describe("trending cache", () => {
  it("getTrending returns non-expired products", async () => {
    const mockProducts = [
      {
        id: "1",
        name: "DGX Spark",
        brand: "NVIDIA",
        category: "Server",
        estimatedPrice: 3000,
        currency: "USD",
        reason: "Extremely limited supply",
        source: "r/buildapcsales",
        fetchedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockProducts),
    }));
    const { getTrending } = await import("../server/routers/trending");
    const products = await getTrending();
    expect(products.length).toBeGreaterThan(0);
    expect(products[0].name).toBe("DGX Spark");
  });
});
