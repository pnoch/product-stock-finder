import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop list awareness", () => {
  it("shows the offline queued-edits banner", async () => {
    const text = await readFile("desktop/src/pages/Watchlist.tsx", "utf8");
    const banner = await readFile(
      "desktop/src/components/watchlist/OfflineBanner.tsx",
      "utf8",
    );
    expect(text).toContain("countQueuedEdits");
    expect(banner).toContain("sync when back online");
  });

  it("badges buy signals and counts tabs", async () => {
    const watchlist = await readFile(
      "desktop/src/hooks/use-watchlist-view.ts",
      "utf8",
    );
    const row = await readFile(
      "desktop/src/components/watchlist/WatchlistRow.tsx",
      "utf8",
    );
    const alerts = await readFile("desktop/src/pages/Alerts.tsx", "utf8");
    expect(watchlist).toContain("computeProductInsights");
    expect(row).toContain("All-time low");
    expect(alerts).toMatch(/Alerts\{activeAlertCount > 0 \? ` \(\$\{activeAlertCount\}\)`/);
  });
});
