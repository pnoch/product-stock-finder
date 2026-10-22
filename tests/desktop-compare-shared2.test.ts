import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop compare and shared upgrades", () => {
  it("navigates and refreshes comparisons", async () => {
    const text = await readFile("desktop/src/pages/Compare.tsx", "utf8");
    const header = await readFile(
      "desktop/src/components/compare/CompareHeader.tsx",
      "utf8",
    );
    expect(header).toContain('to="/watchlist"');
    expect(text).toContain("loadCompare()");
  });

  it("exports chart images and sorts by trend", async () => {
    const text = await readFile(
      "desktop/src/hooks/use-compare-actions.ts",
      "utf8",
    );
    const derived = await readFile(
      "desktop/src/hooks/use-compare-derived.ts",
      "utf8",
    );
    const share = await readFile("desktop/src/lib/share.ts", "utf8");
    expect(text).toContain("saveNodeAsPng");
    expect(text).toContain("../lib/share");
    expect(share).toContain("toPng");
    expect(derived).toContain('"trend"');
  });

  it("shows more listings and history export per shared product", async () => {
    const text = await readFile("desktop/src/pages/SharedWatchlist.tsx", "utf8");
    expect(text).toContain("productHistoryToCsv");
    expect(text).toContain(" more");
    expect(text).toContain("History exported");
  });
});
