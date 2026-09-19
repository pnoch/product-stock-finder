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

// Parsers that legitimately cannot handle this synthetic markup (their real
// sites use a different card structure). Everything else MUST parse it and
// select the target card — a parser that regresses to always returning null
// would otherwise pass vacuously.
const CANNOT_PARSE_SYNTHETIC = new Set<string>([
  // getic reads the model from aria-label/alt/href attributes, not text nodes,
  // so this text-only synthetic card has no model signal for it to match.
  "getic-gr",
]);

describe("parser wrong-product guard (adversarial two-product page)", () => {
  for (const parser of PARSERS) {
    it(`${parser.id} selects the target card, never the decoy`, () => {
      let result;
      try {
        result = parser.parsePrice(TWO_PRODUCT_HTML, "TARGET-MODEL-9Z");
      } catch (e) {
        throw new Error(`${parser.id} threw on the adversarial page: ${e}`);
      }
      if (CANNOT_PARSE_SYNTHETIC.has(parser.id)) {
        expect(result, `${parser.id} should not parse this markup`).toBeNull();
        return;
      }
      // Must parse AND pick the target card ($1), not the decoy ($999).
      expect(result, `${parser.id} returned no price`).not.toBeNull();
      expect(result!.price, `${parser.id} selected the wrong card`).toBe(1);
    });
  }

  it("keeps the exception list explicit and small", () => {
    // Every parser must be exercised by the loop above; the only ones allowed
    // to skip are the documented exceptions, and they must be real parser ids.
    const ids = new Set(PARSERS.map((p) => p.id));
    for (const id of CANNOT_PARSE_SYNTHETIC) {
      expect(ids.has(id), `${id} is not a registered parser`).toBe(true);
    }
    expect(CANNOT_PARSE_SYNTHETIC.size).toBeLessThanOrEqual(2);
  });
});
