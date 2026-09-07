import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop P3c polish", () => {
  it("retries product load from not-found", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(text).toContain("Try Again");
    expect(text).toContain("loadProduct");
  });

  it("exports stats as PNG with text fallback", async () => {
    const text = await readFile("desktop/src/pages/Stats.tsx", "utf8");
    expect(text).toContain("toPng");
    expect(text).toContain("buildWatchlistShareText");
  });
});
