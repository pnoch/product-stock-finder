import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop notification settings", () => {
  it("has a health alerts toggle", async () => {
    const text = await readFile("desktop/src/pages/Settings.tsx", "utf8");
    expect(text).toContain("healthAlerts");
    expect(text).toContain("Health Alerts");
  });

  it("has digest-day and quiet-hours pickers", async () => {
    const text = await readFile("desktop/src/pages/Settings.tsx", "utf8");
    expect(text).toContain("digestDayOfWeek");
    expect(text).toContain("Quiet Hours");
  });
});
