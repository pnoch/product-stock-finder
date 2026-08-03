import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { balticnetworksParser, scrapeBalticNetworks } from "../../lib/scrapers/balticnetworks";

const FIXTURES_DIR = path.join(__dirname, "../fixtures/scrapers");

describe("Baltic Networks Parser", () => {
  it("should have correct parser config", () => {
    expect(balticnetworksParser.id).toBe("balticnetworks-us");
    expect(balticnetworksParser.baseUrl).toBe("https://balticnetworks.com");
    expect(balticnetworksParser.rateLimitMs).toBe(3000);
  });

  it("should build correct search URL", () => {
    const url = balticnetworksParser.buildSearchUrl("hAP ac3");
    expect(url).toBe("https://balticnetworks.com/search?q=hAP%20ac3");
  });

  it("should parse price from HTML fixture", () => {
    const fixturePath = path.join(FIXTURES_DIR, "balticnetworks-us.html");
    if (!fs.existsSync(fixturePath)) {
      console.log("Fixture not found, skipping test");
      return;
    }
    
    const html = fs.readFileSync(fixturePath, "utf-8");
    const result = balticnetworksParser.parsePrice(html);
    expect(result).not.toBeNull();
    expect(result!.price).toBeGreaterThan(0);
    expect(result!.currency).toBe("USD");
  });

  it("should return null for invalid HTML", () => {
    const result = balticnetworksParser.parsePrice("<html><body>No price here</body></html>");
    expect(result).toBeNull();
  });
});
