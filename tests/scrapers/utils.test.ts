import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import {
  matchesModel,
  productRowContext,
  modelMismatch,
} from "../../lib/scrapers/utils";

describe("matchesModel", () => {
  it("matches the spec-table positives", () => {
    expect(
      matchesModel("MikroTik CRS804-4DDQ-hRM RouterOS7", "CRS804-4DDQ-hRM"),
    ).toBe(true);
    expect(matchesModel("hEX-S (RouterOS L4)", "hEX S")).toBe(true);
    expect(matchesModel("crs326 24g 2s+ rack switch", "CRS326-24G-2S+")).toBe(
      true,
    );
  });

  it("rejects prefix/suffix SKU extensions", () => {
    expect(matchesModel("RB5009UG+S+IN", "RB5009")).toBe(false);
    expect(matchesModel("hEX", "hEX S")).toBe(false);
  });

  it("rejects embedded occurrences", () => {
    expect(matchesModel("xRB5009y", "RB5009")).toBe(false);
    expect(matchesModel("4032CRS804 kit", "CRS804")).toBe(false);
  });

  it("is case-insensitive and separator-flexible", () => {
    expect(
      matchesModel("MIKROTIK CRS804-4DDQ-HRM", "CrS804-4DdQ-hRm"),
    ).toBe(true);
    expect(matchesModel("RB5009UG+S+IN", "rb5009ug s in")).toBe(true);
  });

  it("accepts when only a later candidate sits on boundaries", () => {
    expect(matchesModel("xRB5009 y RB5009 z", "RB5009")).toBe(true);
  });

  it("accepts known commerce suffixes after a separator", () => {
    expect(
      matchesModel("MikroTik CRS326-24G-2S+RM switch", "CRS326-24G-2S+"),
    ).toBe(true);
    expect(matchesModel("CRS326-24G-2S+IN", "CRS326-24G-2S+")).toBe(true);
  });

  it("still rejects unknown extensions and mid-token runs", () => {
    expect(matchesModel("CRS326-24G-2S+XTX", "CRS326-24G-2S+")).toBe(false);
    expect(matchesModel("RB5009UG+S+IN", "RB5009")).toBe(false);
  });

  it("returns false for empty or unusable inputs", () => {
    expect(matchesModel("", "RB5009")).toBe(false);
    expect(matchesModel("some text", "")).toBe(false);
    expect(matchesModel("some text", "   ")).toBe(false);
  });
});

describe("productRowContext", () => {
  const ROW_HTML = `<html><body><table>
    <tr class="product">
      <td><a href="/p/crs804">MikroTik CRS804</a></td>
      <td><span class="price">$480.00</span></td>
    </tr>
  </table></body></html>`;

  it("climbs to the row container and extracts text + href", () => {
    const $ = cheerio.load(ROW_HTML);
    const ctx = productRowContext($(".price").first());
    expect(ctx.text).toContain("MikroTik CRS804");
    expect(ctx.href).toBe("/p/crs804");
  });

  it("falls back to the element itself when no container matches", () => {
    const $ = cheerio.load(`<div><span class="price">$5.00</span></div>`);
    const ctx = productRowContext($(".price").first());
    expect(ctx.text).toContain("$5.00");
    expect(ctx.href).toBe("");
  });
});

describe("modelMismatch", () => {
  const ROW_HTML = `<html><body><table>
    <tr class="product">
      <td><a href="/p/crs804">MikroTik CRS804</a></td>
      <td><span class="price">$480.00</span></td>
    </tr>
  </table></body></html>`;
  const $ = cheerio.load(ROW_HTML);

  it("is false when no model is provided", () => {
    expect(modelMismatch($(".price").first(), undefined)).toBe(false);
  });

  it("is true when the row names a different product", () => {
    expect(modelMismatch($(".price").first(), "CRS326-24G-2S+")).toBe(true);
  });

  it("is false when the row names the requested product", () => {
    expect(modelMismatch($(".price").first(), "CRS804")).toBe(false);
  });

  it("accepts (false) when the context is empty", () => {
    const bare = cheerio.load(`<span>   </span>`);
    expect(modelMismatch(bare("span").first(), "CRS804")).toBe(false);
  });

  it("finds the model one ancestor above the priced element", () => {
    const $ = cheerio.load(`<div class="productitem">
      <div class="info"><a href="/p/crs326">MikroTik CRS326-24G-2S+RM</a>
        <div class="price">$199.00</div></div></div>`);
    expect(modelMismatch($(".price").first(), "CRS326-24G-2S+")).toBe(false);
  });

  it("does not reach page-level headers five levels up", () => {
    const $ = cheerio.load(`<body><header>Search results for CRS326-24G-2S+</header>
      <div><div><div><div><span class="price">$5.00</span></div></div></div></div></body>`);
    expect(modelMismatch($("span.price").first(), "CRS326-24G-2S+")).toBe(true);
  });

  it("accepts a Magento product-item-details row via closest()", () => {
    const $ = cheerio.load(`<li class="product-item">
      <div class="product details product-item-details">
        RTB-CRS326-24G-2S+IN Mikrotik CRS326-24G-2S+IN
        <span class="price">€162.11</span> Add to Cart
      </div></li>`);
    expect(modelMismatch($("span.price").first(), "CRS326-24G-2S+")).toBe(
      false,
    );
  });
});

describe("findPriceElement", () => {
  const TWO_PRODUCT_HTML = `<div class="search-results">
    <div class="product-card">
      <h2><a href="/p/OTHER-MODEL-X1">OTHER-MODEL-X1 Router</a></h2>
      <span class="price">$999.00</span>
    </div>
    <div class="product-card">
      <h2><a href="/p/TARGET-MODEL-9Z">TARGET-MODEL-9Z Switch</a></h2>
      <span class="price">$1.00</span>
    </div>
  </div>`;

  it("prefers the price whose card matches the model over document order", async () => {
    const { findPriceElement } = await import("../../lib/scrapers/utils");
    const $ = cheerio.load(TWO_PRODUCT_HTML);
    const $price = findPriceElement($, ".price", "TARGET-MODEL-9Z");
    expect($price).not.toBeNull();
    expect($price!.text()).toContain("1.00");
  });

  it("returns null when no price context matches the model", async () => {
    const { findPriceElement } = await import("../../lib/scrapers/utils");
    const $ = cheerio.load(TWO_PRODUCT_HTML);
    expect(findPriceElement($, ".price", "NOPE-NOT-HERE-0Z")).toBeNull();
  });

  it("falls back to document order when no model is given", async () => {
    const { findPriceElement } = await import("../../lib/scrapers/utils");
    const $ = cheerio.load(TWO_PRODUCT_HTML);
    const $price = findPriceElement($, ".price");
    expect($price).not.toBeNull();
    expect($price!.text()).toContain("999.00");
  });

  it("returns null when the selector matches nothing", async () => {
    const { findPriceElement } = await import("../../lib/scrapers/utils");
    const $ = cheerio.load(TWO_PRODUCT_HTML);
    expect(findPriceElement($, ".nope", "TARGET-MODEL-9Z")).toBeNull();
  });
});
