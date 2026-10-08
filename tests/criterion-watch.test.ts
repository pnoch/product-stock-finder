import { describe, expect, it } from "vitest";
import {
  matchesCriterion,
  evaluateCriterionWatches,
} from "../lib/criterion-watch";
import type { AvailableProduct, CriterionWatch } from "../lib/types";

function avail(
  id: string,
  category: string,
  brand: string,
  price: number,
): AvailableProduct {
  return {
    id,
    name: id,
    brand,
    category,
    modelNumber: id,
    bestPrice: price,
    bestCurrency: "USD",
    bestDistributorId: "d1",
    storeCount: 2,
    fetchedAt: 1000,
  };
}
function watch(over: Partial<CriterionWatch> = {}): CriterionWatch {
  return {
    id: "w1",
    category: "Switch",
    maxPrice: 300,
    currency: "USD",
    seenProductIds: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    isActive: true,
    ...over,
  };
}

describe("matchesCriterion", () => {
  it("matches on each optional field", () => {
    expect(matchesCriterion(avail("a", "Switch", "X", 100), watch())).toBe(
      true,
    );
    expect(matchesCriterion(avail("a", "Router", "X", 100), watch())).toBe(
      false,
    );
    expect(matchesCriterion(avail("a", "Switch", "X", 400), watch())).toBe(
      false,
    );
    expect(
      matchesCriterion(avail("a", "Switch", "Y", 100), watch({ brand: "X" })),
    ).toBe(false);
  });
});

describe("evaluateCriterionWatches", () => {
  it("fires only for newly-appearing products and advances seenProductIds", () => {
    const { matches, updated } = evaluateCriterionWatches({
      watches: [watch({ seenProductIds: ["a"] })],
      available: [avail("a", "Switch", "X", 100), avail("b", "Switch", "X", 200)],
    });
    expect(matches.map((m) => m.productId)).toEqual(["b"]);
    expect(updated[0]!.seenProductIds.sort()).toEqual(["a", "b"]);
  });
  it("does not re-fire for an already-seen product", () => {
    const { matches } = evaluateCriterionWatches({
      watches: [watch({ seenProductIds: ["a", "b"] })],
      available: [avail("a", "Switch", "X", 100), avail("b", "Switch", "X", 200)],
    });
    expect(matches).toEqual([]);
  });
  it("skips inactive watches", () => {
    const { matches } = evaluateCriterionWatches({
      watches: [watch({ isActive: false })],
      available: [avail("a", "Switch", "X", 100)],
    });
    expect(matches).toEqual([]);
  });
});
