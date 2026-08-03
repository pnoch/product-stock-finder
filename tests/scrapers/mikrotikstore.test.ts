import { describe, it, expect } from "vitest";
import { mikrotikstoreParser, scrapeMikrotikStore } from "../../lib/scrapers/mikrotikstore";

describe("MikroTik Store Parser", () => {
  it("should have correct parser config", () => {
    expect(mikrotikstoreParser.id).toBe("mikrotikstore-de");
    expect(mikrotikstoreParser.baseUrl).toBe("https://mikrotikstore.de");
    expect(mikrotikstoreParser.rateLimitMs).toBe(3000);
  });

  it("should build correct search URL", () => {
    const url = mikrotikstoreParser.buildSearchUrl("hAP ac3");
    expect(url).toBe("https://mikrotikstore.de/search?q=hAP%20ac3");
  });

  it("should return null for invalid HTML", () => {
    const result = mikrotikstoreParser.parsePrice("<html><body>No price here</body></html>");
    expect(result).toBeNull();
  });
});
