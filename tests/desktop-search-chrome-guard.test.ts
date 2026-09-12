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
  }
});
