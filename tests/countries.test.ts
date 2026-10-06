import { describe, expect, it } from "vitest";
import { COUNTRIES, getCountry, searchCountries } from "../shared/src/countries";
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

  it("getCountry finds a known country and misses an unknown one", () => {
    expect(getCountry("TH")?.name).toBe("Thailand");
    expect(getCountry("ZZ")).toBeUndefined();
  });

  it("searchCountries matches by name and code, case-insensitively", () => {
    expect(searchCountries("thai").some((c) => c.code === "TH")).toBe(true);
    expect(searchCountries("th").some((c) => c.code === "TH")).toBe(true);
    expect(searchCountries("zzzz")).toHaveLength(0);
  });

  it("covers every country in the landed-cost region map", () => {
    for (const code of ["TH", "SG", "MY", "AU", "NZ", "JP", "KR", "IN", "GB", "DE", "FR", "GR", "PL", "CZ", "US", "CA", "AE", "ZA"]) {
      expect(regionForCountry(code), `${code} missing from COUNTRY_REGION`).not.toBeNull();
      expect(getCountry(code), `${code} missing from COUNTRIES`).toBeDefined();
    }
  });

  it("covers every country in the duty VAT map", () => {
    for (const code of ["TH", "SG", "MY", "AU", "NZ", "GB", "DE", "FR", "GR", "PL", "CZ", "CA", "ZA", "AE", "US", "HK"]) {
      expect(estimateImportDuty(100, "Router", code), `${code} missing from COUNTRY_VAT`).not.toBeNull();
      expect(getCountry(code), `${code} missing from COUNTRIES`).toBeDefined();
    }
  });
});
