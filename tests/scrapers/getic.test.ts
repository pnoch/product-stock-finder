import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { geticParser, scrapeGetic } from "../../lib/scrapers/getic";

const FIXTURES_DIR = path.join(__dirname, "../fixtures/scrapers");

describe("Getic Parser", () => {
  it("should have correct parser config", () => {
    expect(geticParser.id).toBe("getic-gr");
    expect(geticParser.baseUrl).toBe("https://getic.com");
    expect(geticParser.rateLimitMs).toBe(3000);
  });

  it("should build correct search URL", () => {
    const url = geticParser.buildSearchUrl("hAP ac3");
    expect(url).toBe("https://getic.com/search?q=hAP%20ac3");
  });

  it("should return null for 404 page fixture", () => {
    const fixturePath = path.join(FIXTURES_DIR, "getic-gr.html");
    expect(fs.existsSync(fixturePath)).toBe(true);

    const html = fs.readFileSync(fixturePath, "utf-8");
    const result = geticParser.parsePrice(html);
    expect(result).toBeNull();
  });

  it("should return null for invalid HTML", () => {
    const result = geticParser.parsePrice(
      "<html><body>No price here</body></html>",
    );
    expect(result).toBeNull();
  });

  it("should extract price, stock status, and currency from valid HTML", () => {
    const html = `<div><span class="price">€349.00</span><span class="stock-status">In Stock</span></div>`;
    const result = geticParser.parsePrice(html);
    expect(result).not.toBeNull();
    expect(result!.price).toBe(349.0);
    expect(result!.currency).toBe("EUR");
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
    const result = geticParser.parsePrice(MATCH_HTML, MODEL);
    expect(result).not.toBeNull();
    expect(result?.price).toBe(480);
    expect(result?.stockStatus).toBe("in_stock");
  });

  it("returns null when the priced row names a different product", () => {
    expect(geticParser.parsePrice(MISMATCH_HTML, MODEL)).toBeNull();
  });

  it("ignores verification when no model is passed", () => {
    expect(geticParser.parsePrice(MISMATCH_HTML)?.price).toBe(480);
  });

  it("parses a real getic product card (attribute-carried title)", () => {
    const CARD = `<html><body><div class="shop-product-card" data-cy="product-card">
      <div class="product-card-image"><a href="/product/cloud-router-switch-326-24g-2srm" aria-label="MikroTik CRS326-24G-2S+RM"><img alt="MikroTik CRS326-24G-2S+RM"></a></div>
      <div class="product-card-prices"><span class="product-price-value">179.81</span><span class="product-price-currency">€</span></div>
      <div class="stock-amount"></div></div></body></html>`;
    const r = geticParser.parsePrice(CARD, "CRS326-24G-2S+");
    expect(r?.price).toBe(179.81);
    expect(r?.currency).toBe("EUR");
  });

  it("rejects a real getic card for a different product", () => {
    const CARD = `<html><body><div class="shop-product-card" data-cy="product-card">
      <a href="/product/other-switch" aria-label="Other Switch X1"><img alt="Other Switch X1"></a>
      <span class="product-price-value">99.00</span></div></body></html>`;
    expect(geticParser.parsePrice(CARD, "CRS326-24G-2S+")).toBeNull();
  });
});
