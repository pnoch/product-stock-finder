import { describe, expect, it } from "vitest";
import { COUNTRIES, getCountry, searchCountries } from "../shared/src/countries";
import { EXCHANGE_RATES } from "../shared/src/currency";
import { regionForCountry } from "../lib/landed-cost";
import { estimateImportDuty } from "../shared/src/duty";

describe("countries", () => {
  it("has unique ISO codes and non-empty fields", () => {
    const codes = new Set<string>();
    for (const c of COUNTRIES) {
      expect(c.code).toMatch(/^[A-Z]{2}$/);
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.currency).toMatch(/^[A-Z]{3}$/);
      expect(c.region.length).toBeGreaterThan(0);
      expect(codes.has(c.code), `duplicate ${c.code}`).toBe(false);
      codes.add(c.code);
    }
  });

  it("every country currency has an exchange rate", () => {
    for (const c of COUNTRIES) {
      expect(
        Object.prototype.hasOwnProperty.call(EXCHANGE_RATES, c.currency),
        `${c.code} currency ${c.currency} missing from EXCHANGE_RATES`,
      ).toBe(true);
    }
  });

  it("getCountry finds a known country and misses an unknown one", () => {
    expect(getCountry("TH")?.name).toBe("Thailand");
    expect(getCountry("ZZ")).toBeUndefined();
  });

  it("searchCountries matches by name and code, case-insensitively", () => {
    expect(searchCountries("thai").some((c) => c.code === "TH")).toBe(true);
    expect(searchCountries("th").some((c) => c.code === "TH")).toBe(true);
    expect(searchCountries("zzzz")).toHaveLength(0);
  });

  it("every offered country is rankable (has a region)", () => {
    for (const c of COUNTRIES) {
      expect(regionForCountry(c.code), `${c.code} has no region`).not.toBeNull();
    }
  });

  it("covers every country in the duty VAT map", () => {
    for (const code of ["TH", "SG", "MY", "AU", "NZ", "GB", "DE", "FR", "GR", "PL", "CZ", "CA", "ZA", "AE", "US", "HK"]) {
      expect(estimateImportDuty(100, "Router", code), `${code} missing from COUNTRY_VAT`).not.toBeNull();
      expect(getCountry(code), `${code} missing from COUNTRIES`).toBeDefined();
    }
  });
});
