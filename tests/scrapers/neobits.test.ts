import { describe, it, expect } from "vitest";
import { neobitsParser, scrapeNeobits } from "../../lib/scrapers/neobits";

describe("Neobits Parser", () => {
  it("should have correct parser config", () => {
    expect(neobitsParser.id).toBe("neobits-us");
    expect(neobitsParser.baseUrl).toBe("https://neobits.com");
    expect(neobitsParser.rateLimitMs).toBe(3000);
  });

  it("should build correct search URL", () => {
    const url = neobitsParser.buildSearchUrl("hAP ac3");
    expect(url).toBe("https://neobits.com/search?q=hAP%20ac3");
  });

  it("should return null for invalid HTML", () => {
    const result = neobitsParser.parsePrice("<html><body>No price here</body></html>");
    expect(result).toBeNull();
  });
});
