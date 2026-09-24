import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop P1 parity", () => {
  it("registers the shared watchlist route", async () => {
    const app = await readFile("desktop/src/App.tsx", "utf8");
    expect(app).toContain("/w/:token");
    expect(app).toContain("SharedWatchlist");
  });

  it("fetches the share and offers bulk add", async () => {
    const page = await readFile("desktop/src/pages/SharedWatchlist.tsx", "utf8");
    expect(page).toContain("sharedWatchlists");
    expect(page).toContain("addToWatchlist");
    expect(page).toContain("Share not found");
  });

  it("gives Alerts reminders an error path with retry", async () => {
    const alerts = await readFile("desktop/src/pages/Alerts.tsx", "utf8");
    expect(alerts).toContain("remindersError");
    expect(alerts).toContain("loadReminders");
  });

  it("sweeps stale device bindings on sign-in", async () => {
    const app = await readFile("desktop/src/App.tsx", "utf8");
    expect(app).toContain("cleanupStaleDevices");
    expect(app).toContain("void cleanupStaleDevices(trpcClient)");
  });
});
