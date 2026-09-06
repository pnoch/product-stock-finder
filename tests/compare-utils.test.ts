import { describe, expect, it } from "vitest";
import { filterByRange, cheapestByRegion } from "@shared/compare-utils";

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
});
