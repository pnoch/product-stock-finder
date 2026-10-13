import { describe, expect, it } from "vitest";
import { isEbayInput, isMarketplaceInput, isMarketplaceKey, parseMarketplaceUrl } from "../shared/marketplace-url";

describe("ebay url recognition", () => {
  it("recognizes canonical item urls and strips tracking", () => {
    expect(parseMarketplaceUrl("https://www.ebay.com/itm/178212205608?mkcid=16")).toEqual({
      kind: "product",
      identity: { platform: "ebay", region: "US", itemId: "178212205608", canonicalUrl: "https://www.ebay.com/itm/178212205608" },
    });
  });

  it("recognizes slug-form canonical urls", () => {
    const out = parseMarketplaceUrl("https://www.ebay.com/itm/MikroTik-CRS812/178212205608");
    expect(out.kind).toBe("product");
    if (out.kind === "product" && out.identity.platform === "ebay") {
      expect(out.identity.itemId).toBe("178212205608");
    }
  });

  it("recognizes short links without fetching", () => {
    expect(parseMarketplaceUrl("https://ebay.io/m/CV7fAk")).toEqual({
      kind: "short_link", url: "https://ebay.io/m/CV7fAk",
    });
  });

  it("rejects other TLDs, bad ids, non-https", () => {
    expect(parseMarketplaceUrl("https://www.ebay.co.uk/itm/123/").kind).not.toBe("product");
    expect(parseMarketplaceUrl("https://www.ebay.com/itm/0123/").kind).not.toBe("product");
    expect(parseMarketplaceUrl("http://www.ebay.com/itm/123/").kind).not.toBe("product");
    expect(parseMarketplaceUrl("https://pages.ebay.com/x").kind).not.toBe("product");
  });

  it("input detectors + key coverage", () => {
    expect(isEbayInput("https://ebay.io/m/abc")).toBe(true);
    expect(isMarketplaceInput("https://www.ebay.com/itm/1")).toBe(true);
    expect(isMarketplaceKey("ebay-us-178212205608")).toBe(true);
    expect(isMarketplaceKey("CRS804")).toBe(false);
  });
});
