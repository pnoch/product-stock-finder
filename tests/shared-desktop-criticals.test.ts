import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { DISTRIBUTORS } from "../shared/src/distributors";
import { SAMPLE_LISTINGS } from "../lib/sample-data";

describe("shared/desktop release blockers", () => {
  it("uses live-rate currency on desktop pricing pages", async () => {
    const pages = [
      "desktop/src/pages/Rates.tsx",
      "desktop/src/pages/Home.tsx",
      "desktop/src/pages/Compare.tsx",
      "desktop/src/pages/Settings.tsx",
    ];
    for (const file of pages) {
      const text = await readFile(file, "utf8");
      expect(text).toContain("@/lib/currency");
      expect(text).not.toContain("@shared/currency");
    }
  });

  it("keeps shared modules free of runtime lib imports", async () => {
    const files = [
      "shared/src/catalog.ts",
      "shared/src/currency.ts",
      "shared/src/distributors.ts",
      "shared/src/fx.ts",
      "shared/src/trending.ts",
      "shared/src/compare-utils.ts",
    ];
    for (const file of files) {
      const text = await readFile(file, "utf8");
      const runtimeLibImports = text
        .split("\n")
        .filter(
          (line) =>
            line.includes('from "@/lib/') && !line.trim().startsWith("import type"),
        );
      expect(runtimeLibImports).toEqual([]);
    }
  });

  it("defines every distributor referenced by sample listings", () => {
    const ids = new Set(DISTRIBUTORS.map((distributor) => distributor.id));
    const missing = new Set<string>();
    for (const listings of Object.values(SAMPLE_LISTINGS)) {
      for (const listing of listings) {
        if (!ids.has(listing.distributorId)) missing.add(listing.distributorId);
      }
    }
    expect([...missing]).toEqual([]);
  });
});
