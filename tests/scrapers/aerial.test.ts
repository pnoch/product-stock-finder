import { describe, it, expect } from "vitest";
import { aerialParser, scrapeAerial } from "../../lib/scrapers/aerial";

describe("Aerial Parser", () => {
  it("should have correct parser config", () => {
    expect(aerialParser.id).toBe("aerial-gr");
    expect(aerialParser.baseUrl).toBe("https://aerial.net");
    expect(aerialParser.rateLimitMs).toBe(3000);
  });

  it("should build correct search URL", () => {
    const url = aerialParser.buildSearchUrl("hAP ac3");
    expect(url).toBe("https://aerial.net/shop?q=hAP%20ac3");
  });

  it("should return null for invalid HTML", () => {
    const result = aerialParser.parsePrice("<html><body>No price here</body></html>");
    expect(result).toBeNull();
  });

  it("should extract price, stock status, and currency from valid HTML", () => {
    const html = `<div><span class="price">€219.00</span><span class="stock-status">In Stock</span></div>`;
    const result = aerialParser.parsePrice(html);
    expect(result).not.toBeNull();
    expect(result!.price).toBe(219.00);
    expect(result!.currency).toBe("EUR");
    expect(result!.stockStatus).toBe("in_stock");
  });
});
