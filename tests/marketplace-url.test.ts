import { describe, expect, it } from "vitest";
import { MAX_MARKETPLACE_URL_LENGTH } from "../shared/const";
import {
  isLazadaInput,
  isMarketplaceInput,
  isMarketplaceKey,
  isShopeeInput,
  marketplaceResolutionMessage,
  parseMarketplaceUrl,
} from "../shared/marketplace-url";

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

describe("lazada url recognition", () => {
  it("recognizes canonical urls with slug", () => {
    expect(parseMarketplaceUrl("https://www.lazada.co.th/products/asus-rog-i16199450766-s127341978928.html")).toEqual({
      kind: "product",
      identity: {
        platform: "lazada", region: "TH",
        itemId: "16199450766", skuId: "127341978928",
        canonicalUrl: "https://www.lazada.co.th/products/asus-rog-i16199450766-s127341978928.html",
      },
    });
  });

  it("recognizes slugless canonical urls", () => {
    const out = parseMarketplaceUrl("https://www.lazada.co.th/products/i16199450766-s127341978928.html");
    expect(out.kind).toBe("product");
  });

  it("recognizes short links without fetching", () => {
    expect(parseMarketplaceUrl("https://s.lazada.co.th/s.Z9ZEU8")).toEqual({
      kind: "short_link", url: "https://s.lazada.co.th/s.Z9ZEU8",
    });
  });

  it("rejects wrong regions, bad ids, non-https", () => {
    expect(parseMarketplaceUrl("https://www.lazada.sg/products/a-i1-s2.html").kind).not.toBe("product");
    expect(parseMarketplaceUrl("https://www.lazada.co.th/products/a-i01-s2.html").kind).not.toBe("product");
    expect(parseMarketplaceUrl("http://www.lazada.co.th/products/a-i1-s2.html").kind).not.toBe("product");
  });

  it.each([
    "https://www.lazada.com/products/a-i1-s2.html",
    "https://lazada.co.th/products/a-i1-s2.html",
    "https://www.lazada.co.th:8443/products/a-i1-s2.html",
    "https://user:pass@www.lazada.co.th/products/a-i1-s2.html",
    "https://www.lazada.co.th/products/a-i1.html",
    "https://www.lazada.co.th/products/a-i0-s2.html",
    "https://s.lazada.co.th/s.invalid-code!",
    "https://s.lazada.co.th/notshort",
  ])("rejects unsafe or unrecognized Lazada URL %s", (url) => expect(parseMarketplaceUrl(url)).toEqual({ kind: "invalid" }));

  it("isMarketplaceKey covers both platforms", () => {
    expect(isMarketplaceKey("shopee-th-1-2")).toBe(true);
    expect(isMarketplaceKey("lazada-th-16199450766-127341978928")).toBe(true);
    expect(isMarketplaceKey("CRS804")).toBe(false);
    expect(isMarketplaceKey(undefined)).toBe(false);
  });

  it("detects lazada vs shopee input", () => {
    expect(isLazadaInput("https://www.lazada.co.th/products/a-i1-s2.html")).toBe(true);
    expect(isLazadaInput("https://shopee.co.th/product/1/2")).toBe(false);
    expect(isShopeeInput("https://www.lazada.co.th/products/a-i1-s2.html")).toBe(false);
    expect(isMarketplaceInput("https://s.lazada.co.th/s.Z9ZEU8")).toBe(true);
    expect(isMarketplaceInput("https://s.shopee.co.th/9pf1T7VwV7")).toBe(true);
    expect(isMarketplaceInput("CRS804")).toBe(false);
  });

  it("brands resolution messages per platform", () => {
    expect(marketplaceResolutionMessage({ kind: "blocked", reason: "url" }, "lazada")).toMatch(/Lazada link/);
    expect(marketplaceResolutionMessage({ kind: "error", reason: "network" }, "lazada")).toMatch(/Lazada link/);
    expect(marketplaceResolutionMessage({ kind: "blocked", reason: "url" })).toMatch(/Shopee link/);
  });
});
