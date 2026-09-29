import { describe, expect, it } from "vitest";
import { filterByRange, cheapestByRegion, distributorColor, CHART_COLORS } from "@shared/compare-utils";

const now = Date.now();
const DAY = 86_400_000;

function point(daysAgo: number, price: number, currency = "USD") {
  return {
    date: new Date(now - daysAgo * DAY).toISOString().slice(0, 10),
    price,
    currency,
    stockStatus: "in_stock" as const,
  };
}

describe("filterByRange", () => {
  const data = [point(1, 100), point(5, 200), point(20, 300), point(100, 400)];

  it("All returns everything", () => {
    expect(filterByRange(data, "All")).toHaveLength(4);
  });

  it("1W returns last 7 days", () => {
    expect(filterByRange(data, "1W")).toHaveLength(2);
  });

  it("1M returns last 30 days", () => {
    expect(filterByRange(data, "1M")).toHaveLength(3);
  });

  it("3M returns last 90 days", () => {
    expect(filterByRange(data, "3M")).toHaveLength(3);
  });

  it("anchors on now, not a future-dated point", () => {
    // A clock-skewed future point must not push the window forward and drop
    // the recent points. The anchor is `min(now, max(dates))`.
    const skewed = [point(1, 100), point(5, 200), point(-100, 300)];
    // 1W: the two recent points are within 7 days of now; the future point is
    // also kept (it is after the cutoff), but the recent ones must not be lost.
    const kept = filterByRange(skewed, "1W");
    expect(kept.some((p) => p.price === 100)).toBe(true);
    expect(kept.some((p) => p.price === 200)).toBe(true);
  });
});

describe("cheapestByRegion", () => {
  it("selects cheapest per region, skips out_of_stock", () => {
    const listings = [
      {
        distributorId: "balticnetworks-us",
        productId: "p1",
        price: 209,
        currency: "USD",
        stockStatus: "in_stock" as const,
        url: "",
        lastChecked: "",
        priceHistory: [],
      },
      {
        distributorId: "linktechs-us",
        productId: "p1",
        price: 219,
        currency: "USD",
        stockStatus: "in_stock" as const,
        url: "",
        lastChecked: "",
        priceHistory: [],
      },
      {
        distributorId: "mikrotikstore-de",
        productId: "p1",
        price: 185,
        currency: "EUR",
        stockStatus: "out_of_stock" as const,
        url: "",
        lastChecked: "",
        priceHistory: [],
      },
    ];
    const result = cheapestByRegion(listings);
    // US region: balticnetworks is cheapest at 209 USD
    // EU: mikrotikstore is out_of_stock → excluded
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.find((r) => r.region === "North America")?.listing.distributorId).toBe("balticnetworks-us");
  });

  it("skips listings with price <= 0", () => {
    const listings = [
      {
        distributorId: "balticnetworks-us",
        productId: "p1",
        price: 0,
        currency: "USD",
        stockStatus: "in_stock" as const,
        url: "",
        lastChecked: "",
        priceHistory: [],
      },
    ];
    expect(cheapestByRegion(listings)).toEqual([]);
  });

  it("uses a back-order listing only when the region has nothing in stock", () => {
    const mk = (stockStatus: "in_stock" | "back_order", price: number) => ({
      distributorId: "balticnetworks-us",
      productId: "p1",
      price,
      currency: "USD",
      stockStatus,
      url: "",
      lastChecked: "",
      priceHistory: [],
    });
    // Only a back-order listing: it becomes the region's pick.
    const backOnly = cheapestByRegion([mk("back_order", 100)]);
    expect(backOnly[0]?.listing.stockStatus).toBe("back_order");
    // An in-stock listing wins even if the back-order one is cheaper.
    const both = cheapestByRegion([mk("back_order", 50), mk("in_stock", 100)]);
    expect(both[0]?.listing.stockStatus).toBe("in_stock");
    expect(both[0]?.listing.price).toBe(100);
  });

  it("keeps the first listing on an equal converted price", () => {
    // The comparison is strict (`converted < existing.converted`), so a tie
    // keeps the earlier listing.
    const mk = (distributorId: string, price: number) => ({
      distributorId,
      productId: "p1",
      price,
      currency: "USD",
      stockStatus: "in_stock" as const,
      url: "",
      lastChecked: "",
      priceHistory: [],
    });
    // balticnetworks-us and rocnoc-us are both North America.
    const result = cheapestByRegion([mk("balticnetworks-us", 100), mk("rocnoc-us", 100)]);
    expect(result[0]?.listing.distributorId).toBe("balticnetworks-us");
  });
});

describe("distributorColor", () => {
  it("is deterministic, always within the palette, and pins known ids", () => {
    expect(distributorColor("mikrotik")).toBe(distributorColor("mikrotik"));
    // Pinned so a regression to a constant / index-based color fails: mobile and
    // desktop must agree on the hash mapping.
    expect(distributorColor("mikrotik")).toBe("#F59E0B");
    expect(distributorColor("MikroTik")).toBe("#00C896");
    for (const id of ["a", "mikrotik", "ubiquiti", "streakwave", ""]) {
      expect(CHART_COLORS).toContain(distributorColor(id));
    }
  });
});
