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

  it("badges the sidebar with the same active-item count as mobile", async () => {
    // QA round 281: the sidebar used to count unread notifications (a different
    // sub-tab's data) while mobile's Alerts tab badge counted active alerts +
    // reminders + watches. They now share the mobile semantics.
    const text = await readFile("desktop/src/components/Sidebar.tsx", "utf8");
    expect(text).toContain("countActiveAlerts(alerts)");
    expect(text).toContain("storage.getBackOrderReminders()");
    expect(text).toContain("storage.getStockWatches()");
    expect(text).not.toContain("getNotificationHistory");
  });
});
