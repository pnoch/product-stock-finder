import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { hellascomParser } from "../../lib/scrapers/hellascom";

const FIXTURES_DIR = path.join(__dirname, "../fixtures/scrapers");

describe("Hellascom Parser", () => {
  it("should have correct parser config", () => {
    expect(hellascomParser.id).toBe("hellascom-gr");
    expect(hellascomParser.baseUrl).toBe("https://www.linkshop.gr");
    expect(hellascomParser.rateLimitMs).toBe(3000);
  });

  it("should build correct search URL", () => {
    const url = hellascomParser.buildSearchUrl("hAP ac3");
    expect(url).toBe(
      "https://www.linkshop.gr/?dispatch=products.search&q=hAP%20ac3&search_performed=Y",
    );
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
    const html = `<div><span class="ty-grid-list__price">€279.00</span><span class="stock-status">In Stock</span></div>`;
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
    <td><span class="ty-grid-list__price">$480.00</span>
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

describe("HellasCom linkshop.gr grid", () => {
  const html = () =>
    fs.readFileSync(path.join(FIXTURES_DIR, "hellascom-gr-search.html"), "utf-8");

  it("extracts the model's grid price and card-scoped stock", () => {
    const result = hellascomParser.parsePrice(html(), "CRS326-24G-2S+RM");
    expect(result).not.toBeNull();
    expect(result!.price).toBe(177.42);
    expect(result!.currency).toBe("EUR");
    expect(result!.stockStatus).toBe("back_order");
  });

  it("reads the out-of-production status in another card", () => {
    const result = hellascomParser.parsePrice(html(), "CRS326-24S+2Q+RM");
    expect(result).not.toBeNull();
    expect(result!.price).toBe(483.87);
    expect(result!.stockStatus).toBe("out_of_stock");
  });

  it("returns null when no card names the model", () => {
    expect(hellascomParser.parsePrice(html(), "CRS804-4DDQ-hRM")).toBeNull();
  });
});
