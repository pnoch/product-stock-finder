import { describe, expect, it } from "vitest";
import { parseEbayPrice, ebayParser } from "../../lib/scrapers/ebay";
import { PARSERS } from "../../lib/scrapers/registry";

const ITEM = "178212205608";
const MODEL = `ebay-us-${ITEM}`;

// Realistic minimal fixture modeled on the real rendered page (2026-10-13):
// JSON-LD is an array-of-Product with THB-converted price + NewCondition,
// the title carries eBay's <wbr/> break, and the DOM shows the USD price.
function fixture(opts?: {
  itemId?: string;
  name?: string;
  price?: string;
  currency?: string;
  availability?: string;
  condition?: string;
}): string {
  const itemId = opts?.itemId ?? ITEM;
  const name =
    opts?.name ??
    "MikroTik<wbr/>CRS812-8DS-2DQ-2DDQ-RM Cloud Router Switch";
  const price = opts?.price ?? "104670.88";
  const currency = opts?.currency ?? "THB";
  const availability = opts?.availability ?? "https://schema.org/InStock";
  const condition = opts?.condition ?? "https://schema.org/NewCondition";
  const jsonld = [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name,
      brand: { "@type": "Brand", name: "MikroTik" },
      offers: {
        "@type": "Offer",
        price,
        priceCurrency: currency,
        availability,
        itemCondition: condition,
        url: `https://www.ebay.com/itm/${itemId}`,
      },
    },
  ];
  return `<html><head>
<link rel="canonical" href="https://www.ebay.com/itm/${itemId}" />
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
</head><body>
<span class="ux-textspans">US $3,114.00</span>
<span class="x-price-approx__price">THB104,670.88</span>
<span class="qtyAvailability">5 available</span>
</body></html>`;
}

describe("parseEbayPrice", () => {
  it("extracts price/currency/availability/condition from the JSON-LD array", () => {
    expect(parseEbayPrice(fixture(), ITEM)).toEqual({
      price: 104670.88,
      currency: "THB",
      title: "MikroTikCRS812-8DS-2DQ-2DDQ-RM Cloud Router Switch",
      inStock: true,
      condition: "New",
    });
  });

  it("strips <wbr/> from the title", () => {
    const out = parseEbayPrice(fixture({ name: "Foo<wbr/>Bar<wbr/>Baz" }), ITEM);
    expect(out?.title).toBe("FooBarBaz");
  });

  it("rejects pages that do not reference our item", () => {
    const other = fixture({ itemId: "999999999999" }).replace(
      new RegExp(ITEM, "g"),
      "999999999999",
    );
    expect(parseEbayPrice(other, ITEM)).toBeNull();
  });

  it("returns null on an error page with no JSON-LD", () => {
    const html = `<html><head><title>Error Page | eBay</title></head><body>Sign in or register</body></html>`;
    expect(parseEbayPrice(html, ITEM)).toBeNull();
  });

  it("keeps the price but reports inStock false on OutOfStock", () => {
    const out = parseEbayPrice(
      fixture({ availability: "https://schema.org/OutOfStock" }),
      ITEM,
    );
    expect(out?.price).toBe(104670.88);
    expect(out?.inStock).toBe(false);
  });

  it("accepts a USD price and stores it as-is", () => {
    const out = parseEbayPrice(
      fixture({ price: "3114.00", currency: "USD" }),
      ITEM,
    );
    expect(out).toEqual({
      price: 3114,
      currency: "USD",
      title: "MikroTikCRS812-8DS-2DQ-2DDQ-RM Cloud Router Switch",
      inStock: true,
      condition: "New",
    });
  });

  it("maps UsedCondition and leaves an unknown condition null", () => {
    expect(
      parseEbayPrice(fixture({ condition: "https://schema.org/UsedCondition" }), ITEM)?.condition,
    ).toBe("Used");
    expect(
      parseEbayPrice(fixture({ condition: "https://schema.org/DamagedCondition" }), ITEM)?.condition,
    ).toBeNull();
  });
});

describe("ebayParser", () => {
  it("is registered with useBrowser true", () => {
    const found = PARSERS.find((p) => p.id === "ebay-us");
    expect(found).toBe(ebayParser);
    expect(ebayParser.useBrowser).toBe(true);
    expect(ebayParser.rateLimitMs).toBe(60000);
  });

  it("buildSearchUrl returns the canonical item url", () => {
    expect(ebayParser.buildSearchUrl(MODEL)).toBe(
      `https://www.ebay.com/itm/${ITEM}`,
    );
    expect(ebayParser.buildSearchUrl("CRS804")).toBe("https://www.ebay.com");
  });

  it("parsePrice end-to-end forwards the url", () => {
    const url = `https://www.ebay.com/itm/${ITEM}`;
    const out = ebayParser.parsePrice(fixture(), MODEL, url);
    expect(out).toEqual({
      price: 104670.88,
      currency: "THB",
      stockStatus: "in_stock",
      url,
      variantName: undefined,
    });
    expect(ebayParser.parsePrice(fixture(), MODEL)).toEqual(
      expect.objectContaining({ url: `https://www.ebay.com/itm/${ITEM}` }),
    );
  });

  it("returns null for a non-ebay model", () => {
    expect(ebayParser.parsePrice(fixture(), "CRS804")).toBeNull();
  });
});
