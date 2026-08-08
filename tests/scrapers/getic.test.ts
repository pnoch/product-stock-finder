import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { geticParser, scrapeGetic } from "../../lib/scrapers/getic";

const FIXTURES_DIR = path.join(__dirname, "../fixtures/scrapers");

describe("Getic Parser", () => {
  it("should have correct parser config", () => {
    expect(geticParser.id).toBe("getic-gr");
    expect(geticParser.baseUrl).toBe("https://getic.gr");
    expect(geticParser.rateLimitMs).toBe(3000);
  });

  it("should build correct search URL", () => {
    const url = geticParser.buildSearchUrl("hAP ac3");
    expect(url).toBe("https://getic.gr/search?q=hAP%20ac3");
  });

  it("should return null for 404 page fixture", () => {
    const fixturePath = path.join(FIXTURES_DIR, "getic-gr.html");
    expect(fs.existsSync(fixturePath)).toBe(true);
    
    const html = fs.readFileSync(fixturePath, "utf-8");
    const result = geticParser.parsePrice(html);
    expect(result).toBeNull();
  });

  it("should return null for invalid HTML", () => {
    const result = geticParser.parsePrice("<html><body>No price here</body></html>");
    expect(result).toBeNull();
  });

  it("should extract price, stock status, and currency from valid HTML", () => {
    const html = `<div><span class="price">€349.00</span><span class="stock-status">In Stock</span></div>`;
    const result = geticParser.parsePrice(html);
    expect(result).not.toBeNull();
    expect(result!.price).toBe(349.00);
    expect(result!.currency).toBe("EUR");
    expect(result!.stockStatus).toBe("in_stock");
  });
});
