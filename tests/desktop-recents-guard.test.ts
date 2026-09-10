import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop recent-searches dedup", () => {
  for (const f of ["desktop/src/pages/Search.tsx", "desktop/src/components/SearchModal.tsx"]) {
    it(`${f} delegates core logic to the shared module`, async () => {
      const text = await readFile(f, "utf8");
      expect(text).toContain("lib/recent-searches");
      expect(text).toContain("addRecentSearch");
      expect(text).not.toContain("slice(0, 8)");
      expect(text).not.toMatch(/\.filter\(\(q\) => q\.toLowerCase/);
    });
  }
});
