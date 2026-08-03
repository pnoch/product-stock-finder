import { describe, it, expect } from "vitest";
import { linitxParser, scrapeLinitx } from "../../lib/scrapers/linitx";

describe("Linitx Parser", () => {
  it("should have correct parser config", () => {
    expect(linitxParser.id).toBe("linitx-uk");
    expect(linitxParser.baseUrl).toBe("https://linitx.com");
    expect(linitxParser.rateLimitMs).toBe(3000);
  });

  it("should build correct search URL", () => {
    const url = linitxParser.buildSearchUrl("hAP ac3");
    expect(url).toBe("https://linitx.com/search?q=hAP%20ac3");
  });

  it("should return null for invalid HTML", () => {
    const result = linitxParser.parsePrice("<html><body>No price here</body></html>");
    expect(result).toBeNull();
  });
});
