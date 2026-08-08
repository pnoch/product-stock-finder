import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { duxtelParser, scrapeDuxtel } from "../../lib/scrapers/duxtel";

const FIXTURES_DIR = path.join(__dirname, "../fixtures/scrapers");

describe("Duxtel Parser", () => {
  it("should have correct parser config", () => {
    expect(duxtelParser.id).toBe("duxtel-au");
    expect(duxtelParser.baseUrl).toBe("https://store.duxtel.com");
    expect(duxtelParser.rateLimitMs).toBe(3000);
  });

  it("should build correct search URL", () => {
    const url = duxtelParser.buildSearchUrl("hAP ac3");
    expect(url).toBe("https://store.duxtel.com/search?q=hAP%20ac3");
  });

  it("should return null for 404 page fixture", () => {
    const fixturePath = path.join(FIXTURES_DIR, "duxtel-au.html");
    expect(fs.existsSync(fixturePath)).toBe(true);
    
    const html = fs.readFileSync(fixturePath, "utf-8");
    const result = duxtelParser.parsePrice(html);
    expect(result).toBeNull();
  });

  it("should return null for invalid HTML", () => {
    const result = duxtelParser.parsePrice("<html><body>No price here</body></html>");
    expect(result).toBeNull();
  });

  it("should extract price, stock status, and currency from valid HTML", () => {
    const html = `<div><span class="price">A$749.00</span><span class="stock-status">Available</span></div>`;
    const result = duxtelParser.parsePrice(html);
    expect(result).not.toBeNull();
    expect(result!.price).toBe(749.00);
    expect(result!.currency).toBe("AUD");
    expect(result!.stockStatus).toBe("in_stock");
  });
});
