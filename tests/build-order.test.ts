import { describe, expect, it } from "vitest";
import { computeBuildOrder } from "../lib/build-order";
import type { Product } from "../lib/types";

// Two real USD distributors that ship to TH (Asia-Pacific): balticnetworks-us
// (shipping 55) and linktechs-us (shipping 57). baltic carries both products;
// linktechs carries only p1 (cheaper there).
function listing(distributorId: string, price: number) {
  return {
    distributorId, productId: "x", price, currency: "USD",
    stockStatus: "in_stock", url: "", lastChecked: "2026-01-01T00:00:00.000Z",
    priceHistory: [],
  };
}
const watchlist = [
  { id: "p1", name: "P1", listings: [listing("balticnetworks-us", 120), listing("linktechs-us", 100)] },
  { id: "p2", name: "P2", listings: [listing("balticnetworks-us", 200)] },
] as unknown as Product[];

const dest = { countryCode: "TH", currency: "USD" };
const opts = {};

describe("computeBuildOrder", () => {
  it("builds the split plan with shipping once per store", () => {
    const { split } = computeBuildOrder(watchlist, dest, opts);
    expect(split.stores.map((s) => s.distributorId).sort()).toEqual(["balticnetworks-us", "linktechs-us"]);
    const baltic = split.stores.find((s) => s.distributorId === "balticnetworks-us")!;
    const link = split.stores.find((s) => s.distributorId === "linktechs-us")!;
    expect(baltic.itemsTotal).toBe(200);
    expect(link.itemsTotal).toBe(100);
    expect(split.shippingTotal).toBe(baltic.shipping + link.shipping);
    expect(split.total).toBe(split.itemsTotal + split.shippingTotal);
  });

  it("builds the single-store plan from the store carrying everything", () => {
    const { singleStore } = computeBuildOrder(watchlist, dest, opts);
    expect(singleStore).not.toBeNull();
    expect(singleStore!.stores).toHaveLength(1);
    expect(singleStore!.stores[0]!.distributorId).toBe("balticnetworks-us");
    expect(singleStore!.itemsTotal).toBe(320);
  });

  it("reports savings as split.total - singleStore.total", () => {
    const { split, singleStore, savings } = computeBuildOrder(watchlist, dest, opts);
    expect(savings).toBe(split.total - singleStore!.total);
  });

  it("lists unassigned products with no orderable listing", () => {
    const wl = [
      { id: "p1", name: "P1", listings: [listing("balticnetworks-us", 100)] },
      { id: "p2", name: "P2", listings: [] },
    ] as unknown as Product[];
    const { split } = computeBuildOrder(wl, dest, opts);
    expect(split.unassigned).toEqual(["p2"]);
  });

  it("returns a null single-store plan when no store carries everything", () => {
    const wl = [
      { id: "p1", name: "P1", listings: [listing("balticnetworks-us", 100)] },
      { id: "p2", name: "P2", listings: [listing("linktechs-us", 100)] },
    ] as unknown as Product[];
    expect(computeBuildOrder(wl, dest, opts).singleStore).toBeNull();
  });

  it("charges a store's shipping once even when it holds several products", () => {
    const wl = [
      {
        id: "p1",
        name: "P1",
        listings: [listing("balticnetworks-us", 100), listing("linktechs-us", 300)],
      },
      { id: "p2", name: "P2", listings: [listing("balticnetworks-us", 200)] },
    ] as unknown as Product[];
    const { split } = computeBuildOrder(wl, dest, opts);
    const baltic = split.stores.find((s) => s.distributorId === "balticnetworks-us")!;
    expect(baltic.items).toHaveLength(2);
    expect(baltic.itemsTotal).toBe(300);
    expect(baltic.shipping).toBe(55);
    expect(split.shippingTotal).toBe(55);
    expect(split.total).toBe(355);
  });

  it("picks the cheaper distributor when both carry every product", () => {
    const wl = [
      {
        id: "p1",
        name: "P1",
        listings: [listing("balticnetworks-us", 100), listing("linktechs-us", 120)],
      },
      {
        id: "p2",
        name: "P2",
        listings: [listing("balticnetworks-us", 200), listing("linktechs-us", 210)],
      },
    ] as unknown as Product[];
    const { singleStore } = computeBuildOrder(wl, dest, opts);
    expect(singleStore).not.toBeNull();
    expect(singleStore!.stores[0]!.distributorId).toBe("balticnetworks-us");
    expect(singleStore!.total).toBe(355);
  });

  it("assigns a product to unassigned when its only listing has unknown shipping", () => {
    const wl = [
      { id: "p1", name: "P1", listings: [listing("balticnetworks-us", 100)] },
    ] as unknown as Product[];
    const { split } = computeBuildOrder(
      wl,
      { countryCode: "ZZ", currency: "USD" },
      opts,
    );
    expect(split.unassigned).toEqual(["p1"]);
  });

  it("reports zero savings when there is no single-store plan", () => {
    const wl = [
      { id: "p1", name: "P1", listings: [listing("balticnetworks-us", 100)] },
      { id: "p2", name: "P2", listings: [listing("linktechs-us", 100)] },
    ] as unknown as Product[];
    const { singleStore, savings } = computeBuildOrder(wl, dest, opts);
    expect(singleStore).toBeNull();
    expect(savings).toBe(0);
  });

  it("ranks by landed total, not item cost", () => {
    // apple-us (ship 35) on 200 -> total 235; winncom-us (ship 53) on 190 ->
    // total 243. The lower item cost loses on landed total.
    const wl = [
      {
        id: "p1",
        name: "P1",
        listings: [listing("apple-us", 200), listing("winncom-us", 190)],
      },
    ] as unknown as Product[];
    const { split } = computeBuildOrder(wl, dest, opts);
    expect(split.stores).toHaveLength(1);
    expect(split.stores[0]!.distributorId).toBe("apple-us");
    expect(split.stores[0]!.itemsTotal).toBe(200);
  });

  it("skips a zero-price listing so it cannot anchor the plan", () => {
    const wl = [
      {
        id: "p1",
        name: "P1",
        listings: [listing("balticnetworks-us", 0), listing("linktechs-us", 100)],
      },
    ] as unknown as Product[];
    const { split } = computeBuildOrder(wl, dest, opts);
    expect(split.stores).toHaveLength(1);
    expect(split.stores[0]!.distributorId).toBe("linktechs-us");
  });
});
