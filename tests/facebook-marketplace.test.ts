import { describe, expect, it, vi } from "vitest";
import { isFacebookInput, isMarketplaceInput, parseMarketplaceUrl } from "../shared/marketplace-url";
import { buildMarketplaceProduct, isAutomaticProduct, refreshMarketplaceListing } from "../lib/marketplace";
import { parseFacebookPrice } from "../lib/scrapers/facebook";
import type { DistributorListing } from "../lib/types";

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
describe("facebook builder + refresh + price", () => {
  const IDENTITY = {
    platform: "facebook" as const,
    itemId: "2556068711502321",
    canonicalUrl: "https://www.facebook.com/marketplace/item/2556068711502321/",
  };

  it("builds an fbmp- product with variant defaulting to Single option", () => {
    const p = buildMarketplaceProduct({ identity: IDENTITY, name: "Mac Pro 2019", variant: "", seller: "Seller", price: "45000" });
    expect(p.id).toBe("fbmp-2556068711502321");
    expect(p.modelNumber).toBe("fbmp-2556068711502321");
    expect(p.marketplace?.platform).toBe("facebook");
    expect(p.marketplace?.variant).toBe("Single option");
    expect(p.listings[0]!.priceSource).toBe("manual");
    expect(p.listings[0]!.currency).toBe("THB");
  });

  it("rejects mismatched identity round-trip", () => {
    expect(() =>
      buildMarketplaceProduct({ identity: { ...IDENTITY, itemId: "999" }, name: "X", variant: "", seller: "S", price: "1" }),
    ).toThrow(/Invalid marketplace identity/);
  });

  it("extracts price + title from a grounded render", () => {
    const html = `<html><head><meta property="og:title" content="Mac Pro 2019 Xeon 24-Core"/></head><body><script>
      var data = {"item_id":"2556068711502321","listing_price":{"amount":"45,000"},"formatted_price":{"text":"\\u0e3f45,000"},"marketplace_listing_title":"Mac Pro 2019 Xeon 24-Core"};
    </script></body></html>`;
    const out = parseFacebookPrice(html, "2556068711502321");
    expect(out?.price).toBe(45000);
    expect(out?.currency).toBe("THB");
    expect(out?.title).toBe("Mac Pro 2019 Xeon 24-Core");
  });

  it("returns null on login wall and unknown items", () => {
    expect(parseFacebookPrice(`<html><body>Log in or sign up</body></html>`, "2556068711502321")).toBeNull();
    expect(parseFacebookPrice(`<html><body><div>no item here</div></body></html>`, "2556068711502321")).toBeNull();
  });

  it("refresh saves a verified observation and flags login walls", async () => {
    const p = buildMarketplaceProduct({ identity: IDENTITY, name: "Mac Pro 2019", variant: "", seller: "Seller", price: "45000" });
    const persist = vi.fn(async (_productId: string, _listings: DistributorListing[]) => {});
    const grounded = `<html><head><meta property="og:title" content="Mac Pro 2019"/></head><body><script>{"item_id":"2556068711502321","listing_price":{"amount":"44000"},"formatted_price":{"text":"\\u0e3f44,000"},"marketplace_listing_title":"Mac Pro 2019"}</script></body></html>`;
    const out = await refreshMarketplaceListing(p, {
      loadHtml: async () => grounded,
      persist,
      now: () => "2026-10-12T00:00:00.000Z",
    });
    expect(out).toEqual({ status: "updated", variantMatched: true });
    const listings = persist.mock.calls[0]![1];
    expect(listings[0]!.price).toBe(44000);
    expect(listings[0]!.priceHistory).toHaveLength(2);

    const wall = await refreshMarketplaceListing(p, {
      loadHtml: async () => `<html><body>Log in or sign up to continue</body></html>`,
      persist: vi.fn(),
    });
    expect(wall).toEqual({ status: "login_required", variantMatched: false });
  });

  it("never saves a price when the title changed", async () => {
    const p = buildMarketplaceProduct({ identity: IDENTITY, name: "Mac Pro 2019", variant: "", seller: "Seller", price: "45000" });
    const persist = vi.fn(async (_productId: string, _listings: DistributorListing[]) => {});
    const changed = `<html><head><meta property="og:title" content="Different Item"/></head><body><script>{"item_id":"2556068711502321","listing_price":{"amount":"44000"},"formatted_price":{"text":"\\u0e3f44,000"},"marketplace_listing_title":"Different Item"}</script></body></html>`;
    const out = await refreshMarketplaceListing(p, {
      loadHtml: async () => changed,
      persist,
    });
    expect(out).toEqual({ status: "no_price", variantMatched: false });
    expect(persist).not.toHaveBeenCalled();
  });

  it("stays non-automatic for pipeline exclusion", () => {
    const p = buildMarketplaceProduct({ identity: IDENTITY, name: "Mac Pro 2019", variant: "", seller: "Seller", price: "45000" });
    expect(isAutomaticProduct(p)).toBe(false);
  });
});
