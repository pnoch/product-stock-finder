import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { networkdevicesParser, scrapeNetworkDevices } from "../../lib/scrapers/networkdevices";

const FIXTURES_DIR = path.join(__dirname, "../fixtures/scrapers");

describe("Network Devices Parser", () => {
  it("should have correct parser config", () => {
    expect(networkdevicesParser.id).toBe("networkdevices-us");
    expect(networkdevicesParser.baseUrl).toBe("https://networkdevices.com");
    expect(networkdevicesParser.rateLimitMs).toBe(3000);
  });

  it("should build correct search URL", () => {
    const url = networkdevicesParser.buildSearchUrl("hAP ac3");
    expect(url).toBe("https://networkdevices.com/search?q=hAP%20ac3");
  });

  it("should return null for 404 page fixture", () => {
    const fixturePath = path.join(FIXTURES_DIR, "networkdevices-us.html");
    expect(fs.existsSync(fixturePath)).toBe(true);
    
    const html = fs.readFileSync(fixturePath, "utf-8");
    const result = networkdevicesParser.parsePrice(html);
    expect(result).toBeNull();
  });

  it("should return null for invalid HTML", () => {
    const result = networkdevicesParser.parsePrice("<html><body>No price here</body></html>");
    expect(result).toBeNull();
  });

  it("should extract price, stock status, and currency from valid HTML", () => {
    const html = `<div><span class="price">$899.00</span><span class="stock-status">In Stock</span></div>`;
    const result = networkdevicesParser.parsePrice(html);
    expect(result).not.toBeNull();
    expect(result!.price).toBe(899.00);
    expect(result!.currency).toBe("USD");
    expect(result!.stockStatus).toBe("in_stock");
  });
});
