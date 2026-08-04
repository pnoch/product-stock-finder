import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { hellascomParser, scrapeHellascom } from "../../lib/scrapers/hellascom";

const FIXTURES_DIR = path.join(__dirname, "../fixtures/scrapers");

describe("Hellascom Parser", () => {
  it("should have correct parser config", () => {
    expect(hellascomParser.id).toBe("hellascom-gr");
    expect(hellascomParser.baseUrl).toBe("https://hellascom.gr");
    expect(hellascomParser.rateLimitMs).toBe(3000);
  });

  it("should build correct search URL", () => {
    const url = hellascomParser.buildSearchUrl("hAP ac3");
    expect(url).toBe("https://hellascom.gr/search?q=hAP%20ac3");
  });

  it("should return null for 404 page fixture", () => {
    const fixturePath = path.join(FIXTURES_DIR, "hellascom-gr.html");
    if (!fs.existsSync(fixturePath)) {
      console.log("Fixture not found, skipping test");
      return;
    }
    
    const html = fs.readFileSync(fixturePath, "utf-8");
    const result = hellascomParser.parsePrice(html);
    expect(result).toBeNull();
  });

  it("should return null for invalid HTML", () => {
    const result = hellascomParser.parsePrice("<html><body>No price here</body></html>");
    expect(result).toBeNull();
  });

  it("should extract price, stock status, and currency from valid HTML", () => {
    const html = `<div><span class="price">€279.00</span><span class="stock-status">In Stock</span></div>`;
    const result = hellascomParser.parsePrice(html);
    expect(result).not.toBeNull();
    expect(result!.price).toBe(279.00);
    expect(result!.currency).toBe("EUR");
    expect(result!.stockStatus).toBe("in_stock");
  });
});
