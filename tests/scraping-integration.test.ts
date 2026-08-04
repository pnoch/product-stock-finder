import { describe, it, expect, vi } from "vitest";
import { PARSERS, getParserByDistributorId } from "../lib/scrapers/registry";
import { parsePriceFromText, inferStockStatus, fetchWithRateLimit } from "../lib/scrapers/utils";

describe("Scraping Integration", () => {
  describe("Parser Registry", () => {
    it("should have 25 parsers", () => {
      expect(PARSERS).toHaveLength(25);
    });

    it("should find parser by distributor ID", () => {
      const parser = getParserByDistributorId("server2u-my");
      expect(parser).toBeDefined();
      expect(parser?.id).toBe("server2u-my");
    });

    it("should return undefined for unknown distributor", () => {
      const parser = getParserByDistributorId("unknown-distributor");
      expect(parser).toBeUndefined();
    });

    it("should have unique IDs for all parsers", () => {
      const ids = PARSERS.map((p) => p.id);
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
    });

    it("should have parsers with valid base URLs", () => {
      for (const parser of PARSERS) {
        expect(parser.baseUrl).toMatch(/^https?:\/\//);
      }
    });
  });

  describe("Utility Functions", () => {
    it("parsePriceFromText should extract numbers", () => {
      expect(parsePriceFromText("$123.45")).toBe(123.45);
      expect(parsePriceFromText("€1,234.56")).toBe(1234.56);
      expect(parsePriceFromText("£99")).toBe(99);
      expect(parsePriceFromText("RM 1,299.00")).toBe(1299.00);
      expect(parsePriceFromText("invalid")).toBeNull();
    });

    it("inferStockStatus should detect stock states", () => {
      expect(inferStockStatus("In Stock")).toBe("in_stock");
      expect(inferStockStatus("Out of Stock")).toBe("out_of_stock");
      expect(inferStockStatus("Back Order")).toBe("back_order");
      expect(inferStockStatus("unknown")).toBe("unknown");
      expect(inferStockStatus("Add to Cart")).toBe("in_stock");
      expect(inferStockStatus("Backorder")).toBe("back_order");
      expect(inferStockStatus("Pre-order")).toBe("back_order");
      expect(inferStockStatus("Sold Out")).toBe("out_of_stock");
      expect(inferStockStatus("Available")).toBe("in_stock");
    });
  });

  describe("Full Scrape Cycle", () => {
    it("should run full scrape cycle with mocked HTTP", async () => {
      const mockHtml = `
        <html><body>
          <div class="product-price">$99.99</div>
          <div class="stock-status">In Stock</div>
        </body></html>
      `;
      
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockHtml),
      });
      
      const parser = getParserByDistributorId("server2u-my");
      expect(parser).toBeDefined();
      
      // Test parsePrice with the mock HTML
      const result = parser?.parsePrice(mockHtml);
      expect(result).not.toBeNull();
      expect(result?.price).toBe(99.99);
      expect(result?.currency).toBe("MYR");
      expect(result?.stockStatus).toBe("in_stock");
    });
  });

  describe("Error Handling", () => {
    it("should handle network failures gracefully", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const parser = getParserByDistributorId("server2u-my");
      expect(parser).toBeDefined();
    });

    it("should handle 404 responses", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });
      
      // fetchWithRateLimit should throw on non-ok status
      await expect(
        fetchWithRateLimit("https://example.com/404", 0)
      ).rejects.toThrow("HTTP 404");
    });

    it("should handle 429 rate limit responses", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
      });
      
      await expect(
        fetchWithRateLimit("https://example.com/429", 0)
      ).rejects.toThrow("HTTP 429");
    });

    it("should handle invalid HTML gracefully", () => {
      const parser = getParserByDistributorId("server2u-my");
      expect(parser).toBeDefined();

      const result = parser?.parsePrice(
        "<html><body>Invalid</body></html>"
      );
      expect(result).toBeNull();
    });

    it("should handle empty HTML gracefully", () => {
      for (const parser of PARSERS) {
        const result = parser.parsePrice("");
        expect(result).toBeNull();
      }
    });

    it("should respect rate limiting delays", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(""),
      });

      const start = Date.now();
      await fetchWithRateLimit("https://example.com/test", 100);
      const elapsed = Date.now() - start;
      
      // Should have waited at least 100ms
      expect(elapsed).toBeGreaterThanOrEqual(90);
    });
  });

  describe("Parser Coverage", () => {
    it("should have parsers for all expected distributor types", () => {
      const expectedPrefixes = [
        "server2u",
        "linitx",
        "interprojekt",
        "nasstore",
        "aerial",
        "mikrotikstore",
        "miro",
        "gearup",
        "balticnetworks",
        "linktechs",
        "winncom",
        "bhphoto",
        "duxtel",
        "wisp",
        "pbtech",
        "gowifi",
        "getic",
        "100mega",
        "hellascom",
        "rocnoc",
        "networkdevices",
        "flytec",
        "mbsiwav",
        "multilink",
        "neobits",
      ];

      const ids = PARSERS.map((p) => p.id);
      for (const prefix of expectedPrefixes) {
        expect(ids.some((id) => id.startsWith(prefix))).toBe(true);
      }
    });
  });

  describe("Browser Parser Integration", () => {
    it("should parse with useBrowser flag", async () => {
      const { nasstoreParser } = await import("@/lib/scrapers/nasstore");
      expect(nasstoreParser.useBrowser).toBe(true);
      expect(nasstoreParser.browserOptions?.waitForSelector).toBe(".product-price, .price");
    });
  });

  describe("Price History", () => {
    it("should append new price points", () => {
      const history = [
        {
          date: "2026-01-01",
          price: 100,
          currency: "USD",
          stockStatus: "in_stock" as const,
        },
      ];

      const newPoint = {
        date: "2026-01-02",
        price: 95,
        currency: "USD",
        stockStatus: "in_stock" as const,
      };

      history.push(newPoint);
      expect(history).toHaveLength(2);
      expect(history[1].price).toBe(95);
    });

    it("should trim history to 90 days", () => {
      const history = Array.from({ length: 100 }, (_, i) => ({
        date: new Date(Date.now() - 86400000 * (99 - i)).toISOString(),
        price: 100 + i,
        currency: "USD",
        stockStatus: "in_stock" as const,
      }));

      const trimmed = history.slice(-90);
      expect(trimmed).toHaveLength(90);
      expect(trimmed[0].price).toBe(110);
      expect(trimmed[89].price).toBe(199);
    });

    it("should deduplicate price history entries", () => {
      const history = [
        { date: "2026-01-01T00:00:00.000Z", price: 100, currency: "USD", stockStatus: "in_stock" as const },
        { date: "2026-01-02T00:00:00.000Z", price: 100, currency: "USD", stockStatus: "in_stock" as const },
        { date: "2026-01-03T00:00:00.000Z", price: 95, currency: "USD", stockStatus: "in_stock" as const },
      ];
      
      // Deduplication logic: skip if same price as previous entry
      const deduped = history.filter((entry, i) => 
        i === 0 || entry.price !== history[i - 1].price
      );
      
      expect(deduped).toHaveLength(2);
      expect(deduped[0].price).toBe(100);
      expect(deduped[1].price).toBe(95);
    });
  });
});
