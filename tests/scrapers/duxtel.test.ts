import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { duxtelParser, scrapeDuxtel } from "../../lib/scrapers/duxtel";

const FIXTURES_DIR = path.join(__dirname, "../fixtures/scrapers");

describe("Duxtel Parser", () => {
  it("should have correct parser config", () => {
    expect(duxtelParser.id).toBe("duxtel-au");
    expect(duxtelParser.baseUrl).toBe("https://store.duxtel.com");
    expect(duxtelParser.rateLimitMs).toBe(3000);
  });

  it("should build correct search URL", () => {
    const url = duxtelParser.buildSearchUrl("hAP ac3");
    expect(url).toBe("https://store.duxtel.com/index.php?route=product/search&search=hAP%20ac3");
  });

  it("should return null for 404 page fixture", () => {
    const fixturePath = path.join(FIXTURES_DIR, "duxtel-au.html");
    expect(fs.existsSync(fixturePath)).toBe(true);

    const html = fs.readFileSync(fixturePath, "utf-8");
    const result = duxtelParser.parsePrice(html);
    expect(result).toBeNull();
  });

  it("should return null for invalid HTML", () => {
    const result = duxtelParser.parsePrice(
      "<html><body>No price here</body></html>",
    );
    expect(result).toBeNull();
  });

  it("should extract price, stock status, and currency from valid HTML", () => {
    const html = `<div><span class="price">A$749.00</span><span class="stock-status">Available</span></div>`;
    const result = duxtelParser.parsePrice(html);
    expect(result).not.toBeNull();
    expect(result!.price).toBe(749.0);
    expect(result!.currency).toBe("AUD");
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
    const result = duxtelParser.parsePrice(MATCH_HTML, MODEL);
    expect(result).not.toBeNull();
    expect(result?.price).toBe(480);
    expect(result?.stockStatus).toBe("in_stock");
  });

  it("returns null when the priced row names a different product", () => {
    expect(duxtelParser.parsePrice(MISMATCH_HTML, MODEL)).toBeNull();
  });

  it("ignores verification when no model is passed", () => {
    expect(duxtelParser.parsePrice(MISMATCH_HTML)?.price).toBe(480);
  });
});
