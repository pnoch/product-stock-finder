import { describe, it, expect, vi } from "vitest";
import { PARSERS, getParserByDistributorId } from "../lib/scrapers/registry";
import { appendPricePoint } from "../lib/price-history";
import {
  parsePriceFromText,
  inferStockStatus,
  fetchWithRateLimit,
} from "../lib/scrapers/utils";

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
      expect(parsePriceFromText("RM 1,299.00")).toBe(1299.0);
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

    it("inferStockStatus should not treat unavailable text as in stock", () => {
      expect(inferStockStatus("Currently unavailable")).toBe("out_of_stock");
      expect(inferStockStatus("Temporarily Unavailable")).toBe("out_of_stock");
      expect(inferStockStatus("Not available")).toBe("out_of_stock");
    });

    it("inferStockStatus should prefer back-order over weak in-stock signals", () => {
      expect(inferStockStatus("Backorder available")).toBe("back_order");
      expect(inferStockStatus("Pre-order available")).toBe("back_order");
    });

    it("parsePriceFromText should handle comma-decimal formats", () => {
      expect(parsePriceFromText("€ 1.234,56")).toBe(1234.56);
      expect(parsePriceFromText("1 234,56 Kč")).toBe(1234.56);
      expect(parsePriceFromText("1.234,56 €")).toBe(1234.56);
    });

    it("parsePriceFromText should handle space-grouped amounts", () => {
      expect(parsePriceFromText("R 12 345.67")).toBe(12345.67);
      expect(parsePriceFromText("12 345,67 Kč")).toBe(12345.67);
    });

    it("parsePriceFromText should treat dot-only groups of three as thousands", () => {
      // European whole-euro prices: "1.299" is 1299, not 1.299.
      expect(parsePriceFromText("1.299")).toBe(1299);
      expect(parsePriceFromText("1.299 €")).toBe(1299);
      expect(parsePriceFromText("1.234.567")).toBe(1234567);
      // A genuine 3-decimal value is not a valid currency price and is
      // normalized as thousands (documented trade-off).
      expect(parsePriceFromText("1,299.00")).toBe(1299);
    });

    it("parsePriceFromText rejects non-finite digit runs", () => {
      expect(parsePriceFromText("9".repeat(400))).toBeNull();
    });

    it("inferStockStatus should treat 'not in stock' as out of stock", () => {
      expect(inferStockStatus("Not in stock")).toBe("out_of_stock");
      expect(inferStockStatus("Currently not in stock")).toBe("out_of_stock");
      expect(inferStockStatus("Temporarily not in stock")).toBe("out_of_stock");
    });
  });

  describe("Full Scrape Cycle", () => {
    it("should run full scrape cycle with mocked HTTP", async () => {
      const mockHtml = `
        <html><body>
          <table><tr class="product">
            <td><a href="/p/crs326">MikroTik CRS326-24G-2S+</a></td>
            <td><div class="product-price">$99.99</div></td>
            <td><div class="stock-status">In Stock</div></td>
          </tr></table>
        </body></html>
      `;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockHtml),
      });

      const { scrapeServer2U } = await import("@/lib/scrapers/server2u");
      const result = await scrapeServer2U("CRS326");
      expect(result).not.toBeNull();
      expect(result?.price).toBe(99.99);
      expect(result?.currency).toBe("MYR");
      expect(result?.stockStatus).toBe("in_stock");
    });

    it("should reject a scrape whose priced row names a different product", async () => {
      const mockHtml = `
        <html><body>
          <table><tr class="product">
            <td><a href="/p/crs804">MikroTik CRS804-4DDQ-hRM</a></td>
            <td><div class="product-price">$99.99</div></td>
            <td><div class="stock-status">In Stock</div></td>
          </tr></table>
        </body></html>
      `;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockHtml),
      });

      const { scrapeServer2U } = await import("@/lib/scrapers/server2u");
      const result = await scrapeServer2U("CRS326");
      expect(result).toBeNull();
    });
  });

  describe("Error Handling", () => {
    it("should handle network failures gracefully", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
      // Actually invoke the scrape path so the rejecting fetch is exercised.
      const { scrapeServer2U } = await import("../lib/scrapers/server2u");
      const result = await scrapeServer2U("CRS326").catch(() => null);
      expect(result).toBeNull();
    });

    it("should handle 404 responses", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      // fetchWithRateLimit should throw on non-ok status
      await expect(
        fetchWithRateLimit("https://example.com/404", 0),
      ).rejects.toThrow("HTTP 404");
    });

    it("should handle 429 rate limit responses", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
      });

      await expect(
        fetchWithRateLimit("https://example.com/429", 0),
      ).rejects.toThrow("HTTP 429");
    });

    it("should handle invalid HTML gracefully", () => {
      const parser = getParserByDistributorId("server2u-my");
      expect(parser).toBeDefined();

      const result = parser?.parsePrice("<html><body>Invalid</body></html>");
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
      expect(nasstoreParser.browserOptions?.waitForSelector).toBe(
        ".product-price, .price",
      );
    });
  });

  describe("Price History", () => {
    it("should append new price points via appendPricePoint", () => {
      const history = [
        {
          date: "2026-01-01T00:00:00.000Z",
          price: 100,
          currency: "USD",
          stockStatus: "in_stock" as const,
        },
      ];
      const newPoint = {
        date: "2026-01-02T00:00:00.000Z",
        price: 95,
        currency: "USD",
        stockStatus: "in_stock" as const,
      };
      const result = appendPricePoint(
        history,
        newPoint,
        365,
        "2026-01-03T00:00:00.000Z",
      );
      expect(result).toHaveLength(2);
      expect(result[1]!.price).toBe(95);
    });
  });

  describe("Model Verification", () => {
    const MATCH_HTML = `<html><body><table><tr class="product">
      <td><span class="price nobr product-price" data-product-price data-price-container>$480.00</span>
      <a class="product-link" href="/p/crs804-4ddq-hrm">MikroTik CRS804-4DDQ-hRM</a></td>
      <td><span class="stock-status availability stock">In Stock</span></td>
    </tr></table></body></html>`;
    const MISMATCH_HTML = MATCH_HTML.replace(
      /crs804-4ddq-hrm/g,
      "crs326-24g-2s-plus",
    ).replace(/CRS804-4DDQ-hRM/g, "CRS326-24G-2S+");

    it("every parser accepts a matching row with a model supplied", () => {
      for (const parser of PARSERS) {
        expect(parser.parsePrice(MATCH_HTML, "CRS804-4DDQ-hRM")).not.toBeNull();
      }
    });

    it("every parser rejects a foreign row when a model is supplied", () => {
      for (const parser of PARSERS) {
        expect(parser.parsePrice(MISMATCH_HTML, "CRS804-4DDQ-hRM")).toBeNull();
      }
    });
  });
});
