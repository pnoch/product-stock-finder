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
    expect(url).toBe("https://linitx.com/search.php?keywords=hAP%20ac3");
  });

  it("should return null for invalid HTML", () => {
    const result = linitxParser.parsePrice(
      "<html><body>No price here</body></html>",
    );
    expect(result).toBeNull();
  });

  it("should extract price, stock status, and currency from valid HTML", () => {
    const html = `<div><span class="product__price">£299.00</span><span class="product__stock">In Stock</span></div>`;
    const result = linitxParser.parsePrice(html);
    expect(result).not.toBeNull();
    expect(result!.price).toBe(299.0);
    expect(result!.currency).toBe("GBP");
    expect(result!.stockStatus).toBe("in_stock");
  });
});


describe("model verification", () => {
  const MODEL = "CRS804-4DDQ-hRM";
  const MATCH_HTML = `<html><body><table><tr class="product">
    <td><span class="price nobr product-price" data-product-price data-price-container>$480.00</span>
    <a class="product-link" href="/p/crs804-4ddq-hrm">MikroTik CRS804-4DDQ-hRM</a></td>
    <td><span class="stock-status availability stock">In Stock</span></td>
  </tr></table></body></html>`;
  const MISMATCH_HTML = MATCH_HTML.replace(
    /crs804-4ddq-hrm/g,
    "crs326-24g-2s-plus",
  ).replace(/CRS804-4DDQ-hRM/g, "CRS326-24G-2S+");

  it("accepts a row that names the requested model", () => {
    const result = linitxParser.parsePrice(MATCH_HTML, MODEL);
    expect(result).not.toBeNull();
    expect(result?.price).toBe(480);
    expect(result?.stockStatus).toBe("in_stock");
  });

  it("returns null when the priced row names a different product", () => {
    expect(linitxParser.parsePrice(MISMATCH_HTML, MODEL)).toBeNull();
  });

  it("ignores verification when no model is passed", () => {
    expect(linitxParser.parsePrice(MISMATCH_HTML)?.price).toBe(480);
  });
});
