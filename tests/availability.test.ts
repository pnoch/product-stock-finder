import { describe, expect, it } from "vitest";
import {
  computeAvailability,
  scarcityColorToken,
  scarcityLabel,
} from "../lib/availability";
import type { DistributorListing } from "../lib/types";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-03-01T12:00:00.000Z");

function listing(days: number, inStockDays: number[]): DistributorListing {
  return {
    distributorId: "d1",
    productId: "p1",
    price: 100,
    currency: "USD",
    stockStatus: "in_stock",
    url: "",
    lastChecked: new Date(NOW).toISOString(),
    priceHistory: Array.from({ length: days }, (_, i) => ({
      date: new Date(NOW - (days - 1 - i) * DAY).toISOString(),
      price: 100,
      currency: "USD",
      stockStatus: inStockDays.includes(i) ? "in_stock" : "out_of_stock",
    })),
  } as DistributorListing;
}

describe("scarcity helpers", () => {
  it("maps labels", () => {
    expect(scarcityLabel("rare")).toBe("Rare");
    expect(scarcityLabel("occasional")).toBe("Occasional");
    expect(scarcityLabel("common")).toBe("Usually available");
  });
  it("maps color tokens", () => {
    expect(scarcityColorToken("rare")).toBe("error");
    expect(scarcityColorToken("occasional")).toBe("warning");
    expect(scarcityColorToken("common")).toBe("success");
  });
});

describe("computeAvailability", () => {
  it("returns null below 7 sample days", () => {
    expect(computeAvailability([listing(6, [5])], NOW)).toBeNull();
  });

  it("returns a result at 7 sample days", () => {
    expect(computeAvailability([listing(7, [6])], NOW)).not.toBeNull();
  });

  it("computes inStockRate over distinct days", () => {
    const a = computeAvailability([listing(10, [0, 9])], NOW)!;
    expect(a.sampleDays).toBe(10);
    expect(a.inStockRate).toBeCloseTo(0.2, 5);
  });

  it("reports the most recent in-stock day", () => {
    const a = computeAvailability([listing(10, [0, 5])], NOW)!;
    expect(a.lastInStockAt).toBe(NOW - 4 * DAY);
  });

  it("computes the longest outage", () => {
    // In stock 9d-ago and today; the outage spans those 9 calendar days.
    const a = computeAvailability([listing(10, [0, 9])], NOW)!;
    expect(a.longestOutageDays).toBe(9);
  });

  it("computes the median restock gap", () => {
    const a = computeAvailability([listing(10, [0, 3, 9])], NOW)!;
    expect(a.typicalRestockDays).toBeCloseTo(4.5, 5);
  });

  it("returns null cadence when there is no transition", () => {
    const a = computeAvailability([listing(10, [0, 1, 2])], NOW)!;
    expect(a.typicalRestockDays).toBeNull();
  });

  it("classifies scarcity at the boundaries", () => {
    expect(computeAvailability([listing(10, [9])], NOW)!.scarcity).toBe("rare");
    expect(computeAvailability([listing(10, [0, 9])], NOW)!.scarcity).toBe("occasional");
    expect(computeAvailability([listing(10, [5, 6, 7, 8, 9])], NOW)!.scarcity).toBe("common");
  });

  it("buckets multiple points in one day once, any in-stock marks the day", () => {
    const l = listing(10, []);
    l.priceHistory.push(
      { date: new Date(NOW).toISOString(), price: 1, currency: "USD", stockStatus: "out_of_stock" },
      { date: new Date(NOW).toISOString(), price: 1, currency: "USD", stockStatus: "in_stock" },
    );
    const a = computeAvailability([l], NOW)!;
    expect(a.sampleDays).toBe(10);
    expect(a.inStockRate).toBeCloseTo(0.1, 5);
  });

  it("skips non-finite dates", () => {
    const l = listing(10, [9]);
    l.priceHistory.push({ date: "not-a-date", price: 1, currency: "USD", stockStatus: "in_stock" });
    const a = computeAvailability([l], NOW)!;
    expect(a.sampleDays).toBe(10);
  });

  it("pools across listings", () => {
    const a = computeAvailability([listing(10, [0]), listing(10, [9])], NOW)!;
    expect(a.sampleDays).toBe(10);
    expect(a.inStockRate).toBeCloseTo(0.2, 5);
  });

  it("excludes points older than the window", () => {
    // 10 in-window days + 5 very old in-stock days; the old ones must not count.
    const l = listing(10, [9]);
    for (let i = 0; i < 5; i++) {
      l.priceHistory.push({
        date: new Date(NOW - (200 + i) * DAY).toISOString(),
        price: 100,
        currency: "USD",
        stockStatus: "in_stock",
      });
    }
    const a = computeAvailability([l], NOW)!;
    expect(a.sampleDays).toBe(10);
    expect(a.inStockRate).toBeCloseTo(0.1, 5);
  });

  it("honors a custom windowDays", () => {
    // 30 days of history; the default window keeps all, a 10-day window keeps
    // only the newest 11 (cutoff is inclusive).
    const l = listing(30, [29]);
    expect(computeAvailability([l], NOW)!.sampleDays).toBe(30);
    expect(computeAvailability([l], NOW, 10)!.sampleDays).toBe(11);
  });

  it("measures outage and cadence in calendar days on sparse samples", () => {
    const sparse = (outDays: number[]) => ({
      distributorId: "d1", productId: "p1", price: 1, currency: "USD",
      stockStatus: "in_stock", url: "", lastChecked: new Date(NOW).toISOString(),
      priceHistory: [90, 75, 60, 45, 30, 21, 14, 7, 3, 0].map((d) => ({
        date: new Date(NOW - d * DAY).toISOString(), price: 1, currency: "USD",
        stockStatus: outDays.includes(d) ? "out_of_stock" : "in_stock",
      })),
    }) as DistributorListing;
    // day 45 out -> outage spans 60d-ago to 30d-ago = 30 calendar days
    const a = computeAvailability([sparse([45])], NOW)!;
    expect(a.longestOutageDays).toBe(30);
    expect(a.typicalRestockDays).toBe(30);
  });

  it("ignores unknown-only history", () => {
    const l = listing(10, []);
    for (const p of l.priceHistory) p.stockStatus = "unknown";
    expect(computeAvailability([l], NOW)).toBeNull();
  });
});
