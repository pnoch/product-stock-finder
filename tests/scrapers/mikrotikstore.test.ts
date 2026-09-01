import { describe, it, expect, vi } from "vitest";
import {
  mikrotikstoreParser,
  scrapeMikrotikStore,
} from "../../lib/scrapers/mikrotikstore";

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.mock("../../lib/scrapers/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/scrapers/utils")>();
  return {
    ...actual,
    fetchWithRateLimit: (url: string, ms?: number) => fetchMock(url, ms),
  };
});

describe("MikroTik Store Parser", () => {
  it("should have correct parser config", () => {
    expect(mikrotikstoreParser.id).toBe("mikrotikstore-de");
    expect(mikrotikstoreParser.baseUrl).toBe("https://mikrotik-store.eu");
    expect(mikrotikstoreParser.rateLimitMs).toBe(3000);
  });

  it("should build correct search URL", () => {
    const url = mikrotikstoreParser.buildSearchUrl("hAP ac3");
    expect(url).toBe("https://mikrotik-store.eu/en/search?q=hAP%20ac3");
  });

  it("should return null for invalid HTML", () => {
    const result = mikrotikstoreParser.parsePrice(
      "<html><body>No price here</body></html>",
    );
    expect(result).toBeNull();
  });

  it("should extract price, stock status, and currency from valid HTML", () => {
    const html = `<div><span class="price-tag">159,00 EUR</span><span class="stock-status">In Stock</span></div>`;
    const result = mikrotikstoreParser.parsePrice(html);
    expect(result).not.toBeNull();
    expect(result!.price).toBe(159.0);
    expect(result!.currency).toBe("EUR");
    expect(result!.stockStatus).toBe("in_stock");
  });
});


describe("model verification", () => {
  const MODEL = "CRS804-4DDQ-hRM";
  const MATCH_HTML = `<html><body><div class="product-detail">
    <h1>MikroTik CRS804-4DDQ-hRM</h1>
    <p><span class="price-tag">1.181,67 EUR</span></p>
    <span class="product-detail-delivery-status">In Stock</span>
  </body></html>`;
  const MISMATCH_HTML = MATCH_HTML.replace(
    /crs804-4ddq-hrm/gi,
    "crs326-24g-2s-plus",
  ).replace(/CRS804-4DDQ-hRM/g, "CRS326-24G-2S+");

  it("accepts a product page naming the requested model", () => {
    const result = mikrotikstoreParser.parsePrice(MATCH_HTML, MODEL);
    expect(result).not.toBeNull();
    expect(result?.price).toBe(1181.67);
    expect(result?.stockStatus).toBe("in_stock");
  });

  it("returns null when the priced page names a different product", () => {
    expect(mikrotikstoreParser.parsePrice(MISMATCH_HTML, MODEL)).toBeNull();
  });

  it("ignores verification when no model is passed", () => {
    expect(mikrotikstoreParser.parsePrice(MISMATCH_HTML)?.price).toBe(1181.67);
  });
});

describe("search result link extraction", () => {
  const SEARCH_HTML = `<html><body>
    <a href="/en/switches/cloud-router-switch-crs804" title="category CRS804 | 04 Ports | 400G">CRS804 | 04 Ports | 400G</a>
    <a href="/en/mikrotik-crs804-ddq" title="MikroTik CRS804 DDQ">MikroTik CRS804 DDQ</a>
    <a href="/en/other-product">Something else</a>
  </body></html>`;

  const PRODUCT_HTML = `<html><body><div class="product-detail">
    <h1>MikroTik CRS804-4DDQ-HRM</h1>
    <p><span class="price-tag">1.181,67 EUR</span></p>
    <span class="product-detail-delivery-status">In Stock</span>
  </body></html>`;

  it("returns null when search page has no matching product link", async () => {
    fetchMock.mockResolvedValue(
      `<html><body><a href="/en/other-product">Something else</a></body></html>`,
    );
    const result = await scrapeMikrotikStore("CRS804-4DDQ-HRM");
    expect(result).toBeNull();
    fetchMock.mockReset();
  });

  it("follows product link and parses the product page", async () => {
    fetchMock
      .mockResolvedValueOnce(SEARCH_HTML)
      .mockResolvedValueOnce(PRODUCT_HTML);
    const result = await scrapeMikrotikStore("CRS804-4DDQ-HRM");
    expect(result).not.toBeNull();
    expect(result!.price).toBe(1181.67);
    expect(result!.currency).toBe("EUR");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/en/mikrotik-crs804-ddq",
      expect.anything(),
    );
    fetchMock.mockReset();
  });
});
