import { describe, expect, it } from "vitest";
import { DISTRIBUTORS, getDistributorById } from "../lib/distributors";

describe("DISTRIBUTORS", () => {
  it("has 25 entries", () => {
    expect(DISTRIBUTORS).toHaveLength(25);
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
