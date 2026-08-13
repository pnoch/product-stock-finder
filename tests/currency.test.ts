import { describe, expect, it, afterEach } from "vitest";
import {
  convertPrice,
  formatPrice,
  getBestPrice,
  setExchangeRates,
} from "../lib/currency";

describe("convertPrice", () => {
  it("returns the same amount for USD to USD", () => {
    expect(convertPrice(100, "USD", "USD")).toBe(100);
  });

  it("converts from USD to a target currency", () => {
    // 100 USD * 0.92 = 92 EUR
    expect(convertPrice(100, "USD", "EUR")).toBeCloseTo(92);
  });

  it("converts from a source currency to USD", () => {
    // 100 MYR / 4.47 = ~22.37 USD
    expect(convertPrice(100, "MYR", "USD")).toBeCloseTo(100 / 4.47);
  });

  it("round-trips through USD", () => {
    const usd = convertPrice(250, "GBP", "USD");
    expect(convertPrice(usd, "USD", "GBP")).toBeCloseTo(250);
  });

  it("treats unknown currencies as USD (rate 1)", () => {
    expect(convertPrice(100, "XYZ", "USD")).toBe(100);
    expect(convertPrice(100, "USD", "XYZ")).toBe(100);
  });
});

describe("formatPrice", () => {
  it("formats with the currency symbol and two decimals", () => {
    expect(formatPrice(1234.5, "USD")).toBe("$1,234.50");
  });

  it("uses the currency code when no symbol is known", () => {
    expect(formatPrice(10, "XYZ")).toBe("XYZ10.00");
  });

  it("handles whole numbers with two decimals", () => {
    expect(formatPrice(42, "EUR")).toBe("€42.00");
  });
});

describe("getBestPrice", () => {
  const listings = [
    { price: 100, currency: "USD", stockStatus: "in_stock" },
    { price: 90, currency: "EUR", stockStatus: "in_stock" },
    { price: 5, currency: "USD", stockStatus: "out_of_stock" },
  ];

  it("returns the cheapest in-stock listing in the display currency", () => {
    const best = getBestPrice(listings, "USD");
    expect(best).not.toBeNull();
    expect(best!.currency).toBe("USD");
    // 90 EUR -> ~97.8 USD, which is cheaper than 100 USD
    expect(best!.price).toBeCloseTo(convertPrice(90, "EUR", "USD"));
  });

  it("excludes out-of-stock listings", () => {
    const onlyOut = [
      { price: 5, currency: "USD", stockStatus: "out_of_stock" },
    ];
    expect(getBestPrice(onlyOut, "USD")).toBeNull();
  });

  it("excludes zero-price listings", () => {
    const zero = [{ price: 0, currency: "USD", stockStatus: "in_stock" }];
    expect(getBestPrice(zero, "USD")).toBeNull();
  });

  it("returns null when there are no available listings", () => {
    expect(getBestPrice([], "USD")).toBeNull();
  });
});

describe("live rates", () => {
  afterEach(() => setExchangeRates(null));

  it("uses live rates when set", () => {
    setExchangeRates({ EUR: 0.9 });
    expect(convertPrice(100, "USD", "EUR")).toBeCloseTo(90);
  });

  it("falls back to static rates for codes missing from the live set", () => {
    setExchangeRates({ EUR: 0.9 });
    expect(convertPrice(100, "EUR", "GBP")).toBeCloseTo((100 / 0.9) * 0.79);
  });

  it("restores static rates when cleared with null", () => {
    setExchangeRates({ EUR: 0.9 });
    setExchangeRates(null);
    expect(convertPrice(100, "USD", "EUR")).toBeCloseTo(92);
  });
});
