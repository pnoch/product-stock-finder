import { describe, expect, it } from "vitest";
import { activeProducts } from "../lib/acquired";
import { computeBuildOrder } from "../lib/build-order";
import { computeSourcing } from "../lib/reseller";
import { computeBasketValue } from "../lib/watchlist-stats";
import type { Product } from "../lib/types";

function listing(distributorId: string, price: number) {
  return { distributorId, productId: "x", price, currency: "USD", stockStatus: "in_stock", url: "", lastChecked: "2026-01-01T00:00:00.000Z", priceHistory: [] };
}
const dest = { countryCode: "TH", currency: "USD" };

describe("acquired consumers", () => {
  it("build-order, sourcing, and basket exclude an acquired product", () => {
    const wl = [
      { id: "p1", name: "P1", acquiredAt: "2026-02-01T00:00:00.000Z", listings: [listing("balticnetworks-us", 200)] },
      { id: "p2", name: "P2", listings: [listing("balticnetworks-us", 100)] },
    ] as unknown as Product[];
    const active = activeProducts(wl);
    expect(computeBuildOrder(active, dest, {}).split.stores.flatMap((s) => s.items).map((i) => i.productId)).toEqual(["p2"]);
    expect(computeSourcing(active, dest, {}).lines.map((l) => l.productId)).toEqual(["p2"]);
    expect(computeBasketValue(active, "USD").productCount).toBe(1);
  });
});
