import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { interprojektParser, scrapeInterprojekt } from "../../lib/scrapers/interprojekt";

const FIXTURES_DIR = path.join(__dirname, "../fixtures/scrapers");

describe("Interprojekt Parser", () => {
  it("should have correct parser config", () => {
    expect(interprojektParser.id).toBe("interprojekt-pl");
    expect(interprojektParser.baseUrl).toBe("https://interprojekt.pl");
    expect(interprojektParser.rateLimitMs).toBe(3000);
  });

  it("should build correct search URL", () => {
    const url = interprojektParser.buildSearchUrl("hAP ac3");
    expect(url).toBe("https://interprojekt.pl/search?q=hAP%20ac3");
  });

  it("should return null for 404 page fixture", () => {
    const fixturePath = path.join(FIXTURES_DIR, "interprojekt-pl.html");
    if (!fs.existsSync(fixturePath)) {
      console.log("Fixture not found, skipping test");
      return;
    }
    
    const html = fs.readFileSync(fixturePath, "utf-8");
    const result = interprojektParser.parsePrice(html);
    expect(result).toBeNull();
  });

  it("should return null for invalid HTML", () => {
    const result = interprojektParser.parsePrice("<html><body>No price here</body></html>");
    expect(result).toBeNull();
  });

  it("should extract price, stock status, and currency from valid HTML", () => {
    const html = `<div><span class="price">€199.00</span><span class="stock-status">In Stock</span></div>`;
    const result = interprojektParser.parsePrice(html);
    expect(result).not.toBeNull();
    expect(result!.price).toBe(199.00);
    expect(result!.currency).toBe("EUR");
    expect(result!.stockStatus).toBe("in_stock");
  });
});
