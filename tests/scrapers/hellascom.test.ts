import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { hellascomParser, scrapeHellascom } from "../../lib/scrapers/hellascom";

const FIXTURES_DIR = path.join(__dirname, "../fixtures/scrapers");

describe("Hellascom Parser", () => {
  it("should have correct parser config", () => {
    expect(hellascomParser.id).toBe("hellascom-gr");
    expect(hellascomParser.baseUrl).toBe("https://hellascom.gr");
    expect(hellascomParser.rateLimitMs).toBe(3000);
  });

  it("should build correct search URL", () => {
    const url = hellascomParser.buildSearchUrl("hAP ac3");
    expect(url).toBe("https://hellascom.gr/search?q=hAP%20ac3");
  });

  it("should return null for 404 page fixture", () => {
    const fixturePath = path.join(FIXTURES_DIR, "hellascom-gr.html");
    expect(fs.existsSync(fixturePath)).toBe(true);

    const html = fs.readFileSync(fixturePath, "utf-8");
    const result = hellascomParser.parsePrice(html);
    expect(result).toBeNull();
  });

  it("should return null for invalid HTML", () => {
    const result = hellascomParser.parsePrice(
      "<html><body>No price here</body></html>",
    );
    expect(result).toBeNull();
  });

  it("should extract price, stock status, and currency from valid HTML", () => {
    const html = `<div><span class="price">€279.00</span><span class="stock-status">In Stock</span></div>`;
    const result = hellascomParser.parsePrice(html);
    expect(result).not.toBeNull();
    expect(result!.price).toBe(279.0);
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
    const result = hellascomParser.parsePrice(MATCH_HTML, MODEL);
    expect(result).not.toBeNull();
    expect(result?.price).toBe(480);
    expect(result?.stockStatus).toBe("in_stock");
  });

  it("returns null when the priced row names a different product", () => {
    expect(hellascomParser.parsePrice(MISMATCH_HTML, MODEL)).toBeNull();
  });

  it("ignores verification when no model is passed", () => {
    expect(hellascomParser.parsePrice(MISMATCH_HTML)?.price).toBe(480);
  });
});
