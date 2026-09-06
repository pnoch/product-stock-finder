import { describe, it, expect } from "vitest";
import { convertPrice } from "../lib/currency";
import { getCurrencySymbol, formatPrice } from "../shared/src/currency";

describe("CURRENCY_SYMBOLS regression — GB→GBP typo", () => {
  it("GBP returns £", () => {
    expect(getCurrencySymbol("GBP")).toBe("£");
  });
  it("GB (old typo) no longer present", () => {
    expect(getCurrencySymbol("GB" as any)).not.toBe("£");
  });
});

describe("formatPrice forwards currency to convertPrice", () => {
  it("includes currency symbol", () => {
    expect(formatPrice(100, "USD")).toContain("$");
    expect(formatPrice(100, "GBP")).toContain("£");
    expect(formatPrice(100, "EUR")).toContain("€");
  });
});
