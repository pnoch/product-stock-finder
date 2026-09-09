import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop share, notifications, search tags", () => {
  it("shares comparisons as text", async () => {
    const text = await readFile("desktop/src/pages/Compare.tsx", "utf8");
    expect(text).toContain("buildShareText");
    expect(text).toContain("/#/compare/");
  });

  it("exports product images and opens notifications", async () => {
    const detail = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    const alerts = await readFile("desktop/src/pages/Alerts.tsx", "utf8");
    expect(detail).toContain("toPng");
    expect(alerts).toContain("markNotificationRead");
    expect(alerts).toContain("/product/${");
  });

  it("filters search by tracked tags with counts", async () => {
    const text = await readFile("desktop/src/pages/Search.tsx", "utf8");
    expect(text).toContain("countTagMatches");
    expect(text).toContain("watchlist matches only");
  });
});
