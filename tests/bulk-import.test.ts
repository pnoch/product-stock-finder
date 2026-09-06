import { describe, expect, it } from "vitest";
import { matchModels, parseModelInput } from "../lib/bulk-import";
import { PRODUCT_CATALOG } from "@shared/catalog";

describe("parseModelInput", () => {
  it("splits on newlines when present and preserves spaces inside entries", () => {
    expect(parseModelInput("A\nB\nC")).toEqual(["A", "B", "C"]);
    expect(parseModelInput("Model With Space\nAnother")).toEqual(["Model With Space", "Another"]);
  });

  it("splits on commas and semicolons when no newlines", () => {
    expect(parseModelInput("A,B;C")).toEqual(["A", "B", "C"]);
    expect(parseModelInput("A; B, C")).toEqual(["A", "B", "C"]);
    expect(parseModelInput("A B\tC")).toEqual(["A B\tC"]);
  });

  it("trims whitespace and drops empties", () => {
    expect(parseModelInput("  A \n\n B \n C ")).toEqual(["A", "B", "C"]);
    expect(parseModelInput("  A , , B ,, C ")).toEqual(["A", "B", "C"]);
  });

  it("strips one layer of wrapping quotes", () => {
    expect(parseModelInput('"CRS804","CCR2216"')).toEqual([
      "CRS804",
      "CCR2216",
    ]);
    expect(parseModelInput("'CRS804', 'CCR2216'")).toEqual([
      "CRS804",
      "CCR2216",
    ]);
  });

  it("dedupes case-insensitively keeping first occurrence", () => {
    expect(parseModelInput("crs804,crs804,Crs804,other")).toEqual([
      "crs804",
      "other",
    ]);
  });

  it("returns empty array for whitespace-only input", () => {
    expect(parseModelInput("   \n\t  ")).toEqual([]);
  });
});

describe("matchModels", () => {
  it("matches model numbers case-insensitively preserving input order", () => {
    const { matched, unmatched } = matchModels(
      ["crs804-4ddq-hrm", "NOPE-123"],
      PRODUCT_CATALOG,
    );
    expect(matched).toHaveLength(1);
    expect(matched[0].modelNumber).toBe("CRS804-4DDQ-hRM");
    expect(unmatched).toEqual(["NOPE-123"]);
  });

  it("fuzzy-matches close model numbers via Fuse threshold 0.3", () => {
    const { matched } = matchModels(["CRS804"], PRODUCT_CATALOG);
    // Catalog contains "CRS804-4DDQ-hRM" — fuzzy search should match with score <=0.3.
    expect(matched).toHaveLength(1);
    expect(matched[0].modelNumber).toBe("CRS804-4DDQ-hRM");
  });

  it("dedupes duplicate matches", () => {
    const real = PRODUCT_CATALOG[0].modelNumber;
    const { matched } = matchModels(
      [real, real.toLowerCase()],
      PRODUCT_CATALOG,
    );
    expect(matched).toHaveLength(1);
  });
});
