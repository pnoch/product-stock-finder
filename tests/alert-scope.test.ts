import { describe, expect, it } from "vitest";
import {
  listingsForAlert,
  scopedAlertFor,
  productWideAlert,
  alertDeltaPct,
} from "../lib/alert-scope";
import { convertPrice } from "../lib/currency";
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

  it("prefers the alert matching the listing currency", () => {
    const mixed = [
      alert({ id: "c-usd", distributorId: "d1", currency: "USD" }),
      alert({ id: "c-eur", distributorId: "d1", currency: "EUR" }),
    ];
    expect(scopedAlertFor(mixed, "p1", "d1", "EUR")?.id).toBe("c-eur");
    expect(scopedAlertFor(mixed, "p1", "d1", "USD")?.id).toBe("c-usd");
  });

  it("falls back to the first match when no currency matches", () => {
    const mixed = [
      alert({ id: "c-usd", distributorId: "d1", currency: "USD" }),
      alert({ id: "c-eur", distributorId: "d1", currency: "EUR" }),
    ];
    expect(scopedAlertFor(mixed, "p1", "d1", "GBP")?.id).toBe("c-usd");
    expect(scopedAlertFor(mixed, "p1", "d1")?.id).toBe("c-usd");
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

describe("alertDeltaPct", () => {
  it("returns null instead of throwing when there is no alert", () => {
    expect(alertDeltaPct({ price: 449, currency: "GBP" }, null)).toBeNull();
  });

  it("computes the converted percentage vs target", () => {
    const a = alert({ id: "x1", targetPrice: 500, currency: "USD" });
    // 449 GBP converts to well above 500 USD at static rates
    const pct = alertDeltaPct({ price: 449, currency: "GBP" }, a);
    expect(pct).not.toBeNull();
    expect(pct).toBeGreaterThan(0);
    expect(pct).toBe(
      Math.round(
        ((convertPrice(449, "GBP", "USD")! - 500) / 500) * 100,
      ),
    );
  });

  it("returns negative pct when price is below target", () => {
    const a = alert({ id: "x2", targetPrice: 600, currency: "USD" });
    expect(alertDeltaPct({ price: 100, currency: "USD" }, a)).toBeLessThan(0);
  });
});
