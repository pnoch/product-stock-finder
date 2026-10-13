import { describe, expect, it, vi } from "vitest";
import { isEbayInput, isMarketplaceInput, isMarketplaceKey, parseMarketplaceUrl } from "../shared/marketplace-url";
import { buildMarketplaceProduct, refreshMarketplaceListing } from "../lib/marketplace";
import type { DistributorListing } from "../lib/types";

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

describe("ebay builder + refresh", () => {
  const IDENTITY = {
    platform: "ebay" as const,
    region: "US" as const,
    itemId: "178212205608",
    canonicalUrl: "https://www.ebay.com/itm/178212205608",
  };
  const grounded = (name: string, price = "3114.00", currency = "THB") =>
    `<html><head><script type="application/ld+json">[{"@type":"Product","name":"${name}","offers":{"price":"${price}","priceCurrency":"${currency}","availability":"https://schema.org/InStock","itemCondition":"https://schema.org/NewCondition"}}]</script></head>`
    + `<body><a href="/itm/178212205608">Item</a></body></html>`;

  it("builds an ebay-us- product with USD currency and Single option default", () => {
    const p = buildMarketplaceProduct({ identity: IDENTITY, name: "MikroTik CRS804", variant: "", seller: "mercocool", price: "3114.00" });
    expect(p.id).toBe("ebay-us-178212205608");
    expect(p.modelNumber).toBe("ebay-us-178212205608");
    expect(p.marketplace?.platform).toBe("ebay");
    expect(p.marketplace?.variant).toBe("Single option");
    expect(p.listings[0]!.priceSource).toBe("manual");
    expect(p.listings[0]!.currency).toBe("USD");
    expect(p.listings[0]!.priceHistory[0]!.currency).toBe("USD");
  });

  it("rejects mismatched identity round-trip", () => {
    expect(() =>
      buildMarketplaceProduct({ identity: { ...IDENTITY, itemId: "999" }, name: "X", variant: "", seller: "S", price: "1" }),
    ).toThrow(/Invalid marketplace identity/);
  });

  it("refreshes a grounded observation to updated + variantMatched, in USD", async () => {
    const p = buildMarketplaceProduct({ identity: IDENTITY, name: "MikroTik CRS804", variant: "", seller: "mercocool", price: "3114.00" });
    const persist = vi.fn(async (_productId: string, _listings: DistributorListing[]) => {});
    const out = await refreshMarketplaceListing(p, {
      loadHtml: async () => grounded("MikroTik CRS804"),
      persist,
      now: () => "2026-10-12T00:00:00.000Z",
    });
    expect(out).toEqual({ status: "updated", variantMatched: true });
    const listings = persist.mock.calls[0]![1];
    expect(listings[0]!.price).toBe(3114);
    expect(listings[0]!.priceHistory).toHaveLength(2);
    expect(listings[0]!.priceHistory[1]).toMatchObject({ price: 3114, currency: "USD" });
  });

  it("returns unavailable when the page does not reference the item", async () => {
    const p = buildMarketplaceProduct({ identity: IDENTITY, name: "MikroTik CRS804", variant: "", seller: "mercocool", price: "3114.00" });
    const out = await refreshMarketplaceListing(p, {
      loadHtml: async () => `<html><body>Error Page</body></html>`,
      persist: vi.fn(),
    });
    expect(out).toEqual({ status: "unavailable", variantMatched: false });
  });

  it("never saves a price when the title changed", async () => {
    const p = buildMarketplaceProduct({ identity: IDENTITY, name: "MikroTik CRS804", variant: "", seller: "mercocool", price: "3114.00" });
    const persist = vi.fn(async (_productId: string, _listings: DistributorListing[]) => {});
    const out = await refreshMarketplaceListing(p, {
      loadHtml: async () => grounded("Different Item"),
      persist,
    });
    expect(out).toEqual({ status: "no_price", variantMatched: false });
    expect(persist).not.toHaveBeenCalled();
  });
});
