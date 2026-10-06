import { describe, expect, it } from "vitest";
import { resolveDestination, landedCostOptions } from "../lib/destination";

describe("resolveDestination", () => {
  it("returns null when shipToCountry is unset", () => {
    expect(resolveDestination(undefined, "USD")).toBeNull();
  });

  it("returns the destination when shipToCountry is set", () => {
    expect(resolveDestination("TH", "THB")).toEqual({
      countryCode: "TH",
      currency: "THB",
    });
  });

  it("defaults the currency to USD when displayCurrency is empty", () => {
    expect(resolveDestination("TH", "")).toEqual({
      countryCode: "TH",
      currency: "USD",
    });
  });
});

describe("landedCostOptions", () => {
  it("maps the tax flags", () => {
    expect(landedCostOptions(true, true)).toEqual({
      taxExempt: true,
      includeImportEstimate: true,
    });
  });

  it("defaults both flags to false", () => {
    expect(landedCostOptions(undefined, undefined)).toEqual({
      taxExempt: false,
      includeImportEstimate: false,
    });
  });
});
