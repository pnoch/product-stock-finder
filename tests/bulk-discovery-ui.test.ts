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
    const empty = readFileSync(
      "components/product/distributor-listing-empty.tsx",
      "utf8",
    );
    expect(section).toContain("onFindPrices");
    expect(empty).toContain("Find prices");
    const screen = readFileSync("app/product/[id].tsx", "utf8");
    const hook = readFileSync(
      "hooks/use-product-detail-screen.ts",
      "utf8",
    );
    expect(hook).toContain("rediscoverProduct");
    expect(screen).toContain("onFindPrices={handleFindPrices}");
    expect(hook).toContain("timedOut");
  });

  it("watchlist card offers a no-prices repair CTA (mobile)", () => {
    const card = readFileSync("components/watchlist/product-card.tsx", "utf8");
    expect(card).toContain("onFindPrices");
    expect(card).toContain("No prices — Find");
    expect(card).toContain("stopPropagation");
    const screen = readFileSync(
      "hooks/use-watchlist-renderers.tsx",
      "utf8",
    );
    expect(screen).toContain("onFindPrices={");
    expect(screen).toContain("findingIds");
  });

  it("bulk import drains discovery via the shared loop (desktop)", () => {
    const search = readFileSync(
      "desktop/src/hooks/use-bulk-import.ts",
      "utf8",
    );
    expect(search).toContain("runDiscoveryLoop");
    expect(search).toContain("confirmAction");
    expect(search).toContain("Fetch prices for the remaining");
    const modal = readFileSync(
      "desktop/src/hooks/use-bulk-import.ts",
      "utf8",
    );
    expect(modal).toContain("runDiscoveryLoop");
    expect(modal).toContain("confirmAction");
    expect(modal).toContain("Fetch prices for the remaining");
  });

  it("product detail offers a Find prices CTA (desktop)", () => {
    const src = readFileSync(
      "desktop/src/hooks/use-product-detail-data.ts",
      "utf8",
    );
    const table = readFileSync(
      "desktop/src/components/product/DistributorTableEmpty.tsx",
      "utf8",
    );
    expect(table).toContain("Find prices");
    expect(src).toContain("rediscoverProduct");
  });

  it("watchlist offers a no-prices repair CTA (desktop)", () => {
    const row = readFileSync(
      "desktop/src/components/watchlist/WatchlistRow.tsx",
      "utf8",
    );
    const refresh = readFileSync(
      "desktop/src/hooks/use-watchlist-refresh.ts",
      "utf8",
    );
    expect(row).toContain("Find prices");
    expect(refresh).toContain("rediscoverProduct");
    expect(refresh).toContain("findingIds");
    expect(row).toContain("stopPropagation");
    expect(row).toContain("(product.listings ?? []).length === 0");
  });
});
