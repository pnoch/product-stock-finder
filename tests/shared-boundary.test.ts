import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

const desktopPages = [
  "desktop/src/pages/Rates.tsx",
  "desktop/src/pages/Search.tsx",
  "desktop/src/pages/Watchlist.tsx",
  "desktop/src/components/SearchModal.tsx",
];

describe("desktop parity architecture", () => {
  it("keeps desktop on shared or lib boundaries", async () => {
    for (const file of desktopPages) {
      const text = await readFile(file, "utf8");
      expect(text).toMatch(/@shared\/|@\/lib\//);
      expect(text).not.toMatch(/from ["']\.\.\/\.\.\/(shared|catalog|currency|distributors|fx|trending|compare-utils)/);
    }
  });
});
