import { describe, expect, it } from "vitest";
import { isFacebookInput, isMarketplaceInput, parseMarketplaceUrl } from "../shared/marketplace-url";

describe("facebook url recognition", () => {
  it("recognizes canonical item urls and strips tracking", () => {
    expect(parseMarketplaceUrl("https://www.facebook.com/marketplace/item/2556068711502321/?rdid=x")).toEqual({
      kind: "product",
      identity: { platform: "facebook", itemId: "2556068711502321", canonicalUrl: "https://www.facebook.com/marketplace/item/2556068711502321/" },
    });
  });

  it("accepts web.facebook.com host", () => {
    const out = parseMarketplaceUrl("https://web.facebook.com/marketplace/item/123/");
    expect(out.kind).toBe("product");
  });

  it("recognizes share links as short_link", () => {
    expect(parseMarketplaceUrl("https://www.facebook.com/share/1DRTMqB7bR/")).toEqual({
      kind: "short_link", url: "https://www.facebook.com/share/1DRTMqB7bR/",
    });
  });

  it("rejects category/browse urls, other hosts, leading zeros, non-https", () => {
    expect(parseMarketplaceUrl("https://www.facebook.com/marketplace/category/electronics/").kind).not.toBe("product");
    expect(parseMarketplaceUrl("https://m.facebook.com/marketplace/item/123/").kind).not.toBe("product");
    expect(parseMarketplaceUrl("https://www.facebook.com/marketplace/item/0123/").kind).not.toBe("product");
    expect(parseMarketplaceUrl("http://www.facebook.com/marketplace/item/123/").kind).not.toBe("product");
  });

  it("input detectors", () => {
    expect(isFacebookInput("https://www.facebook.com/share/abc/")).toBe(true);
    expect(isMarketplaceInput("https://www.facebook.com/marketplace/item/1/")).toBe(true);
    expect(isMarketplaceInput("https://shopee.co.th/product/1/2")).toBe(true);
    expect(isMarketplaceInput("https://example.com")).toBe(false);
  });
});