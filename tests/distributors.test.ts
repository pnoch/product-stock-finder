import { describe, expect, it } from "vitest";
import { DISTRIBUTORS, getDistributorById } from "@shared/distributors";

describe("DISTRIBUTORS", () => {
  it("has 30 entries", () => {
    expect(DISTRIBUTORS).toHaveLength(30);
  });

  it("includes distributors referenced by sample listings", () => {
    for (const id of ["newegg-us", "apple-us", "pimoroni-uk", "allasch-uk", "valve-us"]) {
      expect(getDistributorById(id)?.id).toBe(id);
    }
  });

  it("all have unique ids", () => {
    const ids = DISTRIBUTORS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all have required fields", () => {
    for (const d of DISTRIBUTORS) {
      expect(d.name).toBeTruthy();
      expect(d.currency).toBeTruthy();
      expect(d.country).toBeTruthy();
      expect(d.region).toBeTruthy();
      expect(d.website).toMatch(/^https?:\/\//);
      expect(Array.isArray(d.paymentMethods)).toBe(true);
    }
  });
});

describe("getDistributorById", () => {
  it("returns correct distributor", () => {
    const d = getDistributorById("balticnetworks-us");
    expect(d?.name).toBe("Baltic Networks");
  });

  it("returns undefined for unknown id", () => {
    expect(getDistributorById("zzz-nonexistent")).toBeUndefined();
  });
});

describe("distributor taxMode", () => {
  it("every distributor declares a valid taxMode", () => {
    const valid = new Set(["export-exempt", "origin", "destination", "none"]);
    for (const d of DISTRIBUTORS) {
      expect(valid.has(d.taxMode), `${d.id} taxMode=${d.taxMode}`).toBe(true);
    }
  });

  it("at least one distributor is export-exempt", () => {
    expect(DISTRIBUTORS.some((d) => d.taxMode === "export-exempt")).toBe(true);
  });
});
