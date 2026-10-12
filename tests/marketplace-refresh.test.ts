import { describe, expect, it, vi } from "vitest";
import { buildMarketplaceProduct, refreshMarketplaceListing } from "../lib/marketplace";
import type { DistributorListing, Product } from "../lib/types";

const IDENTITY = { platform: "shopee", region: "TH", shopId: "1950119", itemId: "28177881956", canonicalUrl: "https://shopee.co.th/product/1950119/28177881956" } as const;

function product(): Product {
  return buildMarketplaceProduct({ identity: { ...IDENTITY }, name: "Serum", variant: "30ml", seller: "Shop", price: "1290" });
}

const JSON_HTML = `<html><body><script>{"shopid":1950119,"itemid":28177881956,"price":1190,"stock":5,"selected_model":{"name":"30ml"}};</script></body></html>`;

describe("refreshMarketplaceListing", () => {
  it("saves the observed price as a dated manual point", async () => {
    const p = product();
    const persist = vi.fn(async (_productId: string, _listings: DistributorListing[]) => {});
    const out = await refreshMarketplaceListing(p, {
      loadHtml: async () => JSON_HTML,
      persist,
      now: () => "2026-10-12T00:00:00.000Z",
    });
    expect(out).toEqual({ status: "updated", variantMatched: true });
    expect(persist).toHaveBeenCalledOnce();
    const listings = persist.mock.calls[0]![1];
    const first = listings[0]!;
    expect(first.price).toBe(1190);
    expect(first.priceSource).toBe("manual");
    expect(first.priceHistory).toHaveLength(2);
    expect(first.priceHistory[1]).toMatchObject({ price: 1190, currency: "THB" });
  });

  it("reports login_required on the login wall", async () => {
    const out = await refreshMarketplaceListing(product(), {
      loadHtml: async () => `<html><body>ต้องเข้าสู่ระบบ</body></html>`,
      persist: vi.fn(),
    });
    expect(out).toEqual({ status: "login_required", variantMatched: false });
  });

  it("reports unavailable when the host throws", async () => {
    const out = await refreshMarketplaceListing(product(), {
      loadHtml: async () => { throw new Error("no host"); },
      persist: vi.fn(),
    });
    expect(out).toEqual({ status: "unavailable", variantMatched: false });
  });

  it("reports unavailable without marketplace identity", async () => {
    const p = product();
    delete (p as any).marketplace;
    const out = await refreshMarketplaceListing(p, {
      loadHtml: async () => JSON_HTML,
      persist: vi.fn(),
    });
    expect(out).toEqual({ status: "unavailable", variantMatched: false });
  });
});

describe("variant matching", () => {
  const htmlFor = (name: string | null) =>
    `<html><body><script>{"shopid":1950119,"itemid":28177881956,"price":1190,"stock":5${name === null ? "" : `,"selected_model":{"name":${JSON.stringify(name)}}`}};</script></body></html>`;

  it("matches case-insensitively with whitespace trimmed", async () => {
    const out = await refreshMarketplaceListing(product(), {
      loadHtml: async () => htmlFor("  30ML "),
      persist: vi.fn(),
    });
    expect(out).toEqual({ status: "updated", variantMatched: true });
  });

  it("does not match a different variant", async () => {
    const out = await refreshMarketplaceListing(product(), {
      loadHtml: async () => htmlFor("50ml"),
      persist: vi.fn(),
    });
    expect(out).toEqual({ status: "updated", variantMatched: false });
  });

  it("does not match when no variant is observed", async () => {
    const out = await refreshMarketplaceListing(product(), {
      loadHtml: async () => htmlFor(null),
      persist: vi.fn(),
    });
    expect(out).toEqual({ status: "updated", variantMatched: false });
  });
});

describe("shopeeThParser", () => {
  it("is registered with browser-first escalation", async () => {
    const { PARSERS } = await import("../lib/scrapers/registry");
    const p = PARSERS.find((x) => x.id === "shopee-th");
    expect(p).toBeDefined();
    expect(p!.useBrowser).toBe(true);
  });

  it("builds canonical URLs from model keys", async () => {
    const { shopeeThParser } = await import("../lib/scrapers/shopee-th");
    expect(shopeeThParser.buildSearchUrl("shopee-th-1950119-28177881956"))
      .toBe("https://shopee.co.th/product/1950119/28177881956");
  });

  it("parsePrice returns THB result on fixture HTML", async () => {
    const { shopeeThParser } = await import("../lib/scrapers/shopee-th");
    const html = `<html><body><script>{"shopid":1950119,"itemid":28177881956,"price":1190,"stock":5};</script></body></html>`;
    expect(shopeeThParser.parsePrice(html, "shopee-th-1950119-28177881956"))
      .toMatchObject({ price: 1190, currency: "THB" });
  });
});

describe("isAutomaticProduct", () => {
  it("includes monitoringStatus automatic", async () => {
    const { isAutomaticProduct } = await import("../lib/marketplace");
    expect(isAutomaticProduct({ marketplace: { monitoringStatus: "automatic" }, modelNumber: "shopee-th-1-2" })).toBe(true);
    expect(isAutomaticProduct({ marketplace: { monitoringStatus: "manual" }, modelNumber: "shopee-th-1-2" })).toBe(false);
    expect(isAutomaticProduct({ modelNumber: "CRS804" })).toBe(true);
  });
});
