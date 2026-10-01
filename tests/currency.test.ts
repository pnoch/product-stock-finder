import { describe, expect, it, afterEach } from "vitest";
import {
  convertPrice,
  getBestPrice,
  getExchangeRate,
  hasExchangeRate,
  setExchangeRates,
} from "../lib/currency";
import { formatPrice, roundMoney } from "../shared/src/currency";

describe("roundMoney", () => {
  it("rounds to 2 decimals (not 3)", () => {
    // 1.2345 must round to 1.23, not 1.235. Used by getBestPrice so a
    // converted price never carries a floating-point tail.
    expect(roundMoney(1.2345)).toBe(1.23);
    expect(roundMoney(1.235)).toBe(1.24);
    expect(roundMoney(102.80999999999999)).toBe(102.81);
    expect(roundMoney(0.005)).toBe(0.01);
  });
});

describe("convertPrice", () => {
  it("returns the same amount for USD to USD", () => {
    expect(convertPrice(100, "USD", "USD")).toBe(100);
  });

  it("converts from USD to a target currency", () => {
    // 100 USD * 0.92 = 92 EUR
    expect(convertPrice(100, "USD", "EUR")!).toBeCloseTo(92);
  });

  it("converts from a source currency to USD", () => {
    // 100 MYR / 4.47 = ~22.37 USD
    expect(convertPrice(100, "MYR", "USD")!).toBeCloseTo(100 / 4.47);
  });

  it("round-trips through USD", () => {
    const usd = convertPrice(250, "GBP", "USD")!;
    expect(convertPrice(usd, "USD", "GBP")!).toBeCloseTo(250);
  });

  it("returns null for unknown currencies", () => {
    expect(convertPrice(100, "XYZ", "USD")).toBeNull();
    expect(convertPrice(100, "USD", "XYZ")).toBeNull();
  });

  it("returns null for a prototype-key currency", () => {
    // `in` accepts inherited keys, so these resolve to an inherited function
    // rather than a rate; the isFinite guard must reject them instead of
    // producing NaN.
    for (const key of ["toString", "valueOf", "constructor", "__proto__"]) {
      expect(convertPrice(100, key, "USD")).toBeNull();
      expect(convertPrice(100, "USD", key)).toBeNull();
    }
  });

  it("returns null for a non-finite or negative amount", () => {
    expect(convertPrice(Number.NaN, "USD", "USD")).toBeNull();
    expect(convertPrice(Number.POSITIVE_INFINITY, "USD", "USD")).toBeNull();
    expect(convertPrice(-1, "USD", "USD")).toBeNull();
  });
});

describe("exchange-rate lookups", () => {
  afterEach(() => setExchangeRates(null));

  it("reports a known static rate", () => {
    expect(hasExchangeRate("USD")).toBe(true);
    expect(getExchangeRate("USD")).toBe(1);
  });

  it("ignores prototype keys (own-property only)", () => {
    for (const key of ["toString", "valueOf", "constructor", "__proto__"]) {
      expect(hasExchangeRate(key)).toBe(false);
      expect(getExchangeRate(key)).toBeNull();
    }
  });

  it("drops non-finite and non-positive live rates", () => {
    setExchangeRates({ EUR: -1, GBP: Number.NaN, USD: 0 });
    // All entries invalid -> overlay cleared -> static EUR rate.
    expect(convertPrice(100, "USD", "EUR")!).toBeCloseTo(92);
  });

  it("keeps only the valid entries of a mixed live batch", () => {
    setExchangeRates({ EUR: 0.9, XYZ: -5, ABC: Number.NaN });
    expect(convertPrice(100, "USD", "EUR")!).toBeCloseTo(90);
    // A missing-but-invalid code was not stored, so it stays unknown.
    expect(convertPrice(100, "USD", "XYZ")).toBeNull();
    expect(convertPrice(100, "USD", "ABC")).toBeNull();
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

  it("puts the minus sign before the symbol", () => {
    // "$-5.00" reads as a malformed price; a legacy/corrupt stored value can
    // still reach this.
    expect(formatPrice(-5, "USD")).toBe("-$5.00");
  });

  it("uses exponential notation for an absurd magnitude", () => {
    // toLocaleString never goes exponential, so this rendered as a 21-digit
    // wall of text.
    expect(formatPrice(1e21, "USD")).toBe("$1.00e+21");
    expect(formatPrice(-1e21, "USD")).toBe("-$1.00e+21");
  });

  it("returns N/A for a non-finite amount", () => {
    expect(formatPrice(Number.NaN, "USD")).toBe("N/A");
    expect(formatPrice(Number.POSITIVE_INFINITY, "USD")).toBe("N/A");
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
    expect(best!.price).toBeCloseTo(convertPrice(90, "EUR", "USD")!);
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
    expect(convertPrice(100, "USD", "EUR")!).toBeCloseTo(90);
  });

  it("falls back to static rates for codes missing from the live set", () => {
    setExchangeRates({ EUR: 0.9 });
    expect(convertPrice(100, "EUR", "GBP")!).toBeCloseTo((100 / 0.9) * 0.79);
  });

  it("restores static rates when cleared with null", () => {
    setExchangeRates({ EUR: 0.9 });
    setExchangeRates(null);
    expect(convertPrice(100, "USD", "EUR")!).toBeCloseTo(92);
  });
});
