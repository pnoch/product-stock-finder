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

  it("buildTrendingPrompt adds the watchlist exclusion when present", async () => {
    const { buildTrendingPrompt } = await import("../server/routers/trending");
    const withList = buildTrendingPrompt(
      [{ title: "Item", link: "u", source: "s" }],
      ["CRS804", "hEX"],
    );
    expect(withList).toContain(
      "Exclude these products already in the user's watchlist: CRS804, hEX",
    );
    const without = buildTrendingPrompt(
      [{ title: "Item", link: "u", source: "s" }],
      [],
    );
    expect(without).not.toContain("Exclude these products");
  });

  it("sanitizeTrendingRows clamps prices and truncates oversized fields", async () => {
    const { sanitizeTrendingRows } = await import("../server/routers/trending");
    const rows = sanitizeTrendingRows([
      {
        name: "x".repeat(300),
        brand: "NVIDIA",
        category: "GPU",
        estimatedPrice: 1e12,
        reason: "r",
        source: "s",
      },
      {
        name: "Cheap",
        brand: "",
        category: "",
        estimatedPrice: -5,
        reason: "",
        source: "",
      },
      {
        name: "NaN price",
        brand: "",
        category: "",
        estimatedPrice: Number.NaN,
        reason: "",
        source: "",
      },
    ]);
    expect(rows[0]!.name).toHaveLength(255);
    expect(rows[0]!.estimatedPrice).toBe("99999999.99");
    expect(rows[1]!.estimatedPrice).toBe("0.00");
    expect(rows[2]!.estimatedPrice).toBe("0.00");
  });
});
