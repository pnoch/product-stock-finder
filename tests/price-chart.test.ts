import { describe, it, expect } from "vitest";
import { findNearestIndex } from "@/lib/price-chart";

describe("findNearestIndex", () => {
  it("returns the index of the nearest x position", () => {
    expect(findNearestIndex(0, 3)).toBe(0);
    expect(findNearestIndex(25, 3)).toBe(0);
    expect(findNearestIndex(26, 3)).toBe(1);
    expect(findNearestIndex(75, 3)).toBe(1);
    expect(findNearestIndex(76, 3)).toBe(2);
    expect(findNearestIndex(100, 3)).toBe(2);
  });

  it("clamps to valid range", () => {
    expect(findNearestIndex(-10, 3)).toBe(0);
    expect(findNearestIndex(200, 3)).toBe(2);
  });

  it("handles single point", () => {
    expect(findNearestIndex(50, 1)).toBe(0);
  });
});
