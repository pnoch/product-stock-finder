import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop P3b-1 settings", () => {
  it("has a connection section with manual check", async () => {
    const text = await readFile("desktop/src/pages/Settings.tsx", "utf8");
    expect(text).toContain("useConnection");
    expect(text).toContain("ConnectionBadge");
    expect(text).toContain("Check now");
  });

  it("has a sync-now action", async () => {
    const text = await readFile("desktop/src/pages/Settings.tsx", "utf8");
    expect(text).toContain("getSyncSetup");
    expect(text).toContain("Sync now");
  });

  it("has a web test-notification action", async () => {
    const text = await readFile("desktop/src/pages/Settings.tsx", "utf8");
    expect(text).toContain("displayWebNotification");
    expect(text).toContain("Test notification");
  });
});
