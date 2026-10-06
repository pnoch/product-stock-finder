import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("estimated shipping labelling", () => {
  it("the best-deal breakdown labels shipping and total as estimates", () => {
    const src = read("components/product/distributor-listing-section.tsx");
    // The destination breakdown must use formatEstimate for the shipping and
    // total terms so they read as estimates, not quotes.
    expect(src).toContain("formatEstimate");
    // The headline best-deal total must stay a firm quote on the region path
    // and become an estimate on the destination path — both branches must exist.
    expect(src).toContain("formatEstimate(bestDeal.total");
    expect(src).toContain("formatPrice(bestDeal.total");
    expect(src).toContain("Check exact rates at checkout");
    expect(src).toContain("hasDestination={destination != null}");
  });

  it("the listing card relabels Visit when a destination is active", () => {
    const src = read("components/product/distributor-listing-card.tsx");
    expect(src).toContain("exact shipping");
  });
});
