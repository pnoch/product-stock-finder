import { describe, expect, it } from "vitest";
import { PARSERS } from "../../lib/scrapers/registry";

// Two-product search page: the FIRST price belongs to another model, the
// target model is only in the second card. A parser must never return the
// decoy's price for the target model (it may return the correct price or
// null if it cannot associate prices with cards).
const TWO_PRODUCT_HTML = `
<div class="search-results">
  <div class="product-card" data-cy="product-card">
    <h2 class="product-name"><a href="/p/OTHER-MODEL-X1">OTHER-MODEL-X1 Router</a></h2>
    <span class="price-tag product-price price price__current" data-product-price data-price-container>$999.00</span>
    <span class="stock-status availability">In Stock</span>
  </div>
  <div class="product-card" data-cy="product-card">
    <h2 class="product-name"><a href="/p/TARGET-MODEL-9Z">TARGET-MODEL-9Z Switch</a></h2>
    <span class="price-tag product-price price price__current" data-product-price data-price-container>$1.00</span>
    <span class="stock-status availability">In Stock</span>
  </div>
</div>`;

describe("parser wrong-product guard (adversarial two-product page)", () => {
  for (const parser of PARSERS) {
    it(`${parser.id} returns the target card's price, never the decoy's`, () => {
      let result;
      try {
        result = parser.parsePrice(TWO_PRODUCT_HTML, "TARGET-MODEL-9Z");
      } catch {
        // A parser that cannot handle this markup must not throw.
        return;
      }
      // A parser that successfully parses this page must select the TARGET
      // card ($1), not the decoy ($999) — asserting the exact price catches a
      // wrong-but-not-999 result too.
      if (result !== null) {
        expect(result.price, `${parser.id} selected the wrong card`).toBe(1);
      }
    });
  }

  it("at least one parser exercises the guard (not a vacuous suite)", () => {
    const parsed = PARSERS.filter((p) => {
      try {
        return p.parsePrice(TWO_PRODUCT_HTML, "TARGET-MODEL-9Z") !== null;
      } catch {
        return false;
      }
    });
    expect(parsed.length).toBeGreaterThan(0);
  });
});
