import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import { findPriceElement, modelMismatch } from "../lib/scrapers/utils";

// Aerial renders its whole results grid inside a single <tr>, with each product
// in a nested card. A generic `tr` boundary made every price resolve to the
// shared row, whose text names every model — so the first card's price won and
// the model guard passed it. The card boundary must win over the row.
describe("card boundary beats a shared row container", () => {
  const SHARED_ROW = `<table><tr>
    <td><div class="aerial-card">
      <a href="/p/crs326-24g-2s-in">MikroTik CRS326-24G-2S+IN</a>
      <span class="ac-price">$154.76</span>
    </div></td>
    <td><div class="aerial-card">
      <a href="/p/crs326-4c-20g-2q-rm">MikroTik CRS326-4C+20G+2Q+RM</a>
      <span class="ac-price">$999.00</span>
    </div></td>
  </tr></table>`;

  it("selects the requested product's card, not the first card in the row", () => {
    const $ = cheerio.load(SHARED_ROW);
    const el = findPriceElement($ as never, ".ac-price", "CRS326-4C+20G+2Q+RM");
    expect(el?.text()).toBe("$999.00");
  });

  it("rejects a price whose card does not name the model", () => {
    const $ = cheerio.load(SHARED_ROW);
    const first = $(".ac-price").first();
    expect(modelMismatch(first, "CRS326-4C+20G+2Q+RM")).toBe(true);
  });

  it("still uses a row when each product has its own row", () => {
    const $ = cheerio.load(`<table>
      <tr class="product"><td><a href="/p/crs804">MikroTik CRS804</a></td><td><span class="price">$480</span></td></tr>
      <tr class="product"><td><a href="/p/crs326">MikroTik CRS326</a></td><td><span class="price">$200</span></td></tr>
    </table>`);
    const el = findPriceElement($ as never, ".price", "CRS326");
    expect(el?.text()).toBe("$200");
  });
});
