import { describe, expect, it } from "vitest";
import { parseShopeePrice } from "../../lib/scrapers/shopee-th";

const SHOP = "1950119";
const ITEM = "28177881956";

describe("parseShopeePrice", () => {
  it("extracts price + variant from embedded JSON state", () => {
    const html = `<html><body><script>window.__PRELOADED__={"shopid":1950119,"itemid":28177881956,"price":1290,"price_min":1290,"price_max":1290,"stock":42,"selected_model":{"name":"30ml"}};</script></body></html>`;
    expect(parseShopeePrice(html, SHOP, ITEM)).toEqual({
      price: 1290, currency: "THB", variantName: "30ml", inStock: true,
    });
  });

  it("rejects mismatched shop/item ids", () => {
    const html = `<html><body><script>{"shopid":999,"itemid":888,"price":100,"stock":1};</script></body></html>`;
    expect(parseShopeePrice(html, SHOP, ITEM)).toBeNull();
  });

  it("returns null on the login wall", () => {
    const html = `<html><body><div>ต้องเข้าสู่ระบบ</div><div>is_logged_in=false</div></body></html>`;
    expect(parseShopeePrice(html, SHOP, ITEM)).toBeNull();
  });

  it("returns null on price ranges without a selected variant", () => {
    const html = `<html><body><script>{"shopid":1950119,"itemid":28177881956,"price_min":899,"price_max":1299,"stock":10};</script></body></html>`;
    expect(parseShopeePrice(html, SHOP, ITEM)).toBeNull();
  });

  it("returns null when out of stock and unpriced", () => {
    const html = `<html><body><p>No price here</p></body></html>`;
    expect(parseShopeePrice(html, SHOP, ITEM)).toBeNull();
  });

  it("reads JSON-LD offers", () => {
    const html = `<html><head><script type="application/ld+json">{"@type":"Product","name":"Niacinamide Serum","offers":{"price":"1150","priceCurrency":"THB","availability":"https://schema.org/InStock"}}</script></head><body></body></html>`;
    const out = parseShopeePrice(html, SHOP, ITEM);
    expect(out?.price).toBe(1150);
    expect(out?.currency).toBe("THB");
  });
});
