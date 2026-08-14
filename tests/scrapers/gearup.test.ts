import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { gearupParser, scrapeGearup } from "../../lib/scrapers/gearup";

const FIXTURES_DIR = path.join(__dirname, "../fixtures/scrapers");

describe("Gearup Parser", () => {
  it("should have correct parser config", () => {
    expect(gearupParser.id).toBe("gearup-ae");
    expect(gearupParser.baseUrl).toBe("https://gearup.me");
    expect(gearupParser.rateLimitMs).toBe(3000);
  });

  it("should build correct search URL", () => {
    const url = gearupParser.buildSearchUrl("hAP ac3");
    expect(url).toBe("https://gearup.me/search?q=hAP%20ac3");
  });

  it("should return null for 404 page fixture", () => {
    const fixturePath = path.join(FIXTURES_DIR, "gearup-ae.html");
    expect(fs.existsSync(fixturePath)).toBe(true);

    const html = fs.readFileSync(fixturePath, "utf-8");
    const result = gearupParser.parsePrice(html);
    expect(result).toBeNull();
  });

  it("should return null for invalid HTML", () => {
    const result = gearupParser.parsePrice(
      "<html><body>No price here</body></html>",
    );
    expect(result).toBeNull();
  });

  it("should extract price, stock status, and currency from valid HTML", () => {
    const html = `<div><span class="price">1099.00 AED</span><span class="stock-status">In Stock</span></div>`;
    const result = gearupParser.parsePrice(html);
    expect(result).not.toBeNull();
    expect(result!.price).toBe(1099.0);
    expect(result!.currency).toBe("AED");
    expect(result!.stockStatus).toBe("in_stock");
  });
});
