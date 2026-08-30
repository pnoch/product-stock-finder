import { describe, it, expect } from "vitest";
import { searchCatalog, PRODUCT_CATALOG } from "../lib/catalog";

describe("searchCatalog", () => {
  it("returns full catalog for empty query", () => {
    const results = searchCatalog("");
    expect(results).toEqual(PRODUCT_CATALOG);
  });

  it("matches exact model number", () => {
    const results = searchCatalog("CRS804");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].id).toBe("mikrotik-crs804-4ddq-hrm");
  });

  it("matches model number case-insensitively", () => {
    const results = searchCatalog("crs804");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].id).toBe("mikrotik-crs804-4ddq-hrm");
  });

  it("matches partial model number", () => {
    const results = searchCatalog("RB5009");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].id).toBe("mikrotik-rb5009");
  });

  it("matches brand name", () => {
    const results = searchCatalog("ubiquiti");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.every((p) => p.brand === "Ubiquiti")).toBe(true);
  });

  it("matches multi-word query across fields", () => {
    const results = searchCatalog("mikrotik router");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.every((p) => p.brand === "MikroTik")).toBe(true);
  });

  it("handles typos", () => {
    const results = searchCatalog("ubiquiti swtich");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((p) => p.brand === "Ubiquiti")).toBe(true);
  });

  it("returns empty array for no match", () => {
    const results = searchCatalog("xyznonexistent");
    expect(results).toEqual([]);
  });

  it("ranks model number matches higher than description matches", () => {
    const results = searchCatalog("CRS804");
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results[0].id).toBe("mikrotik-crs804-4ddq-hrm");
  });
});
