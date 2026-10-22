import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("concierge onboarding wiring", () => {
  it("layout renders concierge for first-run", () => {
    expect(read("app/_layout.tsx")).toContain("ConciergeScreen");
  });

  it("concierge uses catalog search + country picker + storage", () => {
    const src = read("components/onboarding/concierge-screen.tsx");
    const products = read("components/onboarding/concierge-step-products.tsx");
    expect(products).toContain("CatalogSearchBar");
    expect(src).toContain("CountryPicker");
    expect(src).toContain("addToWatchlist");
    expect(src).toContain("setOnboardingSeen");
  });

  it("helpers exist", () => {
    const src = read("lib/concierge.ts");
    expect(src).toContain("defaultAlertTarget");
    expect(src).toContain("clampSelection");
  });
});
