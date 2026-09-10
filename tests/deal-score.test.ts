import { describe, expect, it } from "vitest";
import type { DistributorListing } from "@/lib/types";
import { computeDealScore } from "@/lib/deal-score";

function listing(
  prices: { date: string; price: number; currency?: string }[],
  distributorId = "d1",
): DistributorListing {
  return {
    distributorId,
    productId: "p1",
    price: prices[prices.length - 1].price,
    currency: prices[prices.length - 1].currency ?? "USD",
    stockStatus: "in_stock",
    url: "https://example.com/p1",
    lastChecked: prices[prices.length - 1].date,
    priceHistory: prices.map((p) => ({
      date: p.date,
      price: p.price,
      currency: p.currency ?? "USD",
      stockStatus: "in_stock" as const,
    })),
  };
}

const D = [
  "2025-10-01T00:00:00.000Z",
  "2025-10-16T00:00:00.000Z",
  "2025-10-31T00:00:00.000Z",
  "2025-11-15T00:00:00.000Z",
  "2025-11-30T00:00:00.000Z",
];

function priced(values: number[], dates: string[] = D): { date: string; price: number }[] {
  return values.map((price, i) => ({ date: dates[i], price }));
}

describe("computeDealScore", () => {
  it("scores falling-to-low history as hot (score >= 75)", () => {
    const listings = [listing(priced([200, 180, 160, 140, 100]))];
    const result = computeDealScore(listings, "USD");
    expect(result).not.toBeNull();
    expect(result!.score).toBeGreaterThanOrEqual(75);
    expect(result!.band).toBe("hot");
  });

  it("scores rising-to-high history in the wait band (score < 40)", () => {
    const listings = [listing(priced([100, 120, 140, 160, 200]))];
    const result = computeDealScore(listings, "USD");
    expect(result).not.toBeNull();
    expect(result!.score).toBeLessThan(40);
    expect(result!.band).toBe("wait");
  });

  it("scores flat mid-range history in the fair band (40-74)", () => {
    const listings = [listing(priced([150, 150, 150, 150, 150]))];
    const result = computeDealScore(listings, "USD");
    expect(result).not.toBeNull();
    expect(result!.score).toBeGreaterThanOrEqual(40);
    expect(result!.score).toBeLessThan(75);
    expect(result!.band).toBe("fair");
  });

  it("returns null when fewer than 3 points", () => {
    const listings = [
      listing([
        { date: D[0], price: 200 },
        { date: D[4], price: 100 },
      ]),
    ];
    expect(computeDealScore(listings, "USD")).toBeNull();
  });

  it("returns null when span is under 14 days", () => {
    const dates = [
      "2026-01-01T00:00:00.000Z",
      "2026-01-03T00:00:00.000Z",
      "2026-01-05T00:00:00.000Z",
      "2026-01-07T00:00:00.000Z",
      "2026-01-10T00:00:00.000Z",
    ];
    const listings = [listing(priced([200, 180, 160, 140, 100], dates))];
    expect(computeDealScore(listings, "USD")).toBeNull();
  });

  it("converts multi-currency history (non-null, sane band)", () => {
    const listings = [
      listing([
        { date: D[0], price: 184, currency: "EUR" },
        { date: D[1], price: 165, currency: "EUR" },
        { date: D[2], price: 160, currency: "USD" },
        { date: D[3], price: 140, currency: "USD" },
        { date: D[4], price: 100, currency: "USD" },
      ]),
    ];
    const result = computeDealScore(listings, "USD");
    expect(result).not.toBeNull();
    expect(result!.score).toBeGreaterThanOrEqual(0);
    expect(result!.score).toBeLessThanOrEqual(100);
    expect(["hot", "fair", "wait"]).toContain(result!.band);
  });

  it("returns null when only unconvertible prices exist", () => {
    const listings = [
      listing([
        { date: D[0], price: 200, currency: "XXX" },
        { date: D[1], price: 180, currency: "XXX" },
        { date: D[2], price: 160, currency: "XXX" },
        { date: D[3], price: 140, currency: "XXX" },
        { date: D[4], price: 100, currency: "XXX" },
      ]),
    ];
    expect(computeDealScore(listings, "USD")).toBeNull();
  });

  it("scores spiky history lower than smooth with same endpoints", () => {
    const smooth = [listing(priced([200, 180, 160, 140, 100]))];
    const spiky = [listing(priced([200, 250, 100, 250, 100]))];
    const smoothScore = computeDealScore(smooth, "USD");
    const spikyScore = computeDealScore(spiky, "USD");
    expect(smoothScore).not.toBeNull();
    expect(spikyScore).not.toBeNull();
    expect(spikyScore!.score).toBeLessThan(smoothScore!.score);
  });

  it("scores a fresh drop higher than a stale drop at the same level", () => {
    const fresh = [listing(priced([200, 200, 200, 200, 100]))];
    const stale = [listing(priced([200, 100, 100, 100, 100]))];
    const freshScore = computeDealScore(fresh, "USD");
    const staleScore = computeDealScore(stale, "USD");
    expect(freshScore).not.toBeNull();
    expect(staleScore).not.toBeNull();
    expect(freshScore!.score).toBeGreaterThan(staleScore!.score);
  });
});
