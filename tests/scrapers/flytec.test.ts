import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { flytecParser } from "../../lib/scrapers/flytec";

describe("Flytec Parser", () => {
  it("should have correct parser config", () => {
    expect(flytecParser.id).toBe("flytec-us");
    expect(flytecParser.baseUrl).toBe("https://flyteccomputers.com");
    expect(flytecParser.rateLimitMs).toBe(3000);
  });

  it("should build correct search URL", () => {
    const url = flytecParser.buildSearchUrl("hAP ac3");
    expect(url).toBe("https://flyteccomputers.com/search.php?search_query=hAP%20ac3");
  });

  it("should return null for invalid HTML", () => {
    const result = flytecParser.parsePrice(
      "<html><body>No price here</body></html>",
    );
    expect(result).toBeNull();
  });

  it("should extract price, stock status, and currency from valid HTML", () => {
    const html = `<div><span class="price">$449.99</span><span class="stock-status">In Stock</span></div>`;
    const result = flytecParser.parsePrice(html);
    expect(result).not.toBeNull();
    expect(result!.price).toBe(449.99);
    expect(result!.currency).toBe("USD");
    expect(result!.stockStatus).toBe("in_stock");
  });

  it("does not read the model number as the price when both share the price cell", () => {
    const html = `<div><span data-product-price-without-tax>CRS804-4DDQ+RM $480.00</span></div>`;
    const result = flytecParser.parsePrice(html, "CRS804-4DDQ+RM");
    expect(result?.price).toBe(480);
  });

  // The real search-results fixture is ~570 KB with 8 product cards. The
  // model-mismatch path evaluates every price selector against every candidate,
  // re-checking the same card context many times. Without a per-call memo of
  // `matchesModel` this took ~4.2s and intermittently blew the 5s test timeout
  // in the conformance sweep. The bound is generous (fixed ~0.2s) to stay
  // non-flaky on loaded CI.
  it("rejects a no-such-model on the large search fixture quickly", () => {
    const dir = path.join(__dirname, "../fixtures/scrapers");
    const file = fs
      .readdirSync(dir)
      .find((f) => f === "flytec-us.html" || f.startsWith("flytec-us-"))!;
    const html = fs.readFileSync(path.join(dir, file), "utf8");
    const started = performance.now();
    const result = flytecParser.parsePrice(html, "__NO_SUCH_MODEL__");
    const elapsed = performance.now() - started;
    expect(result).toBeNull();
    expect(elapsed).toBeLessThan(1500);
  }, 10_000);
});
