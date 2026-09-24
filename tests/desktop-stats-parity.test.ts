import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop stats parity", () => {
  it("has digest, insights, and drop-calendar cards", async () => {
    const text = await readFile("desktop/src/pages/Stats.tsx", "utf8");
    expect(text).toContain("computeDigest");
    expect(text).toContain("computeProductInsights");
    expect(text).toContain("computeDropCalendar");
  });

  it("has a movers window switcher and slice disclosure", async () => {
    const text = await readFile("desktop/src/pages/Stats.tsx", "utf8");
    expect(text).toContain("setDays");
    expect(text).toContain("Top 3 of");
  });

  // QA round 129: the caption says "Top 3 of N by value" but the chart took the
  // first three products in watchlist order, so the caption lied.
  it("ranks the price-history chart's top 3 by value", async () => {
    const text = await readFile("desktop/src/pages/Stats.tsx", "utf8");
    const start = text.indexOf("const chartData = useMemo");
    expect(start).toBeGreaterThan(-1);
    const block = text.slice(start, text.indexOf("}, [products, displayCurrency, days]);", start));
    expect(block).toContain("topByValue");
    expect(block).not.toMatch(/products\.slice\(0, 3\)/);
  });
});
