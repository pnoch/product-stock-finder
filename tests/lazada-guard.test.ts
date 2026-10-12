import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { PARSERS } from "../lib/scrapers/registry";
import { lazadaThParser } from "../lib/scrapers/lazada-th";
import { isMarketplaceKey } from "../shared/marketplace-url";

// Integration guards: the Lazada TH surface stays wired end to end (parser,
// identity helper, catalog, card branding, short-link resolver).
describe("lazada guards", () => {
  it("registers the lazada-th parser plain-first", () => {
    expect(PARSERS).toContain(lazadaThParser);
    expect(lazadaThParser.id).toBe("lazada-th");
    expect(lazadaThParser.useBrowser).toBeFalsy();
  });

  it("isMarketplaceKey covers both platforms", () => {
    expect(isMarketplaceKey("shopee-th-1950119-28177881956")).toBe(true);
    expect(isMarketplaceKey("lazada-th-16199450766-127341978928")).toBe(true);
    expect(isMarketplaceKey("CRS804")).toBe(false);
    expect(isMarketplaceKey(undefined)).toBe(false);
  });

  it("catalogs lazada-th", () => {
    const src = readFileSync("shared/src/distributors.ts", "utf8");
    expect(src).toContain('"lazada-th"');
  });

  it("brands the marketplace card for Lazada", () => {
    const src = readFileSync(
      "components/product/marketplace-card.tsx",
      "utf8",
    );
    expect(src).toContain("Lazada TH");
  });

  it("resolves lazada short links server-side", () => {
    const src = readFileSync("server/marketplace-resolver.ts", "utf8");
    expect(src).toContain("s.lazada.co.th");
  });
});
