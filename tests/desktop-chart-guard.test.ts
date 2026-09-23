import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop chart guard", () => {
  it("renders price history only through the shared component", async () => {
    for (const f of [
      "desktop/src/components/DistributorHistoryModal.tsx",
      "desktop/src/pages/ProductDetail.tsx",
    ]) {
      const text = await readFile(f, "utf8");
      expect(text).toContain("PriceHistoryChart");
      expect(text).not.toContain("<LineChart");
    }
  });

  // QA round 35: the "lowest ever" badge compared history and current price in
  // hardcoded USD while the rest of the page used the display currency, so a
  // EUR/GBP user's badge was computed across mixed units.
  it("computes the lowest-ever badge in the display currency", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    const start = text.indexOf("const isLowestEver");
    expect(start).toBeGreaterThan(-1);
    const block = text.slice(start, text.indexOf("}, [bestListing", start));
    expect(block).not.toContain('"USD"');
    expect(block).toContain("displayCurrency");
  });

  // QA round 36: the main Set Alert modal's currency was never seeded from the
  // display currency (mobile does), so a EUR/GBP user created alerts in USD.
  it("seeds the main alert currency from the display currency", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(text).toMatch(/setAlertCurrency\(settings\.displayCurrency/);
  });
});
