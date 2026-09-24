import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("shared search chrome", () => {
  for (const f of ["desktop/src/pages/Search.tsx", "desktop/src/components/SearchModal.tsx"]) {
    it(`${f} imports shared chrome`, async () => {
      const text = await readFile(f, "utf8");
      expect(text).toContain("search-chrome");
      expect(text).not.toContain("function PillFilterRow");
      expect(text).not.toContain("CATALOG_SORT_OPTIONS =");
    });

    // QA round 130: desktop's bulk import used a plain for-loop with no
    // per-item error handling, so one storage rejection aborted the whole
    // import (mobile uses Promise.allSettled and reports skipped items).
    it(`${f} bulk import tolerates per-item failures`, async () => {
      const text = await readFile(f, "utf8");
      const start = text.indexOf("const handleBulkImport");
      expect(start).toBeGreaterThan(-1);
      const block = text.slice(start, text.indexOf("};", start));
      expect(block).toContain("Promise.allSettled");
      expect(block).not.toMatch(/for \(const \w+ of bulkNew\)/);
    });
  }
});
