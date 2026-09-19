import { describe, expect, it } from "vitest";
import { dedupKeyForHealth } from "../server/notifications/build-events";
import { computeProductInsights } from "../lib/product-insights";
import { computeDropCalendar } from "../lib/drop-calendar";
import { getTaxRate } from "../lib/tax";
import { findBestDeal } from "../lib/best-deal";
import type { Product } from "../lib/types";

describe("health dedup key separates alert from recovery", () => {
  it("produces different keys for an alert and a recovery at the same status", () => {
    const now = Date.parse("2026-06-15T12:00:00Z");
    const alert = dedupKeyForHealth(
      { status: "blocked", kind: "alert" },
      "d1",
      now,
    );
    const recovery = dedupKeyForHealth(
      { status: "blocked", kind: "recovery" },
      "d1",
      now,
    );
    expect(alert).not.toBe(recovery);
  });

  it("still dedupes two alerts in the same hour", () => {
    const now = Date.parse("2026-06-15T12:00:00Z");
    expect(
      dedupKeyForHealth({ status: "blocked", kind: "alert" }, "d1", now),
    ).toBe(
      dedupKeyForHealth({ status: "blocked", kind: "alert" }, "d1", now + 60_000),
    );
  });

  it("defaults to the alert kind when unspecified", () => {
    const now = Date.parse("2026-06-15T12:00:00Z");
    expect(dedupKeyForHealth({ status: "error" }, "d1", now)).toBe(
      dedupKeyForHealth({ status: "error", kind: "alert" }, "d1", now),
    );
  });
});

describe("insights and drop calendar tolerate missing listings", () => {
  const bare = {
    id: "p1",
    name: "P",
    modelNumber: "M1",
    brand: "B",
    category: "C",
    description: "",
    addedAt: "2026-01-01T00:00:00.000Z",
    isWatched: true,
  } as unknown as Product;

  it("computeProductInsights does not throw", () => {
    expect(() => computeProductInsights([bare], "USD")).not.toThrow();
  });

  it("computeDropCalendar does not throw", () => {
    expect(() =>
      computeDropCalendar([bare], "USD", 30, Date.now()),
    ).not.toThrow();
  });
});

describe("prototype-key and NaN guards", () => {
  it("getTaxRate returns a number for a prototype key", () => {
    const rate = getTaxRate("toString");
    expect(typeof rate).toBe("number");
    expect(Number.isFinite(rate)).toBe(true);
  });

  it("findBestDeal does not produce a NaN total from a NaN taxRate", () => {
    const product = {
      id: "p1",
      name: "P",
      modelNumber: "M1",
      brand: "B",
      category: "C",
      description: "",
      addedAt: "2026-01-01T00:00:00.000Z",
      isWatched: true,
      listings: [
        {
          distributorId: "server2u-my",
          productId: "p1",
          price: 100,
          currency: "USD",
          stockStatus: "in_stock",
          url: "",
          lastChecked: "2026-01-01T00:00:00.000Z",
          priceHistory: [],
          taxRate: Number.NaN,
        },
      ],
    } as unknown as Product;
    const deal = findBestDeal(
      (product as unknown as { listings: never[] }).listings,
      "Asia-Pacific",
      "USD",
    );
    // A single in-stock listing must produce a deal; asserting non-null stops
    // a regression to `return null` from passing vacuously.
    expect(deal).not.toBeNull();
    expect(Number.isFinite(deal!.total)).toBe(true);
    expect(Number.isFinite(deal!.tax)).toBe(true);
  });
});
