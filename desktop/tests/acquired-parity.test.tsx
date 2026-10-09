import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("desktop acquired parity", () => {
  it("Watchlist page imports isAcquired and has showAcquired state", () => {
    const src = read("src/pages/Watchlist.tsx");
    expect(src).toContain('import { isAcquired }');
    expect(src).toContain("showAcquired");
  });

  it("ProductDetail page imports isAcquired and has handleToggleAcquired", () => {
    const src = read("src/pages/ProductDetail.tsx");
    expect(src).toContain('import { isAcquired }');
    expect(src).toContain("handleToggleAcquired");
  });

  it("Stats page imports activeProducts and uses it for basket", () => {
    const src = read("src/pages/Stats.tsx");
    expect(src).toContain('import { activeProducts }');
    expect(src).toContain("computeBasketValue(activeProducts(products)");
  });

  it("Home page imports activeProducts and uses it for in-stock count", () => {
    const src = read("src/pages/Home.tsx");
    expect(src).toContain('import { activeProducts }');
    expect(src).toContain("activeProducts(products)");
  });
});