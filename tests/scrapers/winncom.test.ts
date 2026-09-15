import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { winncomParser, scrapeWinncom } from "../../lib/scrapers/winncom";

const FIXTURES_DIR = path.join(__dirname, "../fixtures/scrapers");

describe("Winncom Parser", () => {
  it("should have correct parser config", () => {
    expect(winncomParser.id).toBe("winncom-us");
    expect(winncomParser.baseUrl).toBe("https://winncom.com");
    expect(winncomParser.rateLimitMs).toBe(3000);
  });

  it("should build correct search URL", () => {
    const url = winncomParser.buildSearchUrl("hAP ac3");
    expect(url).toBe("https://winncom.com/search?q=hAP%20ac3");
  });

  it("should return null for 404 page fixture", () => {
    const fixturePath = path.join(FIXTURES_DIR, "winncom-us.html");
    expect(fs.existsSync(fixturePath)).toBe(true);

    const html = fs.readFileSync(fixturePath, "utf-8");
    const result = winncomParser.parsePrice(html);
    expect(result).toBeNull();
  });

  it("should return null for invalid HTML", () => {
    const result = winncomParser.parsePrice(
      "<html><body>No price here</body></html>",
    );
    expect(result).toBeNull();
  });

  it("should extract price, stock status, and currency from valid HTML", () => {
    const html = `<div><span class="price">$599.99</span><span class="stock-status">In Stock</span></div>`;
    const result = winncomParser.parsePrice(html);
    expect(result).not.toBeNull();
    expect(result!.price).toBe(599.99);
    expect(result!.currency).toBe("USD");
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
    const result = winncomParser.parsePrice(MATCH_HTML, MODEL);
    expect(result).not.toBeNull();
    expect(result?.price).toBe(480);
    expect(result?.stockStatus).toBe("in_stock");
  });

  it("returns null when the priced row names a different product", () => {
    expect(winncomParser.parsePrice(MISMATCH_HTML, MODEL)).toBeNull();
  });

  it("ignores verification when no model is passed", () => {
    expect(winncomParser.parsePrice(MISMATCH_HTML)?.price).toBe(480);
  });

  it("does not parse the model number as the price when the title link precedes it", () => {
    // Regression: the selector used to include `.product-link` and the bare
    // `.nobr` class (which on Winncom is the model-code cell), so the model
    // text ("CRS804-4DDQ-hRM") was parsed as the price (804).
    const html = `<html><body><div class="product">
      <a class="product-link" href="/p/crs804-4ddq-hrm">MikroTik CRS804-4DDQ-hRM</a>
      <span class="nobr itcode">CRS804-4DDQ-hRM</span>
      <span class="product-price" data-product-price>$480.00</span>
    </div></body></html>`;
    const result = winncomParser.parsePrice(html, MODEL);
    expect(result?.price).toBe(480);
  });
});
