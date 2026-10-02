import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("product detail CSV export (mobile/web)", () => {
  it("adds a guarded CSV export action to Product Detail", () => {
    const mobile = readFileSync("app/product/[id].tsx", "utf8");
    expect(mobile).toContain("hasExportablePriceData");
    expect(mobile).toContain("productHistoryToCsv");
    expect(mobile).toContain("exportCsvFile");
    expect(mobile).toContain("Export CSV");
    expect(mobile).toContain("onPress={handleExportCsv}");
  });
});

describe("product detail CSV export (desktop)", () => {
  it("adds a guarded CSV export action to the desktop Product Detail", () => {
    const desktop = readFileSync("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(desktop).toContain("hasExportablePriceData");
    expect(desktop).toContain("productHistoryToCsv");
    expect(desktop).toContain("saveCsv");
    expect(desktop).toContain("Export CSV");
    expect(desktop).toContain("onClick={handleExportCsv}");
  });
});
