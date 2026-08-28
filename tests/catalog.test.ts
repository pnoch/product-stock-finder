import { describe, expect, it } from "vitest";
import { PRODUCT_CATALOG, searchCatalog } from "../lib/catalog";

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
});
