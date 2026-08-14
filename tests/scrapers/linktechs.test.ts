import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { linktechsParser, scrapeLinktechs } from "../../lib/scrapers/linktechs";

const FIXTURES_DIR = path.join(__dirname, "../fixtures/scrapers");

describe("Linktechs Parser", () => {
  it("should have correct parser config", () => {
    expect(linktechsParser.id).toBe("linktechs-us");
    expect(linktechsParser.baseUrl).toBe("https://linktechs.com");
    expect(linktechsParser.rateLimitMs).toBe(3000);
  });

  it("should build correct search URL", () => {
    const url = linktechsParser.buildSearchUrl("hAP ac3");
    expect(url).toBe("https://linktechs.com/search?q=hAP%20ac3");
  });

  it("should return null for 404 page fixture", () => {
    const fixturePath = path.join(FIXTURES_DIR, "linktechs-us.html");
    expect(fs.existsSync(fixturePath)).toBe(true);

    const html = fs.readFileSync(fixturePath, "utf-8");
    const result = linktechsParser.parsePrice(html);
    expect(result).toBeNull();
  });

  it("should return null for invalid HTML", () => {
    const result = linktechsParser.parsePrice(
      "<html><body>No price here</body></html>",
    );
    expect(result).toBeNull();
  });

  it("should extract price, stock status, and currency from valid HTML", () => {
    const html = `<div><span class="price">$329.99</span><span class="stock-status">In Stock</span></div>`;
    const result = linktechsParser.parsePrice(html);
    expect(result).not.toBeNull();
    expect(result!.price).toBe(329.99);
    expect(result!.currency).toBe("USD");
    expect(result!.stockStatus).toBe("in_stock");
  });
});
