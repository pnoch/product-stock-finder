import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { wispParser, scrapeWisp } from "../../lib/scrapers/wisp";

const FIXTURES_DIR = path.join(__dirname, "../fixtures/scrapers");

describe("Wisp Parser", () => {
  it("should have correct parser config", () => {
    expect(wispParser.id).toBe("wisp-au");
    expect(wispParser.baseUrl).toBe("https://wisp.net.au");
    expect(wispParser.rateLimitMs).toBe(3000);
  });

  it("should build correct search URL", () => {
    const url = wispParser.buildSearchUrl("hAP ac3");
    expect(url).toBe("https://wisp.net.au/search?q=hAP%20ac3");
  });

  it("should return null for 404 page fixture", () => {
    const fixturePath = path.join(FIXTURES_DIR, "wisp-au.html");
    if (!fs.existsSync(fixturePath)) {
      console.log("Fixture not found, skipping test");
      return;
    }
    
    const html = fs.readFileSync(fixturePath, "utf-8");
    const result = wispParser.parsePrice(html);
    expect(result).toBeNull();
  });

  it("should return null for invalid HTML", () => {
    const result = wispParser.parsePrice("<html><body>No price here</body></html>");
    expect(result).toBeNull();
  });
});
