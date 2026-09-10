import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop search polish", () => {
  it("exports CSV and navigates after add", async () => {
    const settings = await readFile("desktop/src/pages/Settings.tsx", "utf8");
    const search = await readFile("desktop/src/pages/Search.tsx", "utf8");
    expect(settings).toContain("watchlistToCsv");
    expect(search).toContain('navigate("/watchlist")');
  });

  it("prefills manual add and fixes dead ends", async () => {
    const search = await readFile("desktop/src/pages/Search.tsx", "utf8");
    const settings = await readFile("desktop/src/pages/Settings.tsx", "utf8");
    const health = await readFile("desktop/src/pages/Health.tsx", "utf8");
    const restock = await readFile("desktop/src/pages/RestockWatches.tsx", "utf8");
    expect(search).toContain("setManualModel(query");
    expect(settings).not.toContain("play.google.com");
    expect(health).toContain("healthError");
    expect(restock).not.toContain("tap &quot;Watch");
  });
});
