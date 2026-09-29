import { describe, expect, it } from "vitest";
import { getBestPrice } from "../lib/currency";
import { getBestPrice as sharedGetBestPrice } from "@shared/currency";

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

  // The shared module's comment says it "must match lib/currency.ts", but it
  // omitted the roundMoney step, so a cross-currency conversion returned
  // 102.80999999999999 instead of 102.81. Desktop imports the live-rate
  // version, but the shared one is exported and tested — keep them identical.
  it("agrees with the shared implementation, including rounding", () => {
    const cases = [1, 3, 7, 13, 17, 23, 99, 101, 123.45];
    for (const price of cases) {
      const listings = [
        { price, currency: "USD", stockStatus: "in_stock" as const },
      ];
      const lib = getBestPrice(listings, "MYR");
      const shared = sharedGetBestPrice(listings, "MYR");
      expect(shared?.price, `price ${price}`).toBe(lib?.price);
      // The roundMoney invariant: re-rounding is a no-op. The unrounded
      // implementation failed this (e.g. 102.80999999999999).
      expect(
        Math.round((shared?.price ?? 0) * 100) / 100,
        `price ${price} is not rounded`,
      ).toBe(shared?.price);
    }
  });
});
