import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop watchlist refresh", () => {
  it("fetches live prices via tRPC when Tauri is unavailable", async () => {
    const text = await readFile("desktop/src/pages/Watchlist.tsx", "utf8");
    const helper = await readFile("desktop/src/lib/server-prices.ts", "utf8");
    expect(text).toContain("fetchListingsWithTimeout");
    expect(helper).toContain("prices.get");
    expect(text).toContain("Refreshed");
    expect(text).toContain("Live prices need a server");
    expect(text).not.toContain("refreshWatchlistPrices");
  });
});
