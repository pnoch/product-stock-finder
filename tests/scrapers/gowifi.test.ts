import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { gowifiParser, scrapeGowifi } from "../../lib/scrapers/gowifi";

const FIXTURES_DIR = path.join(__dirname, "../fixtures/scrapers");

describe("Gowifi Parser", () => {
  it("should have correct parser config", () => {
    expect(gowifiParser.id).toBe("gowifi-nz");
    expect(gowifiParser.baseUrl).toBe("https://gowifi.co.nz");
    expect(gowifiParser.rateLimitMs).toBe(3000);
  });

  it("should build correct search URL", () => {
    const url = gowifiParser.buildSearchUrl("hAP ac3");
    expect(url).toBe("https://gowifi.co.nz/search?q=hAP%20ac3");
  });

  it("should return null for 404 page fixture", () => {
    const fixturePath = path.join(FIXTURES_DIR, "gowifi-nz.html");
    expect(fs.existsSync(fixturePath)).toBe(true);
    
    const html = fs.readFileSync(fixturePath, "utf-8");
    const result = gowifiParser.parsePrice(html);
    expect(result).toBeNull();
  });

  it("should return null for invalid HTML", () => {
    const result = gowifiParser.parsePrice("<html><body>No price here</body></html>");
    expect(result).toBeNull();
  });

  it("should extract price, stock status, and currency from valid HTML", () => {
    const html = `<div><span class="price">NZ$549.00</span><span class="stock-status">In Stock</span></div>`;
    const result = gowifiParser.parsePrice(html);
    expect(result).not.toBeNull();
    expect(result!.price).toBe(549.00);
    expect(result!.currency).toBe("NZD");
    expect(result!.stockStatus).toBe("in_stock");
  });
});
