import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { winncomParser, scrapeWinncom } from "../../lib/scrapers/winncom";

const FIXTURES_DIR = path.join(__dirname, "../fixtures/scrapers");

describe("Winncom Parser", () => {
  it("should have correct parser config", () => {
    expect(winncomParser.id).toBe("winncom-us");
    expect(winncomParser.baseUrl).toBe("https://winncom.com");
    expect(winncomParser.rateLimitMs).toBe(3000);
  });

  it("should build correct search URL", () => {
    const url = winncomParser.buildSearchUrl("hAP ac3");
    expect(url).toBe("https://winncom.com/search?q=hAP%20ac3");
  });

  it("should return null for 404 page fixture", () => {
    const fixturePath = path.join(FIXTURES_DIR, "winncom-us.html");
    expect(fs.existsSync(fixturePath)).toBe(true);

    const html = fs.readFileSync(fixturePath, "utf-8");
    const result = winncomParser.parsePrice(html);
    expect(result).toBeNull();
  });

  it("should return null for invalid HTML", () => {
    const result = winncomParser.parsePrice(
      "<html><body>No price here</body></html>",
    );
    expect(result).toBeNull();
  });

  it("should extract price, stock status, and currency from valid HTML", () => {
    const html = `<div><span class="price">$599.99</span><span class="stock-status">In Stock</span></div>`;
    const result = winncomParser.parsePrice(html);
    expect(result).not.toBeNull();
    expect(result!.price).toBe(599.99);
    expect(result!.currency).toBe("USD");
    expect(result!.stockStatus).toBe("in_stock");
  });
});
