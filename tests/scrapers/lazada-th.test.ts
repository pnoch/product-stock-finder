import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseLazadaPrice, lazadaThParser } from "../../lib/scrapers/lazada-th";
import { PARSERS } from "../../lib/scrapers/registry";

const ITEM = "16199450766";
const SKU = "127341978928";
const MODEL = `lazada-th-${ITEM}-${SKU}`;

// Realistic minimal fixture modeled on the live page (2026-10-12):
// xParams identity + selected sku, pdt_price with ฿, JSON-LD availability.
function fixture(opts?: { sku?: string; price?: string; availability?: string }): string {
  const sku = opts?.sku ?? SKU;
  const price = opts?.price ?? "฿237,290.00";
  const availability = opts?.availability ?? "https://schema.org/InStock";
  return `<html><head>
<meta property="og:title" content="ASUS ROG Strix SCAR 18 (2026) gaming laptop" />
<script>window.__PRELOADED__={"page":{"xParams":"_p_typ=pdp&_p_ispdp=1&_p_item=${ITEM}_TH-${sku}&_p_prod=${ITEM}&_p_sku=${sku}&_p_slr="},"seller_name":"","pdt_simplesku":${sku},"pdt_name":"ASUS ROG Strix","pdt_price":"${price}"};</script>
<script type="application/ld+json">{"@type":"Product","name":"ASUS ROG Strix","offers":{"price":"237290.00","priceCurrency":"THB","availability":"${availability}"},"sku":"${ITEM}_TH-${sku}"}</script>
</head><body></body></html>`;
}

describe("parseLazadaPrice", () => {
  it("extracts pdt_price + InStock with matching selected sku", () => {
    expect(parseLazadaPrice(fixture(), ITEM, SKU)).toEqual({
      price: 237290, currency: "THB", variantName: null, inStock: true,
    });
  });

  it("rejects mismatched selected sku", () => {
    expect(parseLazadaPrice(fixture({ sku: "999" }), ITEM, SKU)).toBeNull();
  });

  it("rejects missing identity markers", () => {
    const html = `<html><body><p>pdt_price":"฿100.00"</p></body></html>`;
    expect(parseLazadaPrice(html, ITEM, SKU)).toBeNull();
  });

  it("returns price with inStock false on OutOfStock", () => {
    const out = parseLazadaPrice(
      fixture({ availability: "https://schema.org/OutOfStock" }), ITEM, SKU,
    );
    expect(out?.price).toBe(237290);
    expect(out?.inStock).toBe(false);
  });

  it("rejects non-THB price text", () => {
    expect(parseLazadaPrice(fixture({ price: "$1,299.00" }), ITEM, SKU)).toBeNull();
  });
});

describe("lazadaThParser", () => {
  it("is registered without useBrowser (plain-first)", () => {
    const found = PARSERS.find((p) => p.id === "lazada-th");
    expect(found).toBe(lazadaThParser);
    expect(lazadaThParser.useBrowser).toBeFalsy();
  });

  it("buildSearchUrl returns the canonical product url", () => {
    expect(lazadaThParser.buildSearchUrl(MODEL)).toBe(
      `https://www.lazada.co.th/products/i${ITEM}-s${SKU}.html`,
    );
    expect(lazadaThParser.buildSearchUrl("CRS804")).toBe(
      "https://www.lazada.co.th",
    );
  });

  it("parsePrice end-to-end forwards the url", () => {
    const url = `https://www.lazada.co.th/products/asus-rog-i${ITEM}-s${SKU}.html`;
    const out = lazadaThParser.parsePrice(fixture(), MODEL, url);
    expect(out).toEqual({
      price: 237290, currency: "THB", stockStatus: "in_stock",
      url, variantName: undefined,
    });
    expect(lazadaThParser.parsePrice(fixture(), MODEL)).toEqual(
      expect.objectContaining({
        url: `https://www.lazada.co.th/products/i${ITEM}-s${SKU}.html`,
      }),
    );
    expect(lazadaThParser.parsePrice(fixture(), "CRS804", url)).toBeNull();
  });
});

describe("lazada-th fixture", () => {
  const html = readFileSync(
    path.join(__dirname, "../fixtures/scrapers/lazada-th.html"),
    "utf8",
  );

  it("rejects an unknown model instead of reporting the fixture price", () => {
    expect(lazadaThParser.parsePrice(html, "__NO_SUCH_MODEL__")).toBeNull();
  });

  it("extracts 237290 THB for the fixture identity", () => {
    expect(lazadaThParser.parsePrice(html, MODEL)).toEqual({
      price: 237290, currency: "THB", stockStatus: "in_stock",
      url: `https://www.lazada.co.th/products/i${ITEM}-s${SKU}.html`,
      variantName: undefined,
    });
  });
});
