import { describe, it, expect } from "vitest";
import { rocnocParser, scrapeRocnoc } from "../../lib/scrapers/rocnoc";

describe("Rocnoc Parser", () => {
  it("should have correct parser config", () => {
    expect(rocnocParser.id).toBe("rocnoc-us");
    expect(rocnocParser.baseUrl).toBe("https://rocnoc.com");
    expect(rocnocParser.rateLimitMs).toBe(3000);
  });

  it("should build correct search URL", () => {
    const url = rocnocParser.buildSearchUrl("hAP ac3");
    expect(url).toBe("https://rocnoc.com/search?q=hAP%20ac3");
  });

  it("should return null for invalid HTML", () => {
    const result = rocnocParser.parsePrice("<html><body>No price here</body></html>");
    expect(result).toBeNull();
  });

  it("should extract price, stock status, and currency from valid HTML", () => {
    const html = `<div><span class="price">$379.00</span><span class="stock-status">In Stock</span></div>`;
    const result = rocnocParser.parsePrice(html);
    expect(result).not.toBeNull();
    expect(result!.price).toBe(379.00);
    expect(result!.currency).toBe("USD");
    expect(result!.stockStatus).toBe("in_stock");
  });
});
