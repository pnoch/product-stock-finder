import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

// Device QA found that tapping a Trending card (not the Add button) navigated
// to /product/<id>, but product detail resolves products from the local
// watchlist — and trending products come from the server, so they were never
// in it. The screen therefore always showed "Product not found". The card body
// must add the product first (same as the Add button) before navigating.

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("trending card navigation", () => {
  it("adds the product before navigating to its detail", async () => {
    const src = stripComments(
      await readFile("components/home/trending-section.tsx", "utf8"),
    );
    // The press handler must not push a detail route without first ensuring
    // the product is in the watchlist.
    const pressHandler = src.slice(src.indexOf("const handlePress"));
    expect(pressHandler).toMatch(/ensureWatchlistProduct/);
    expect(pressHandler).toMatch(/router\.push\(`\/product\/\$\{product\.id\}`\)/);
  });

  it("shares one add path between the Add button and the card body", async () => {
    const src = stripComments(
      await readFile("components/home/trending-section.tsx", "utf8"),
    );
    expect(src).toMatch(/const ensureWatchlistProduct = useCallback/);
    // The section's Add handler (not the row's handleAddPress) must route
    // through the shared helper.
    const addStart = src.indexOf("const handleAdd = useCallback");
    expect(addStart).toBeGreaterThan(-1);
    const addHandler = src.slice(addStart, addStart + 400);
    expect(addHandler).toMatch(/ensureWatchlistProduct\(product\)/);
  });
});
