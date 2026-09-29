import { describe, expect, it } from "vitest";
import {
  parseWatchlistCsv,
  watchlistToDetailedCsv,
} from "../lib/csv";
import type { Product } from "../lib/types";

function product(): Product {
  return {
    id: "CRS804",
    name: "CRS804",
    brand: "MikroTik",
    category: "Switch",
    modelNumber: "CRS804",
    description: "",
    isWatched: true,
    addedAt: new Date().toISOString(),
    listings: [
      {
        distributorId: "getic-gr",
        productId: "CRS804",
        price: 100,
        currency: "USD",
        stockStatus: "in_stock",
        url: "",
        lastChecked: new Date().toISOString(),
        priceHistory: [],
      },
    ],
  } as unknown as Product;
}

describe("detailed CSV share header", () => {
  it("prepends the share deep-link line when shareUrl is provided", () => {
    const csv = watchlistToDetailedCsv([product()], {
      shareUrl: "https://example.com/w/tok123",
    });
    const firstLine = csv.split("\n")[0];
    expect(firstLine).toContain("https://example.com/w/tok123");
  });

  it("round-trips through the parser that skips /w/ lines", () => {
    const csv = watchlistToDetailedCsv([product()], {
      shareUrl: "https://example.com/w/tok123",
    });
    const parsed = parseWatchlistCsv(csv);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.modelNumber).toBe("CRS804");
  });

  it("emits no share line when shareUrl is absent", () => {
    const csv = watchlistToDetailedCsv([product()]);
    expect(csv).not.toContain("/w/");
    expect(csv.split("\n")[0]).toContain("product,model");
  });

  // The skip predicate matched any "#"-prefixed line, so a product named
  // "#1 Router" was silently dropped on re-import (round-trip data loss).
  it("round-trips a product whose name starts with #", () => {
    const p = { ...product(), name: "#1 Router", modelNumber: "#1 Router" };
    const parsed = parseWatchlistCsv(watchlistToDetailedCsv([p]));
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.name).toBe("#1 Router");
  });

  it("still skips the emitted '# Share:' header", () => {
    const csv = watchlistToDetailedCsv([product()], {
      shareUrl: "https://example.com/w/tok123",
    });
    expect(csv.split("\n")[0]).toMatch(/^#\s*Share:/i);
    expect(parseWatchlistCsv(csv)).toHaveLength(1);
  });
});
