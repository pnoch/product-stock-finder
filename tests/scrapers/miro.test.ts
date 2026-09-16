import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { miroParser, scrapeMiro } from "../../lib/scrapers/miro";

const FIXTURES_DIR = path.join(__dirname, "../fixtures/scrapers");

describe("Miro Parser", () => {
  it("should have correct parser config", () => {
    expect(miroParser.id).toBe("miro-za");
    expect(miroParser.baseUrl).toBe("https://miro.co.za");
    expect(miroParser.rateLimitMs).toBe(3000);
  });

  it("should build correct search URL", () => {
    const url = miroParser.buildSearchUrl("hAP ac3");
    expect(url).toBe("https://miro.co.za/search?s=hAP%20ac3");
  });

  it("should return null for 404 page fixture", () => {
    const fixturePath = path.join(FIXTURES_DIR, "miro-za.html");
    expect(fs.existsSync(fixturePath)).toBe(true);

    const html = fs.readFileSync(fixturePath, "utf-8");
    const result = miroParser.parsePrice(html);
    expect(result).toBeNull();
  });

  it("should return null for invalid HTML", () => {
    const result = miroParser.parsePrice(
      "<html><body>No price here</body></html>",
    );
    expect(result).toBeNull();
  });

  it("should extract price, stock status, and currency from valid HTML", () => {
    const html = `<div><span class="price">R 4,599.00</span><span class="stock-status">In Stock</span></div>`;
    const result = miroParser.parsePrice(html);
    expect(result).not.toBeNull();
    expect(result!.price).toBe(4599.0);
    expect(result!.currency).toBe("ZAR");
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
    const result = miroParser.parsePrice(MATCH_HTML, MODEL);
    expect(result).not.toBeNull();
    expect(result?.price).toBe(480);
    expect(result?.stockStatus).toBe("in_stock");
  });

  it("returns null when the priced row names a different product", () => {
    expect(miroParser.parsePrice(MISMATCH_HTML, MODEL)).toBeNull();
  });

  it("ignores verification when no model is passed", () => {
    expect(miroParser.parsePrice(MISMATCH_HTML)?.price).toBe(480);
  });
});
