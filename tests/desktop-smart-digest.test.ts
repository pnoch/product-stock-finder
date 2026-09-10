import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop smart digest best-time-to-buy", () => {
  it("mobile digest card ranks deals", async () => {
    const text = await readFile("components/stats/digest-card.tsx", "utf8");
    expect(text).toContain("Best time to buy");
    expect(text).toContain("rankDeals");
  });

  it("desktop Stats ranks deals", async () => {
    const text = await readFile("desktop/src/pages/Stats.tsx", "utf8");
    expect(text).toContain("Best time to buy");
    expect(text).toContain("rankDeals");
  });
});
