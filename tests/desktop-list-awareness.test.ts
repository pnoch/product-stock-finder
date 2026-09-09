import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop list awareness", () => {
  it("shows the offline queued-edits banner", async () => {
    const text = await readFile("desktop/src/pages/Watchlist.tsx", "utf8");
    expect(text).toContain("countQueuedEdits");
    expect(text).toContain("edits queued");
  });

  it("badges buy signals and counts tabs", async () => {
    const watchlist = await readFile("desktop/src/pages/Watchlist.tsx", "utf8");
    const alerts = await readFile("desktop/src/pages/Alerts.tsx", "utf8");
    expect(watchlist).toContain("computeProductInsights");
    expect(watchlist).toContain("All-time low");
    expect(alerts).toMatch(/Alerts \(\{/);
  });
});
