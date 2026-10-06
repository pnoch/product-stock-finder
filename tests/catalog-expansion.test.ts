import { describe, expect, it } from "vitest";
import { PRODUCT_CATALOG, searchCatalog } from "@shared/catalog";

const ALLOWED = new Set([
  "Cooling", "Desktop", "Gaming Console", "GPU", "Handheld Gaming",
  "Headphones", "Laptop", "Mixed Reality", "Network Card", "Network Gateway",
  "Networking Switch", "Router", "Single-Board Computer", "Smart Home",
  "Storage", "UPS", "Wireless Bridge",
]);

describe("catalog expansion", () => {
  it("has at least 120 products", () => {
    expect(PRODUCT_CATALOG.length).toBeGreaterThanOrEqual(120);
  });

  it("every entry has a unique slug id and non-empty fields", () => {
    const ids = new Set<string>();
    for (const p of PRODUCT_CATALOG) {
      expect(p.id, `${p.id} not a slug`).toMatch(/^[a-z0-9-]+$/);
      expect(ids.has(p.id), `duplicate id ${p.id}`).toBe(false);
      ids.add(p.id);
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.modelNumber.length).toBeGreaterThan(0);
      expect(p.brand.length).toBeGreaterThan(0);
      expect(p.description.length).toBeGreaterThan(0);
    }
  });

  it("every category is one of the 17 existing categories", () => {
    for (const p of PRODUCT_CATALOG) {
      expect(ALLOWED.has(p.category), `${p.id} category=${p.category}`).toBe(true);
    }
  });

  it("meets per-category beachhead minimums", () => {
    const count = (c: string) => PRODUCT_CATALOG.filter((p) => p.category === c).length;
    expect(count("Single-Board Computer")).toBeGreaterThanOrEqual(8);
    expect(count("Storage")).toBeGreaterThanOrEqual(6);
    expect(count("Networking Switch")).toBeGreaterThanOrEqual(12);
    expect(count("Network Gateway")).toBeGreaterThanOrEqual(6);
    expect(count("Wireless Bridge")).toBeGreaterThanOrEqual(6);
    expect(count("Network Card")).toBeGreaterThanOrEqual(6);
    expect(count("Desktop")).toBeGreaterThanOrEqual(6);
  });

  it("finds new products by model and brand", () => {
    expect(searchCatalog("SC1112").some((p) => p.id === "raspberry-pi-5-16gb")).toBe(true);
    expect(searchCatalog("synology").some((p) => p.brand === "Synology")).toBe(true);
    expect(searchCatalog("connectx").length).toBeGreaterThan(0);
    expect(searchCatalog("u7 pro").length).toBeGreaterThan(0);
  });

  it("has no duplicate product names", () => {
    const names = new Set<string>();
    for (const p of PRODUCT_CATALOG) {
      expect(names.has(p.name), `duplicate name ${p.name}`).toBe(false);
      names.add(p.name);
    }
  });

  it("has no duplicate model numbers except the Pi 5 board code", () => {
    const ALLOWED_DUPES = new Set(["SC1112"]); // Pi 5 4GB/16GB share the board code
    const models = new Map<string, string>();
    for (const p of PRODUCT_CATALOG) {
      if (ALLOWED_DUPES.has(p.modelNumber)) continue;
      expect(
        models.has(p.modelNumber),
        `duplicate modelNumber ${p.modelNumber} (${p.id} vs ${models.get(p.modelNumber)})`,
      ).toBe(false);
      models.set(p.modelNumber, p.id);
    }
  });
});
