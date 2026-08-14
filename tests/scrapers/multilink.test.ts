import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { multilinkParser, scrapeMultilink } from "../../lib/scrapers/multilink";

const FIXTURES_DIR = path.join(__dirname, "../fixtures/scrapers");

describe("Multilink Parser", () => {
  it("should have correct parser config", () => {
    expect(multilinkParser.id).toBe("multilink-us");
    expect(multilinkParser.baseUrl).toBe("https://multilink.us");
    expect(multilinkParser.rateLimitMs).toBe(3000);
  });

  it("should build correct search URL", () => {
    const url = multilinkParser.buildSearchUrl("hAP ac3");
    expect(url).toBe("https://multilink.us/search?q=hAP%20ac3");
  });

  it("should return null for 404 page fixture", () => {
    const fixturePath = path.join(FIXTURES_DIR, "multilink-us.html");
    expect(fs.existsSync(fixturePath)).toBe(true);

    const html = fs.readFileSync(fixturePath, "utf-8");
    const result = multilinkParser.parsePrice(html);
    expect(result).toBeNull();
  });

  it("should return null for invalid HTML", () => {
    const result = multilinkParser.parsePrice(
      "<html><body>No price here</body></html>",
    );
    expect(result).toBeNull();
  });

  it("should extract price, stock status, and currency from valid HTML", () => {
    const html = `<div><span class="price">$199.99</span><span class="stock-status">In Stock</span></div>`;
    const result = multilinkParser.parsePrice(html);
    expect(result).not.toBeNull();
    expect(result!.price).toBe(199.99);
    expect(result!.currency).toBe("USD");
    expect(result!.stockStatus).toBe("in_stock");
  });
});
