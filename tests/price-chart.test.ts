import { describe, it, expect } from "vitest";
import {
  findNearestIndex,
  indexForLocationX,
  nearestByX,
} from "@/lib/price-chart";

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

describe("indexForLocationX", () => {
  it("maps location to nearest index within padding", () => {
    // width=200, padL=50, padR=50 → usable [50,150], 3 points at 50/100/150
    expect(indexForLocationX(50, 200, 50, 50, 3)).toBe(0);
    expect(indexForLocationX(74, 200, 50, 50, 3)).toBe(0);
    expect(indexForLocationX(76, 200, 50, 50, 3)).toBe(1);
    expect(indexForLocationX(101, 200, 50, 50, 3)).toBe(1);
    expect(indexForLocationX(124, 200, 50, 50, 3)).toBe(1);
    expect(indexForLocationX(126, 200, 50, 50, 3)).toBe(2);
    expect(indexForLocationX(149, 200, 50, 50, 3)).toBe(2);
  });

  it("clamps touches outside the plot area", () => {
    expect(indexForLocationX(0, 200, 50, 50, 3)).toBe(0);
    expect(indexForLocationX(200, 200, 50, 50, 3)).toBe(2);
  });
});

describe("nearestByX", () => {
  it("finds exact and nearest matches", () => {
    const coords = [
      { x: 10, v: "a" },
      { x: 50, v: "b" },
      { x: 90, v: "c" },
    ];
    expect(nearestByX(coords, 50)?.v).toBe("b");
    expect(nearestByX(coords, 48)?.v).toBe("b");
    expect(nearestByX(coords, 89)?.v).toBe("c");
  });

  it("returns null for empty coords", () => {
    expect(nearestByX([], 10)).toBeNull();
  });
});
