import { describe, it, expect } from "vitest";
import { convertPrice } from "../lib/currency";
import { formatPrice } from "../shared/src/currency";

describe("convertPrice regression", () => {
  it("returns null for unknown fromCurrency", () => {
    expect(convertPrice(100, "XYZ" as any, "USD")).toBeNull();
  });
  it("returns null for unknown toCurrency", () => {
    expect(convertPrice(100, "USD", "XYZ" as any)).toBeNull();
  });
  it("converts EUR to USD correctly", () => {
    const result = convertPrice(100, "EUR", "USD");
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThan(100); // EUR stronger than USD per rates
  });
  it("returns null when either rate is missing", () => {
    expect(convertPrice(100, "MYR", "USD")).not.toBeNull(); // valid
    expect(convertPrice(100, "MYR", "UNKNOWN" as any)).toBeNull();
  });
});

describe("formatPrice regression", () => {
  it("formats USD with symbol", () => {
    expect(formatPrice(1299.99, "USD")).toContain("$");
  });
  it("formats EUR with symbol", () => {
    expect(formatPrice(1181.67, "EUR")).toContain("€");
  });
});
