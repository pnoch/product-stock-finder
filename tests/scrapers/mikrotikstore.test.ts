import { describe, it, expect } from "vitest";
import { mikrotikstoreParser, scrapeMikrotikStore } from "../../lib/scrapers/mikrotikstore";

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
    const result = mikrotikstoreParser.parsePrice("<html><body>No price here</body></html>");
    expect(result).toBeNull();
  });

  it("should extract price, stock status, and currency from valid HTML", () => {
    const html = `<div><span class="price">€159.00</span><span class="stock-status">In Stock</span></div>`;
    const result = mikrotikstoreParser.parsePrice(html);
    expect(result).not.toBeNull();
    expect(result!.price).toBe(159.00);
    expect(result!.currency).toBe("EUR");
    expect(result!.stockStatus).toBe("in_stock");
  });
});
