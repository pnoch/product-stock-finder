import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

const SEARCH_SURFACES = [
  "app/search.tsx",
  "desktop/src/pages/Search.tsx",
  "desktop/src/components/SearchModal.tsx",
];

describe("shared search options", () => {
  it("exports SEARCH_OPTIONS and a price sorter from shared catalog", async () => {
    const text = await readFile("shared/src/catalog.ts", "utf8");
    expect(text).toContain("SEARCH_OPTIONS");
    expect(text).toContain("sortCatalogByPrice");
    expect(text).not.toContain("searchCatalogFuzzy");
    expect(text).not.toContain("searchCatalogAsync");
  });
  for (const f of SEARCH_SURFACES) {
    it(`${f} uses shared options with no inline keys`, async () => {
      const text = await readFile(f, "utf8");
      expect(text).not.toContain('name: "modelNumber"');
    });
  }
  for (const f of ["desktop/src/pages/Search.tsx", "desktop/src/components/SearchModal.tsx"]) {
    it(`${f} defers the search query`, async () => {
      const text = await readFile(f, "utf8");
      expect(text).toContain("useDeferredValue");
    });
  }
});
