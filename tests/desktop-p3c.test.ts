import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop P3c polish", () => {
  it("retries product load from not-found", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    const states = await readFile(
      "desktop/src/components/product/ProductDetailStates.tsx",
      "utf8",
    );
    expect(states).toContain("Try Again");
    expect(text).toContain("loadProduct");
  });

  it("exports stats as PNG with text fallback", async () => {
    const text = await readFile(
      "desktop/src/hooks/use-stats-actions.ts",
      "utf8",
    );
    const share = await readFile("desktop/src/lib/share.ts", "utf8");
    expect(text).toContain("saveNodeAsPng");
    expect(text).toContain("../lib/share");
    expect(share).toContain("toPng");
    expect(text).toContain("buildWatchlistShareText");
  });
});
