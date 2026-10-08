import { describe, expect, it } from "vitest";
import { computeSourcing } from "../lib/reseller";
import type { Product } from "../lib/types";

function listing(distributorId: string, price: number, stockStatus = "in_stock") {
  return { distributorId, productId: "x", price, currency: "USD", stockStatus, url: "", lastChecked: "2026-01-01T00:00:00.000Z", priceHistory: [] };
}
const dest = { countryCode: "TH", currency: "USD" };

describe("computeSourcing", () => {
  it("computes buy/unit, spread, margin, and totals", () => {
    const wl = [{ id: "p1", name: "P1", quantity: 20, targetSellPrice: 280, sellCurrency: "USD", listings: [listing("balticnetworks-us", 200), listing("linktechs-us", 250)] }] as unknown as Product[];
    const s = computeSourcing(wl, dest, {});
    const line = s.lines[0]!;
    expect(line.quantity).toBe(20);
    expect(line.buyUnit).not.toBeNull();
    expect(line.spreadMin).not.toBeNull();
    expect(line.spreadMax).not.toBeNull();
    expect(line.spreadMax! > line.spreadMin!).toBe(true);
    expect(line.marginUnit).toBeCloseTo(280 - line.buyUnit!, 5);
    expect(line.marginTotal).toBeCloseTo(line.marginUnit! * 20, 5);
    expect(s.totalOutlay).toBeCloseTo(line.buyUnit! * 20, 5);
    expect(s.totalMargin).toBeCloseTo(line.marginTotal!, 5);
  });
  it("defaults quantity to 1 and leaves margin null without a sell price", () => {
    const wl = [{ id: "p1", name: "P1", listings: [listing("balticnetworks-us", 200)] }] as unknown as Product[];
    const s = computeSourcing(wl, dest, {});
    expect(s.lines[0]!.quantity).toBe(1);
    expect(s.lines[0]!.sellUnit).toBeNull();
    expect(s.lines[0]!.marginUnit).toBeNull();
    expect(s.totalMargin).toBeNull();
  });
  it("leaves buy/margin null when there is no purchasable listing", () => {
    const wl = [{ id: "p1", name: "P1", listings: [listing("balticnetworks-us", 200, "out_of_stock")] }] as unknown as Product[];
    const s = computeSourcing(wl, dest, {});
    expect(s.lines[0]!.buyUnit).toBeNull();
    expect(s.lines[0]!.marginUnit).toBeNull();
  });
});
