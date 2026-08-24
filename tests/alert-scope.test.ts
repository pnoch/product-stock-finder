import { describe, expect, it } from "vitest";
import { listingsForAlert } from "../lib/alert-scope";

const listings = [
  { distributorId: "a", price: 100 },
  { distributorId: "b", price: 90 },
  { distributorId: "a", price: 80 },
] as Array<{ distributorId: string; price: number }>;

describe("listingsForAlert", () => {
  it("returns all listings when unscoped", () => {
    expect(listingsForAlert(listings, undefined)).toHaveLength(3);
    expect(listingsForAlert(listings)).toHaveLength(3);
  });

  it("filters to the scoped distributor", () => {
    const result = listingsForAlert(listings, "a");
    expect(result).toHaveLength(2);
    expect(result.every((l) => l.distributorId === "a")).toBe(true);
  });

  it("returns empty when no listing matches the scope", () => {
    expect(listingsForAlert(listings, "zzz")).toEqual([]);
  });
});
