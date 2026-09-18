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
