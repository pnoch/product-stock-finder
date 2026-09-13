import { describe, expect, it } from "vitest";
import { getBestPrice } from "../lib/currency";

describe("getBestPrice stock-status semantics", () => {
  it("ignores unknown-availability listings", () => {
    const listings = [
      { price: 50, currency: "USD", stockStatus: "unknown" },
      { price: 100, currency: "USD", stockStatus: "in_stock" },
    ];
    expect(getBestPrice(listings, "USD")?.price).toBe(100);
  });

  it("returns null when only unknown-availability listings exist", () => {
    expect(
      getBestPrice(
        [{ price: 50, currency: "USD", stockStatus: "unknown" }],
        "USD",
      ),
    ).toBeNull();
  });

  it("includes orderable back_order listings", () => {
    const listings = [
      { price: 80, currency: "USD", stockStatus: "back_order" },
      { price: 100, currency: "USD", stockStatus: "in_stock" },
    ];
    expect(getBestPrice(listings, "USD")?.price).toBe(80);
  });
});
