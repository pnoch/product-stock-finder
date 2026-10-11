import { describe, expect, it } from "vitest";
import { defaultAlertTarget, clampSelection, fulfillPendingAlerts } from "../lib/concierge";
import type { Product } from "../lib/types";

function makeProduct(price: number, currency = "USD"): Product {
  return {
    id: "p1",
    name: "Widget",
    modelNumber: "W1",
    brand: "T",
    category: "Switch",
    description: "",
    isWatched: false,
    addedAt: new Date().toISOString(),
    listings: [{
      distributorId: "d1",
      distributorName: "D1",
      price,
      currency,
      stockStatus: "in_stock",
      url: "https://example.com",
      lastChecked: new Date().toISOString(),
      priceHistory: [],
    }],
  } as unknown as Product;
}

describe("defaultAlertTarget", () => {
  it("returns 10% under best price", () => {
    expect(defaultAlertTarget(makeProduct(100), "USD")).toEqual({
      targetPrice: 90,
      currency: "USD",
    });
  });

  it("returns null when no listings", () => {
    const p = makeProduct(100);
    p.listings = [];
    expect(defaultAlertTarget(p, "USD")).toBeNull();
  });

  it("converts currency before discounting", () => {
    // EUR listing, USD display — target must be in display currency.
    const p = makeProduct(100, "EUR");
    const out = defaultAlertTarget(p, "USD");
    expect(out).not.toBeNull();
    expect(out!.currency).toBe("USD");
    expect(out!.targetPrice).toBeGreaterThan(0);
  });
});

describe("clampSelection", () => {
  it("caps at 5 preserving order", () => {
    expect(clampSelection(["a", "b", "c", "d", "e", "f", "g"])).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("dedupes by id", () => {
    expect(clampSelection(["a", "b", "a", "c"])).toEqual(["a", "b", "c"]);
  });

  it("passes through short lists", () => {
    expect(clampSelection(["a"])).toEqual(["a"]);
    expect(clampSelection([])).toEqual([]);
  });
});

describe("fulfillPendingAlerts", () => {
  it("queues an alert and drops the id when the product has a price", () => {
    const p = makeProduct(100);
    const { alertsToCreate, remainingIds } = fulfillPendingAlerts([p], ["p1"], "USD");
    expect(alertsToCreate).toEqual([{ productId: "p1", targetPrice: 90, currency: "USD" }]);
    expect(remainingIds).toEqual([]);
  });

  it("keeps the id pending when the product still has no price", () => {
    const p = makeProduct(100);
    p.listings = [];
    const { alertsToCreate, remainingIds } = fulfillPendingAlerts([p], ["p1"], "USD");
    expect(alertsToCreate).toEqual([]);
    expect(remainingIds).toEqual(["p1"]);
  });

  it("drops unknown ids silently", () => {
    const p = makeProduct(100);
    const { alertsToCreate, remainingIds } = fulfillPendingAlerts([p], ["missing"], "USD");
    expect(alertsToCreate).toEqual([]);
    expect(remainingIds).toEqual([]);
  });

  it("returns empty result for empty pending", () => {
    const p = makeProduct(100);
    expect(fulfillPendingAlerts([p], [], "USD")).toEqual({ alertsToCreate: [], remainingIds: [] });
  });
});
