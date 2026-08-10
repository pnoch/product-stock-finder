import { describe, it, expect } from "vitest";
import { getTaxRate } from "@/lib/tax";

describe("getTaxRate", () => {
  it("returns the tax rate for a known country", () => {
    expect(getTaxRate("United Kingdom")).toBeCloseTo(0.2, 2);
    expect(getTaxRate("Germany")).toBeCloseTo(0.19, 2);
    expect(getTaxRate("Australia")).toBeCloseTo(0.1, 2);
  });

  it("returns 0 for tax-free countries", () => {
    expect(getTaxRate("Malaysia")).toBe(0);
    expect(getTaxRate("United States")).toBe(0);
  });

  it("returns 0 for unknown countries", () => {
    expect(getTaxRate("Atlantis")).toBe(0);
  });
});
