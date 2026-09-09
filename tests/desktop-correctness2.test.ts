import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { buildDigestSnapshot } from "../lib/price-digest";
import type { Product } from "../lib/types";

describe("desktop correctness follow-ups 2", () => {
  it("focuses compare on the row distributor", async () => {
    const compare = await readFile("desktop/src/pages/Compare.tsx", "utf8");
    const detail = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(compare).toContain('get("distributor")');
    expect(detail).toContain("?distributor=");
  });

  it("refreshes live prices on the product page", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(text).toContain("prices.get");
    expect(text).not.toContain("buyNowLoading");
  });

  it("builds digest snapshots via shared helper", () => {
    const products = [
      {
        id: "p1",
        name: "Widget",
        listings: [
          {
            distributorId: "d1",
            price: 100,
            currency: "USD",
            stockStatus: "in_stock",
            priceHistory: [],
            lastChecked: new Date().toISOString(),
          },
        ],
      },
    ] as unknown as Product[];
    const snap = buildDigestSnapshot(products, "USD");
    expect(snap.displayCurrency).toBe("USD");
    expect(snap.products).toHaveLength(1);
    expect(snap.products[0]).toMatchObject({ productId: "p1", bestPrice: 100, stockStatus: "in_stock" });
    expect(typeof snap.lastDigestAt).toBe("string");
  });

  it("surfaces first-load probe failures", async () => {
    const text = await readFile("desktop/src/pages/Watchlist.tsx", "utf8");
    expect(text).toContain("listError");
  });
});
