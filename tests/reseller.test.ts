import { describe, expect, it } from "vitest";
import { computeSourcing } from "../lib/reseller";
import type { Product } from "../lib/types";

function listing(distributorId: string, price: number, stockStatus = "in_stock") {
  return {
    distributorId,
    productId: "x",
    price,
    currency: "USD",
    stockStatus,
    url: "",
    lastChecked: "2026-01-01T00:00:00.000Z",
    priceHistory: [],
  };
}
const dest = { countryCode: "TH", currency: "USD" };

describe("computeSourcing", () => {
  it("computes buy/unit, spread, margin, and totals with exact values", () => {
    // balticnetworks-us ships to TH at 55; linktechs-us at 57. Prices 200/250
    // -> landed 255/307. Cheapest = 255.
    const wl = [
      {
        id: "p1",
        name: "P1",
        quantity: 20,
        targetSellPrice: 280,
        sellCurrency: "USD",
        listings: [listing("balticnetworks-us", 200), listing("linktechs-us", 250)],
      },
    ] as unknown as Product[];
    const s = computeSourcing(wl, dest, {});
    const line = s.lines[0]!;
    expect(line.quantity).toBe(20);
    expect(line.buyUnit).toBe(255);
    expect(line.spreadMin).toBe(255);
    expect(line.spreadMax).toBe(307);
    expect(line.sellUnit).toBe(280);
    expect(line.marginUnit).toBe(25);
    expect(line.marginTotal).toBe(500);
    expect(s.totalOutlay).toBe(5100);
    expect(s.totalMargin).toBe(500);
  });

  it("excludes back-order listings from the spread", () => {
    const wl = [
      {
        id: "p1",
        name: "P1",
        listings: [
          listing("balticnetworks-us", 200),
          listing("linktechs-us", 900, "back_order"),
        ],
      },
    ] as unknown as Product[];
    const line = computeSourcing(wl, dest, {}).lines[0]!;
    // The 900 back-order listing must not inflate spreadMax.
    expect(line.spreadMax).toBe(255);
  });

  it("converts a non-USD sell price into the destination currency", () => {
    const wl = [
      {
        id: "p1",
        name: "P1",
        quantity: 1,
        targetSellPrice: 100,
        sellCurrency: "EUR",
        listings: [listing("balticnetworks-us", 200)],
      },
    ] as unknown as Product[];
    const line = computeSourcing(wl, dest, {}).lines[0]!;
    // 100 EUR -> USD at the static rate (0.92): ~108.7, not 100.
    expect(line.sellUnit).not.toBe(100);
    expect(line.sellUnit).toBeGreaterThan(100);
  });

  it("defaults quantity to 1 and leaves margin null without a sell price", () => {
    const wl = [
      { id: "p1", name: "P1", listings: [listing("balticnetworks-us", 200)] },
    ] as unknown as Product[];
    const s = computeSourcing(wl, dest, {});
    expect(s.lines[0]!.quantity).toBe(1);
    expect(s.lines[0]!.sellUnit).toBeNull();
    expect(s.lines[0]!.marginUnit).toBeNull();
    expect(s.totalMargin).toBeNull();
  });

  it("leaves buy/margin null when there is no purchasable listing", () => {
    const wl = [
      {
        id: "p1",
        name: "P1",
        listings: [listing("balticnetworks-us", 200, "out_of_stock")],
      },
    ] as unknown as Product[];
    const s = computeSourcing(wl, dest, {});
    expect(s.lines[0]!.buyUnit).toBeNull();
    expect(s.lines[0]!.marginUnit).toBeNull();
  });
});
