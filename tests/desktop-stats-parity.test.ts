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
});
