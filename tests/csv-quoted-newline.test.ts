import { describe, expect, it } from "vitest";
import { parseBulkImportCsv } from "../lib/csv";

describe("CSV round-trip with quoted newlines", () => {
  it("parses a quoted field containing a newline as one row", () => {
    const csv = `model,targetPrice,currency,tags
"My,
Special",100,USD,tag1`;
    const rows = parseBulkImportCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.model).toBe("My,\nSpecial");
    expect(rows[0]!.targetPrice).toBe(100);
  });

  it("parses a quoted field containing a comma", () => {
    const csv = `model,targetPrice,currency,tags
"Widget, Pro",100,USD,tag1`;
    const rows = parseBulkImportCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.model).toBe("Widget, Pro");
  });

  it("handles CRLF line endings", () => {
    const csv = "model,targetPrice,currency,tags\r\nM1,100,USD,a\r\nM2,200,USD,b";
    const rows = parseBulkImportCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[1]!.model).toBe("M2");
  });
});
