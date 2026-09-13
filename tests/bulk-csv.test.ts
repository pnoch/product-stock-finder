import { describe, expect, it } from "vitest";
import { parseBulkImportCsv } from "../lib/csv";

describe("parseBulkImportCsv", () => {
  it("parses model, targetPrice, currency, tags with header", () => {
    const csv = `model,targetPrice,currency,tags
CRS326,100,USD,core;lab
CRS804,200,EUR,core
"CRS 305",,USD,`;
    const rows = parseBulkImportCsv(csv);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({ model: "CRS326", targetPrice: 100, currency: "USD", tags: ["core", "lab"] });
    expect(rows[1]).toEqual({ model: "CRS804", targetPrice: 200, currency: "EUR", tags: ["core"] });
    expect(rows[2]).toEqual({ model: "CRS 305", targetPrice: null, currency: "USD", tags: [] });
  });

  it("handles BOM and blank lines and quoted commas", () => {
    const csv = `\uFEFFmodel,targetPrice,currency,tags

CRS326,100,USD,"core, lab"
`;
    const rows = parseBulkImportCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tags).toEqual(["core", "lab"]);
  });

  it("rejects rows without model and caps at 500 rows", () => {
    const many = Array.from({ length: 600 }, (_, i) => `M${i},100,USD,`).join("\n");
    const csv = `model,targetPrice,currency,tags\n${many}\n,100,USD,`;
    const rows = parseBulkImportCsv(csv);
    expect(rows.length).toBe(500);
    expect(rows.every((r) => r.model.length > 0)).toBe(true);
  });
});
