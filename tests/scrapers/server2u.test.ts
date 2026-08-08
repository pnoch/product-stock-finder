import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { server2uParser, scrapeServer2U } from "../../lib/scrapers/server2u";

const FIXTURES_DIR = path.join(__dirname, "../fixtures/scrapers");

describe("Server2U Parser", () => {
  it("should have correct parser config", () => {
    expect(server2uParser.id).toBe("server2u-my");
    expect(server2uParser.baseUrl).toBe("https://server2u.com");
    expect(server2uParser.rateLimitMs).toBe(2000);
  });

  it("should build correct search URL", () => {
    const url = server2uParser.buildSearchUrl("hAP ac3");
    expect(url).toBe("https://server2u.com/shop?q=hAP%20ac3");
  });

  it("should return null for 404 page fixture", () => {
    const fixturePath = path.join(FIXTURES_DIR, "server2u-my.html");
    expect(fs.existsSync(fixturePath)).toBe(true);
    
    const html = fs.readFileSync(fixturePath, "utf-8");
    const result = server2uParser.parsePrice(html);
    expect(result).toBeNull();
  });

  it("should return null for invalid HTML", () => {
    const result = server2uParser.parsePrice("<html><body>No price here</body></html>");
    expect(result).toBeNull();
  });

  it("should extract price, stock status, and currency from valid HTML", () => {
    const html = `<div><span class="price">RM 1,299.00</span><span class="stock-status">In Stock</span></div>`;
    const result = server2uParser.parsePrice(html);
    expect(result).not.toBeNull();
    expect(result!.price).toBe(1299.00);
    expect(result!.currency).toBe("MYR");
    expect(result!.stockStatus).toBe("in_stock");
  });
});
