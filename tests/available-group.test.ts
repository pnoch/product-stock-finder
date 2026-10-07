import { describe, expect, it } from "vitest";
import { groupAvailable } from "../server/available";

const catalog = [
  { id: "p1", name: "Switch A", brand: "MikroTik", category: "Networking Switch", modelNumber: "M1" },
  { id: "p2", name: "Switch B", brand: "Ubiquiti", category: "Networking Switch", modelNumber: "M2" },
  { id: "p3", name: "NAS C", brand: "Synology", category: "Storage", modelNumber: "M3" },
] as never;

function row(
  modelNumber: string,
  distributorId: string,
  price: number,
  stockStatus = "in_stock",
  currency = "USD",
) {
  return { distributorId, modelNumber, price, currency, stockStatus, url: "", fetchedAt: 1000 } as never;
}

describe("groupAvailable", () => {
  it("keeps only models with an in-stock row", () => {
    const out = groupAvailable([row("M1", "d1", 100), row("M2", "d1", 50, "out_of_stock")], catalog, "USD");
    expect(out.map((r) => r.modelNumber)).toEqual(["M1"]);
  });

  it("picks the min price and counts distinct stores", () => {
    const out = groupAvailable([row("M1", "d1", 120), row("M1", "d2", 100), row("M1", "d2", 110)], catalog, "USD");
    expect(out[0]!.bestPrice).toBe(100);
    expect(out[0]!.storeCount).toBe(2);
    expect(out[0]!.bestDistributorId).toBe("d2");
  });

  it("sorts by best price ascending", () => {
    const out = groupAvailable([row("M1", "d1", 200), row("M3", "d1", 50)], catalog, "USD");
    expect(out.map((r) => r.modelNumber)).toEqual(["M3", "M1"]);
  });

  it("drops rows whose model is not in the catalog", () => {
    const out = groupAvailable([row("ZZZ", "d1", 1)], catalog, "USD");
    expect(out).toHaveLength(0);
  });

  it("converts a foreign-currency row into the target currency", () => {
    const out = groupAvailable([row("M1", "d1", 92, "in_stock", "EUR")], catalog, "USD");
    expect(out[0]!.bestPrice).toBeCloseTo(100, 6);
    expect(out[0]!.bestCurrency).toBe("USD");
  });
});
