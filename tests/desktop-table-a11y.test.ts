import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop table accessibility", () => {
  it("exposes virtual row position", async () => {
    const text = await readFile("desktop/src/pages/Watchlist.tsx", "utf8");
    const body = await readFile(
      "desktop/src/components/watchlist/WatchlistTableBody.tsx",
      "utf8",
    );
    expect(text).toContain("aria-rowcount");
    expect(body).toContain("aria-rowindex");
  });

  it("exposes sort, trend, and toggle states", async () => {
    const header = await readFile(
      "desktop/src/components/watchlist/WatchlistTableHeader.tsx",
      "utf8",
    );
    const row = await readFile(
      "desktop/src/components/watchlist/WatchlistRow.tsx",
      "utf8",
    );
    const filters = await readFile(
      "desktop/src/components/watchlist/WatchlistFilters.tsx",
      "utf8",
    );
    expect(header).toContain("aria-sort");
    expect(row).toContain("Trend ");
    expect(filters).toContain("aria-pressed");
  });
});
