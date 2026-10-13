import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PARSERS } from "../lib/scrapers/registry";
import { ebayParser } from "../lib/scrapers/ebay";
import { isMarketplaceKey } from "../shared/marketplace-url";
import { isAutomaticProduct } from "../lib/marketplace";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

// Integration guards: the eBay surface stays wired end to end (parser,
// identity helper, catalog, card branding, short-link resolver).
describe("ebay guards", () => {
  it("registers the browser-first ebay-us parser", () => {
    expect(PARSERS).toContain(ebayParser);
    expect(ebayParser.id).toBe("ebay-us");
    expect(ebayParser.useBrowser).toBe(true);
    expect(ebayParser.rateLimitMs).toBe(60000);
  });

  it("isMarketplaceKey covers the ebay-us prefix", () => {
    expect(isMarketplaceKey("ebay-us-178212205608")).toBe(true);
    expect(isMarketplaceKey("CRS804")).toBe(false);
    expect(isMarketplaceKey(undefined)).toBe(false);
  });

  it("catalogs ebay-us", () => {
    const src = read("shared/src/distributors.ts");
    expect(src).toContain('"ebay-us"');
    expect(src).toContain("https://www.ebay.com");
  });

  it("brands the marketplace card for eBay", () => {
    const card = read("components/product/marketplace-card.tsx");
    const labels = read("lib/marketplace.ts");
    expect(card).toContain("marketplaceShortName");
    expect(card).toContain('marketplace?.platform === "ebay"');
    expect(labels).toContain('case "ebay": return "eBay"');
  });

  it("resolves ebay short links server-side", () => {
    const src = read("server/marketplace-resolver.ts");
    expect(src).toContain("ebay.io");
    expect(src).toContain("parseEbayItemFromUrl");
  });

  it("keeps manual eBay products out of automatic pipelines", () => {
    expect(
      isAutomaticProduct({
        marketplace: { platform: "ebay", itemId: "1", canonicalUrl: "https://www.ebay.com/itm/1" },
        modelNumber: "ebay-us-1",
      }),
    ).toBe(false);
    expect(isAutomaticProduct({ modelNumber: "ebay-us-178212205608" })).toBe(false);
  });

  it("parses the shipped fixture for its own model and misses for a foreign one", () => {
    const html = readFileSync(join(__dirname, "fixtures", "scrapers", "ebay-us.html"), "utf8");
    const hit = ebayParser.parsePrice(html, "ebay-us-178212205608");
    expect(hit?.price).toBe(104670.88);
    expect(hit?.currency).toBe("THB");
    expect(hit?.stockStatus).toBe("in_stock");
    expect(ebayParser.parsePrice(html, "__NO_SUCH_MODEL__")).toBeNull();
  });
});
