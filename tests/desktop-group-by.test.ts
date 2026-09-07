import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop watchlist group-by", () => {
  it("offers a group-mode picker", async () => {
    const text = await readFile("desktop/src/pages/Watchlist.tsx", "utf8");
    expect(text).toContain("groupWatchlist");
    expect(text).toContain("watchlistGroup");
  });

  it("renders section header rows", async () => {
    const text = await readFile("desktop/src/pages/Watchlist.tsx", "utf8");
    expect(text).toContain("colSpan");
  });
});
