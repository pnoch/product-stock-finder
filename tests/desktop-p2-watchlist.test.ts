import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop P2 watchlist", () => {
  it("has a share action", async () => {
    const text = await readFile("desktop/src/pages/Watchlist.tsx", "utf8");
    expect(text).toContain("buildWatchlistShareText");
  });

  it("has a check-now price scan", async () => {
    const text = await readFile("desktop/src/pages/Watchlist.tsx", "utf8");
    expect(text).toContain("checkPriceDropsNow");
  });

  it("persists in-stock and price-range filters", async () => {
    const text = await readFile("desktop/src/pages/Watchlist.tsx", "utf8");
    expect(text).toContain("watchlistInStockOnly");
    expect(text).toContain("watchlistPriceRange");
  });

  it("links the empty state to search", async () => {
    const text = await readFile("desktop/src/pages/Watchlist.tsx", "utf8");
    expect(text).toContain('to="/search"');
  });
});
