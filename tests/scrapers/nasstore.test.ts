import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { nasstoreParser, scrapeNasstore } from "../../lib/scrapers/nasstore";

const FIXTURES_DIR = path.join(__dirname, "../fixtures/scrapers");

describe("Nasstore Parser", () => {
  it("should have correct parser config", () => {
    expect(nasstoreParser.id).toBe("nasstore-eu");
    expect(nasstoreParser.baseUrl).toBe("https://nasstore.eu");
    expect(nasstoreParser.rateLimitMs).toBe(3000);
  });

  it("should build correct search URL", () => {
    const url = nasstoreParser.buildSearchUrl("hAP ac3");
    expect(url).toBe("https://nasstore.eu/search?q=hAP%20ac3");
  });

  it("should return null for 404 page fixture", () => {
    const fixturePath = path.join(FIXTURES_DIR, "nasstore-eu.html");
    if (!fs.existsSync(fixturePath)) {
      console.log("Fixture not found, skipping test");
      return;
    }
    
    const html = fs.readFileSync(fixturePath, "utf-8");
    const result = nasstoreParser.parsePrice(html);
    expect(result).toBeNull();
  });

  it("should return null for invalid HTML", () => {
    const result = nasstoreParser.parsePrice("<html><body>No price here</body></html>");
    expect(result).toBeNull();
  });
});
