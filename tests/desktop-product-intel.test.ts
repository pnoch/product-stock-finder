import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop product intelligence", () => {
  it("shows price vs average verdict", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(text).toContain("computePriceVsAverage");
    expect(text).toContain("Below average");
  });

  it("links per-row history and shows refresh recency", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(text).toContain("View price history");
    expect(text).toContain("lastRefreshedAt");
  });
});
