import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { megaParser, scrapeMega } from "../../lib/scrapers/mega";

const FIXTURES_DIR = path.join(__dirname, "../fixtures/scrapers");

describe("100Mega Parser", () => {
  it("should have correct parser config", () => {
    expect(megaParser.id).toBe("100mega-cz");
    expect(megaParser.baseUrl).toBe("https://100mega.cz");
    expect(megaParser.rateLimitMs).toBe(3000);
  });

  it("should build correct search URL", () => {
    const url = megaParser.buildSearchUrl("hAP ac3");
    expect(url).toBe("https://100mega.cz/search?q=hAP%20ac3");
  });

  it("should return null for 404 page fixture", () => {
    const fixturePath = path.join(FIXTURES_DIR, "100mega-cz.html");
    if (!fs.existsSync(fixturePath)) {
      console.log("Fixture not found, skipping test");
      return;
    }
    
    const html = fs.readFileSync(fixturePath, "utf-8");
    const result = megaParser.parsePrice(html);
    expect(result).toBeNull();
  });

  it("should return null for invalid HTML", () => {
    const result = megaParser.parsePrice("<html><body>No price here</body></html>");
    expect(result).toBeNull();
  });
});
