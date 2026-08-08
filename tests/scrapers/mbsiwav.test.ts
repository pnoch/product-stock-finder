import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { mbsiwavParser, scrapeMbsiwav } from "../../lib/scrapers/mbsiwav";

const FIXTURES_DIR = path.join(__dirname, "../fixtures/scrapers");

describe("Mbsiwav Parser", () => {
  it("should have correct parser config", () => {
    expect(mbsiwavParser.id).toBe("mbsiwav-ca");
    expect(mbsiwavParser.baseUrl).toBe("https://mbsiwav.com");
    expect(mbsiwavParser.rateLimitMs).toBe(3000);
  });

  it("should build correct search URL", () => {
    const url = mbsiwavParser.buildSearchUrl("hAP ac3");
    expect(url).toBe("https://mbsiwav.com/search?q=hAP%20ac3");
  });

  it("should return null for 404 page fixture", () => {
    const fixturePath = path.join(FIXTURES_DIR, "mbsiwav-ca.html");
    expect(fs.existsSync(fixturePath)).toBe(true);
    
    const html = fs.readFileSync(fixturePath, "utf-8");
    const result = mbsiwavParser.parsePrice(html);
    expect(result).toBeNull();
  });

  it("should return null for invalid HTML", () => {
    const result = mbsiwavParser.parsePrice("<html><body>No price here</body></html>");
    expect(result).toBeNull();
  });

  it("should extract price, stock status, and currency from valid HTML", () => {
    const html = `<div><span class="price">C$399.00</span><span class="stock-status">In Stock</span></div>`;
    const result = mbsiwavParser.parsePrice(html);
    expect(result).not.toBeNull();
    expect(result!.price).toBe(399.00);
    expect(result!.currency).toBe("CAD");
    expect(result!.stockStatus).toBe("in_stock");
  });
});
