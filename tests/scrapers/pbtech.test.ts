import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { pbtechParser, scrapePbtech } from "../../lib/scrapers/pbtech";

const FIXTURES_DIR = path.join(__dirname, "../fixtures/scrapers");

describe("PBTech Parser", () => {
  it("should have correct parser config", () => {
    expect(pbtechParser.id).toBe("pbtech-nz");
    expect(pbtechParser.baseUrl).toBe("https://pbtech.co.nz");
    expect(pbtechParser.rateLimitMs).toBe(3000);
  });

  it("should build correct search URL", () => {
    const url = pbtechParser.buildSearchUrl("hAP ac3");
    expect(url).toBe("https://pbtech.co.nz/search?q=hAP%20ac3");
  });

  it("should return null for 404 page fixture", () => {
    const fixturePath = path.join(FIXTURES_DIR, "pbtech-nz.html");
    expect(fs.existsSync(fixturePath)).toBe(true);

    const html = fs.readFileSync(fixturePath, "utf-8");
    const result = pbtechParser.parsePrice(html);
    expect(result).toBeNull();
  });

  it("should return null for invalid HTML", () => {
    const result = pbtechParser.parsePrice(
      "<html><body>No price here</body></html>",
    );
    expect(result).toBeNull();
  });

  it("should extract price, stock status, and currency from valid HTML", () => {
    const html = `<div><span class="price">NZ$1,299.00</span><span class="stock-status">In Stock</span></div>`;
    const result = pbtechParser.parsePrice(html);
    expect(result).not.toBeNull();
    expect(result!.price).toBe(1299.0);
    expect(result!.currency).toBe("NZD");
    expect(result!.stockStatus).toBe("in_stock");
  });
});
