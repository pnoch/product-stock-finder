import { describe, expect, it } from "vitest";
import { findPriceElement } from "../lib/scrapers/utils";
import { balticnetworksParser } from "../lib/scrapers/balticnetworks";
import { linktechsParser } from "../lib/scrapers/linktechs";
import * as cheerio from "cheerio";

describe("findPriceElement honors selector priority", () => {
  it("prefers the first selector that matches, not document order", () => {
    // The old-price span comes first in the document, but the caller lists
    // .actual-price first, so that must win.
    const $ = cheerio.load(`<div class="product-item">
      <span class="price old-price">$599.00</span>
      <span class="price actual-price">$499.00</span>
      <a href="/p/crs326-24s-2q-rm">MikroTik CRS326-24S+2Q+RM</a>
    </div>`);
    const el = findPriceElement(
      $ as never,
      ".actual-price, .price",
      "CRS326-24S+2Q+RM",
    );
    expect(el?.text()).toBe("$499.00");
  });

  it("falls through to a later selector when the first matches nothing", () => {
    const $ = cheerio.load(`<div class="product-item">
      <span class="price">$499.00</span>
      <a href="/p/crs326-24s-2q-rm">MikroTik CRS326-24S+2Q+RM</a>
    </div>`);
    const el = findPriceElement(
      $ as never,
      ".actual-price, .price",
      "CRS326-24S+2Q+RM",
    );
    expect(el?.text()).toBe("$499.00");
  });
});

describe("strikethrough price regressions", () => {
  it("linktechs returns the actual price, not the old price", () => {
    const html = `<div class="product-item">
      <span class="price old-price">$599.00</span>
      <span class="price actual-price">$499.00</span>
      <a href="/p/crs326-24s-2q-rm">MikroTik CRS326-24S+2Q+RM</a>
    </div>`;
    expect(linktechsParser.parsePrice(html, "CRS326-24S+2Q+RM")?.price).toBe(499);
  });

  it("balticnetworks returns the current price, not the compare-at price", () => {
    const html = `<div class="product-item">
      <div class="productitem__price">
        <span class="price__current">$1,195.00</span>
        <span class="price__old">Original price $1,295.00</span>
      </div>
      <a href="/p/crs804-4ddq-hrm">MikroTik CRS804-4DDQ-hRM</a>
    </div>`;
    expect(
      balticnetworksParser.parsePrice(html, "CRS804-4DDQ-hRM")?.price,
    ).toBe(1195);
  });
});
