import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop navigation fixes", () => {
  it("links restock rows to products with load error handling", async () => {
    const text = await readFile("desktop/src/pages/RestockWatches.tsx", "utf8");
    expect(text).toContain("/product/${");
    expect(text).toContain("loadError");
  });

  it("lists hidden pages in the sidebar", async () => {
    const text = await readFile("desktop/src/components/Sidebar.tsx", "utf8");
    expect(text).toContain("/restock-watches");
    expect(text).toContain("/distributor-analysis");
  });

  it("refreshes rates by button and links out-of-stock best price", async () => {
    const rates = await readFile("desktop/src/pages/Rates.tsx", "utf8");
    const detail = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(rates).not.toContain("Pull to refresh");
    expect(detail).toContain("Out of Stock <ExternalLink");
  });
});
