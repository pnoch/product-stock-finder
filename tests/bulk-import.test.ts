import { describe, expect, it } from "vitest";
import { matchModels, parseModelInput } from "../lib/bulk-import";
import { PRODUCT_CATALOG } from "../lib/catalog";

describe("parseModelInput", () => {
  it("splits on newlines, commas, semicolons, and tabs", () => {
    expect(parseModelInput("A\nB,C;D\tE")).toEqual(["A", "B", "C", "D", "E"]);
  });

  it("trims whitespace and drops empties", () => {
    expect(parseModelInput("  A \n\n B \t , , C ")).toEqual(["A", "B", "C"]);
  });

  it("strips one layer of wrapping quotes", () => {
    expect(parseModelInput('"CRS804" \'CCR2216\'')).toEqual([
      "CRS804",
      "CCR2216",
    ]);
  });

  it("dedupes case-insensitively keeping first occurrence", () => {
    expect(parseModelInput("crs804 CRS804 Crs804 other")).toEqual([
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

  it("does not substring-match", () => {
    const { matched } = matchModels(["CRS804"], PRODUCT_CATALOG);
    // Catalog contains "CRS804-4DDQ-hRM" — plain "CRS804" must NOT match.
    expect(matched).toHaveLength(0);
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
