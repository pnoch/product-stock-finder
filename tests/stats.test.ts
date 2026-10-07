import { describe, expect, it } from "vitest";
import { median } from "../lib/stats";

describe("median", () => {
  it("handles odd and even counts", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
  it("returns 0 for an empty list", () => {
    expect(median([])).toBe(0);
  });
});
