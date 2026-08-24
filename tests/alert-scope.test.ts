import { describe, expect, it } from "vitest";
import {
  listingsForAlert,
  scopedAlertFor,
  productWideAlert,
} from "../lib/alert-scope";
import type { PriceAlert } from "../lib/types";

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

function alert(overrides: Partial<PriceAlert> & { id: string }): PriceAlert {
  return {
    productId: "p1",
    targetPrice: 100,
    currency: "USD",
    isActive: true,
    createdAt: "2026-01-01",
    ...overrides,
  } as PriceAlert;
}

describe("scopedAlertFor", () => {
  const alerts = [
    alert({ id: "a1", distributorId: "d1" }),
    alert({ id: "a2", distributorId: "d2", isActive: false }),
    alert({ id: "a3", distributorId: "d2", triggeredAt: "2026-02-01" }),
    alert({ id: "a4", productId: "OTHER", distributorId: "d2" }),
  ];

  it("returns the active untriggered scoped alert", () => {
    expect(scopedAlertFor(alerts, "p1", "d1")?.id).toBe("a1");
  });

  it("ignores inactive or triggered alerts", () => {
    expect(scopedAlertFor(alerts, "p1", "d2")).toBeNull();
  });

  it("ignores other products and missing scope", () => {
    expect(scopedAlertFor(alerts, "p1", "zzz")).toBeNull();
    expect(productWideAlert(alerts, "p1")).toBeNull();
  });
});

describe("productWideAlert", () => {
  it("returns the active unscoped alert for the product", () => {
    const alerts = [
      alert({ id: "w1", distributorId: undefined }),
      alert({ id: "w2", distributorId: "d1" }),
    ];
    expect(productWideAlert(alerts, "p1")?.id).toBe("w1");
  });
});
