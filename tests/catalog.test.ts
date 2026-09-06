import { describe, expect, it } from "vitest";
import { PRODUCT_CATALOG, searchCatalog } from "@shared/catalog";

describe("searchCatalog", () => {
  it("finds by name, case-insensitive", () => {
    expect(searchCatalog("crs804").length).toBeGreaterThan(0);
    expect(searchCatalog("CRs804").length).toBeGreaterThan(0);
  });

  it("finds by modelNumber", () => {
    expect(searchCatalog("RB760iGS").map((p) => p.id)).toContain("mikrotik-hex-s");
  });

  it("finds by brand", () => {
    expect(searchCatalog("ubiquiti").every((p) => p.brand === "Ubiquiti")).toBe(true);
  });

  it("finds by category", () => {
    expect(searchCatalog("router").length).toBeGreaterThan(0);
  });

  it("returns empty for no match", () => {
    expect(searchCatalog("zzz-nonexistent-999")).toEqual([]);
  });

  it("handles empty query (returns all via includes(''))", () => {
    expect(searchCatalog("").length).toBe(PRODUCT_CATALOG.length);
  });

  it("fuzzy matches with minor typos", () => {
    const results = searchCatalog("crs80");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((p) => p.modelNumber.includes("CRS804"))).toBe(true);
  });

  it("fuzzy matches partial prefixes", () => {
    const results = searchCatalog("mikro");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((p) => p.brand === "MikroTik")).toBe(true);
  });
});
