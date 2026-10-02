import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop notification history", () => {
  it("records Rust trigger events", async () => {
    const bg = await readFile("desktop/src/background.ts", "utf8");
    const app = await readFile("desktop/src/App.tsx", "utf8");
    expect(bg).toContain("price-drops-triggered");
    expect(bg).toContain("onPriceDropsTriggered");
    expect(app).toContain("price-drops-triggered");
  });

  it("badges the sidebar with the same count as the mobile Alerts tab badge", async () => {
    // The badge matches the cards the Alerts page renders (countOpenAlerts:
    // armed + snoozed + paused), not the stricter Home "Active Alerts" stat.
    const text = await readFile("desktop/src/components/Sidebar.tsx", "utf8");
    expect(text).toContain("countOpenAlerts(alerts)");
    expect(text).toContain("storage.getBackOrderReminders()");
    expect(text).toContain("storage.getStockWatches()");
    expect(text).not.toContain("getNotificationHistory");
  });
});
