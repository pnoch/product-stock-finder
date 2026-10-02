import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("bulk discovery UI", () => {
  it("bulk import runs the batch runner (mobile)", () => {
    const src = readFileSync("components/search/bulk-import-modal.tsx", "utf8");
    expect(src).toContain("runDiscoveryBatch");
    expect(src).toContain("Fetch prices for the remaining");
  });

  it("product detail offers a Find prices CTA (mobile)", () => {
    const section = readFileSync(
      "components/product/distributor-listing-section.tsx",
      "utf8",
    );
    expect(section).toContain("onFindPrices");
    expect(section).toContain("Find prices");
    const screen = readFileSync("app/product/[id].tsx", "utf8");
    expect(screen).toContain("rediscoverProduct");
    expect(screen).toContain("onFindPrices={handleFindPrices}");
    expect(screen).toContain("timedOut");
  });

  it("watchlist card offers a no-prices repair CTA (mobile)", () => {
    const card = readFileSync("components/watchlist/product-card.tsx", "utf8");
    expect(card).toContain("onFindPrices");
    expect(card).toContain("No prices — Find");
    expect(card).toContain("stopPropagation");
    const screen = readFileSync("app/(tabs)/watchlist.tsx", "utf8");
    expect(screen).toContain("onFindPrices={");
    expect(screen).toContain("findingIds");
  });

  it("bulk import runs the batch runner (desktop)", () => {
    const search = readFileSync("desktop/src/pages/Search.tsx", "utf8");
    expect(search).toContain("runDiscoveryBatch");
    const modal = readFileSync("desktop/src/components/SearchModal.tsx", "utf8");
    expect(modal).toContain("runDiscoveryBatch");
  });
});
