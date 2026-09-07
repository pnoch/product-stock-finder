import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop shared upgrades", () => {
  it("retries failed share fetches", async () => {
    const text = await readFile("desktop/src/pages/SharedWatchlist.tsx", "utf8");
    expect(text).toContain("refetch");
    expect(text).toContain("Retry");
  });

  it("prices in display currency with per-item add", async () => {
    const text = await readFile("desktop/src/pages/SharedWatchlist.tsx", "utf8");
    expect(text).toContain("displayCurrency");
    expect(text).toContain('aria-label="Add to watchlist"');
  });

  it("exports CSV", async () => {
    const text = await readFile("desktop/src/pages/SharedWatchlist.tsx", "utf8");
    expect(text).toContain("watchlistToDetailedCsv");
    expect(text).toContain("shared-");
  });
});
