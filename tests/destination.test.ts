import { describe, expect, it } from "vitest";
import { resolveDestination, landedCostOptions } from "../lib/destination";
import type { AppSettings } from "../lib/types";

const base: AppSettings = {
  theme: "auto",
  displayCurrency: "USD",
  checkInterval: "manual",
  notificationsEnabled: true,
  stockAlerts: true,
  priceAlerts: true,
  healthAlerts: true,
};

describe("resolveDestination", () => {
  it("returns null when shipToCountry is unset", () => {
    expect(resolveDestination(base)).toBeNull();
  });

  it("returns the destination when shipToCountry is set", () => {
    expect(
      resolveDestination({ ...base, shipToCountry: "TH", displayCurrency: "THB" }),
    ).toEqual({ countryCode: "TH", currency: "THB" });
  });

  it("defaults the currency to USD when displayCurrency is empty", () => {
    expect(
      resolveDestination({ ...base, shipToCountry: "TH", displayCurrency: "" }),
    ).toEqual({ countryCode: "TH", currency: "USD" });
  });
});

describe("landedCostOptions", () => {
  it("maps the tax flags", () => {
    expect(
      landedCostOptions({ ...base, taxExempt: true, includeImportEstimate: true }),
    ).toEqual({ taxExempt: true, includeImportEstimate: true });
  });

  it("defaults both flags to false", () => {
    expect(landedCostOptions(base)).toEqual({
      taxExempt: false,
      includeImportEstimate: false,
    });
  });
});
