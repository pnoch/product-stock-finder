import { describe, expect, it } from "vitest";
import { MAX_MARKETPLACE_URL_LENGTH } from "../shared/const";
import { parseMarketplaceUrl } from "../shared/marketplace-url";

describe("Shopee Thailand URL recognition", () => {
  it.each([
    "https://shopee.co.th/product/1950119/28177881956",
    "https://shopee.co.th/opaanlp/1950119/28177881956?utm_source=share",
    "https://shopee.co.th/Thai-product-i.1950119.28177881956#share",
  ])("canonicalizes %s without guessing metadata", (url) => {
    expect(parseMarketplaceUrl(url)).toEqual({ kind: "product", identity: {
      platform: "shopee", region: "TH", shopId: "1950119", itemId: "28177881956",
      canonicalUrl: "https://shopee.co.th/product/1950119/28177881956",
    } });
  });
  it.each(["https://s.shopee.co.th/9pf1T7VwV7", "https://th.shp.ee/5cVFz7M8"])("recognizes a short link %s", (url) => {
    expect(parseMarketplaceUrl(url)).toEqual({ kind: "short_link", url });
  });
  it("recognizes livestream shares", () => {
    expect(parseMarketplaceUrl("https://live.shopee.co.th/share?session=123")).toEqual({ kind: "livestream" });
  });
  it.each([
    "http://shopee.co.th/product/1/2", "https://shopee.co.th:8443/product/1/2",
    "https://user:pass@shopee.co.th/product/1/2", "https://shopee.co.th.evil.com/product/1/2",
    "https://shopee.co.th./product/1/2", "https://www.shopee.co.th/product/1/2",
    "https://shopee.co.th/product/0/2", "https://shopee.co.th/product/1/2/extra",
    "https://shopee.co.th/product/%31/2", "https://th.shp.ee/a/b", "https://127.0.0.1/1",
    "https://shopee.co.th\\@evil.com/product/1/2", "https://shopee.co.th/checkout",
  ])("rejects unsafe or unrecognized URL %s", (url) => expect(parseMarketplaceUrl(url)).toEqual({ kind: "invalid" }));
  it("rejects over-cap input", () => expect(parseMarketplaceUrl(`https://th.shp.ee/${"x".repeat(MAX_MARKETPLACE_URL_LENGTH)}`)).toEqual({ kind: "invalid" }));
});
