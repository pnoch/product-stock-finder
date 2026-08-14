import { describe, it, expect } from "vitest";
import { flytecParser, scrapeFlytec } from "../../lib/scrapers/flytec";

describe("Flytec Parser", () => {
  it("should have correct parser config", () => {
    expect(flytecParser.id).toBe("flytec-us");
    expect(flytecParser.baseUrl).toBe("https://flytechelectronics.com");
    expect(flytecParser.rateLimitMs).toBe(3000);
  });

  it("should build correct search URL", () => {
    const url = flytecParser.buildSearchUrl("hAP ac3");
    expect(url).toBe("https://flytechelectronics.com/search?q=hAP%20ac3");
  });

  it("should return null for invalid HTML", () => {
    const result = flytecParser.parsePrice(
      "<html><body>No price here</body></html>",
    );
    expect(result).toBeNull();
  });

  it("should extract price, stock status, and currency from valid HTML", () => {
    const html = `<div><span class="price">$449.99</span><span class="stock-status">In Stock</span></div>`;
    const result = flytecParser.parsePrice(html);
    expect(result).not.toBeNull();
    expect(result!.price).toBe(449.99);
    expect(result!.currency).toBe("USD");
    expect(result!.stockStatus).toBe("in_stock");
  });
});
