import { describe, expect, it } from "vitest";
import { watchlistToCsv } from "../lib/csv";
import type { Product } from "../lib/types";

function product(name: string): Product {
  return {
    id: "p1",
    name,
    modelNumber: "M1",
    brand: "B",
    category: "C",
    description: "",
    addedAt: "2026-01-01T00:00:00.000Z",
    isWatched: true,
    listings: [],
  };
}

describe("CSV formula injection", () => {
  it("neutralizes cells starting with a formula character", () => {
    for (const evil of ["=1+1", "+SUM(A1)", "-2+3", "@cmd", "\t=1+1"]) {
      const csv = watchlistToCsv([product(evil)], "USD");
      // The cell must be prefixed with a single quote so spreadsheets treat it
      // as text, not a formula.
      expect(csv).toContain(`'${evil}`);
    }
  });

  it("leaves ordinary names untouched", () => {
    const csv = watchlistToCsv([product("MikroTik CRS804")], "USD");
    expect(csv).toContain("MikroTik CRS804");
    expect(csv).not.toContain("'MikroTik");
  });
});
