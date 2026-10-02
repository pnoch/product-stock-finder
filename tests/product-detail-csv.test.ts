import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("product detail CSV export (mobile/web)", () => {
  it("adds a guarded CSV export action to Product Detail", () => {
    const mobile = readFileSync("app/product/[id].tsx", "utf8");
    expect(mobile).toContain("hasExportablePriceData");
    expect(mobile).toContain("productHistoryToCsv");
    expect(mobile).toContain("exportCsvFile");
    expect(mobile).toContain("Export CSV");
  });
});
