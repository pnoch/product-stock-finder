import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { rocnocParser } from "../../lib/scrapers/rocnoc";

const FIXTURES_DIR = path.join(__dirname, "../fixtures/scrapers");

describe("Rocnoc Parser", () => {
  it("should have correct parser config", () => {
    expect(rocnocParser.id).toBe("rocnoc-us");
    expect(rocnocParser.baseUrl).toBe("https://www.roc-noc.com");
    expect(rocnocParser.rateLimitMs).toBe(3000);
  });

  it("should build correct search URL", () => {
    const url = rocnocParser.buildSearchUrl("hAP ac3");
    expect(url).toBe(
      "https://www.roc-noc.com/search.php?mode=search&substring=hAP%20ac3",
    );
  });

  it("should return null for invalid HTML", () => {
    const result = rocnocParser.parsePrice(
      "<html><body>No price here</body></html>",
    );
    expect(result).toBeNull();
  });

  it("should extract price, stock status, and currency from valid HTML", () => {
    const html = `<div><span class="price">$379.00</span><span class="stock-status">In Stock</span></div>`;
    const result = rocnocParser.parsePrice(html);
    expect(result).not.toBeNull();
    expect(result!.price).toBe(379.0);
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
    const result = rocnocParser.parsePrice(MATCH_HTML, MODEL);
    expect(result).not.toBeNull();
    expect(result?.price).toBe(480);
    expect(result?.stockStatus).toBe("in_stock");
  });

  it("returns null when the priced row names a different product", () => {
    expect(rocnocParser.parsePrice(MISMATCH_HTML, MODEL)).toBeNull();
  });

  it("ignores verification when no model is passed", () => {
    expect(rocnocParser.parsePrice(MISMATCH_HTML)?.price).toBe(480);
  });
});

describe("ROC-NOC matrix table", () => {
  const html = () =>
    fs.readFileSync(path.join(FIXTURES_DIR, "rocnoc-us-search.html"), "utf-8");

  it("reads the price from the model's column", () => {
    const result = rocnocParser.parsePrice(html(), "CRS326-24G-2S+RM");
    expect(result).not.toBeNull();
    expect(result!.price).toBe(209);
    expect(result!.currency).toBe("USD");
    expect(result!.stockStatus).toBe("in_stock");
  });

  it("reads the out-of-stock quantity in a different column", () => {
    const result = rocnocParser.parsePrice(html(), "CRS326-24S+2Q+RM");
    expect(result).not.toBeNull();
    expect(result!.price).toBe(599);
    expect(result!.stockStatus).toBe("out_of_stock");
  });

  it("returns null when no column names the model", () => {
    expect(rocnocParser.parsePrice(html(), "CRS804-4DDQ-hRM")).toBeNull();
  });
});
