import { describe, it, expect } from "vitest";
import { neobitsParser, scrapeNeobits } from "../../lib/scrapers/neobits";

describe("Neobits Parser", () => {
  it("should have correct parser config", () => {
    expect(neobitsParser.id).toBe("neobits-us");
    expect(neobitsParser.baseUrl).toBe("https://neobits.com");
    expect(neobitsParser.rateLimitMs).toBe(3000);
  });

  it("should build correct search URL", () => {
    const url = neobitsParser.buildSearchUrl("hAP ac3");
    expect(url).toBe("https://neobits.com/search?q=hAP%20ac3");
  });

  it("should return null for invalid HTML", () => {
    const result = neobitsParser.parsePrice(
      "<html><body>No price here</body></html>",
    );
    expect(result).toBeNull();
  });

  it("should extract price, stock status, and currency from valid HTML", () => {
    const html = `<div><span class="price">$249.99</span><span class="stock-status">In Stock</span></div>`;
    const result = neobitsParser.parsePrice(html);
    expect(result).not.toBeNull();
    expect(result!.price).toBe(249.99);
    expect(result!.currency).toBe("USD");
    expect(result!.stockStatus).toBe("in_stock");
  });
});
