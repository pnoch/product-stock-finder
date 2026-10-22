import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop share, notifications, search tags", () => {
  it("shares comparisons as text", async () => {
    const text = await readFile(
      "desktop/src/hooks/use-compare-actions.ts",
      "utf8",
    );
    expect(text).toContain("buildShareText");
    expect(text).toContain("/#/compare/");
  });

  it("exports product images and opens notifications", async () => {
    const detail = await readFile(
      "desktop/src/hooks/use-product-sharing.ts",
      "utf8",
    );
    const alerts = await readFile(
      "desktop/src/hooks/use-notifications-data.ts",
      "utf8",
    );
    const notifications = await readFile(
      "desktop/src/components/alerts/NotificationsTab.tsx",
      "utf8",
    );
    const share = await readFile("desktop/src/lib/share.ts", "utf8");
    expect(detail).toContain("saveNodeAsPng");
    expect(detail).toContain("../lib/share");
    expect(share).toContain("toPng");
    expect(alerts).toContain("markNotificationRead");
    expect(notifications).toContain("/product/${");
  });

  it("filters search by tracked tags with counts", async () => {
    const text = await readFile("desktop/src/hooks/use-search-data.ts", "utf8");
    const filters = await readFile(
      "desktop/src/components/search/SearchFilters.tsx",
      "utf8",
    );
    expect(text).toContain("countTagMatches");
    expect(filters).toContain("watchlist matches only");
  });
});
