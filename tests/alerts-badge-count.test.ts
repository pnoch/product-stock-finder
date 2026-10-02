import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

// The Alerts-tab badge (mobile bottom tab + desktop sidebar) must count the
// same items the Alerts screen lists as cards — `countOpenAlerts` (armed +
// snoozed + paused), not the stricter armed `countActiveAlerts` used by the
// Home "Active Alerts" stat. The two counters drifted, so a snoozed or paused
// alert rendered as a card but was missing from the badge.
describe("Alerts badge matches the cards shown", () => {
  for (const file of [
    "hooks/use-alert-badge.ts",
    "desktop/src/components/Sidebar.tsx",
  ]) {
    it(`${file} counts open alerts`, async () => {
      const src = await readFile(file, "utf8");
      expect(src).toContain("countOpenAlerts");
      // Match the call, not the word: the explanatory comment names the
      // stricter predicate on purpose.
      expect(src).not.toContain("countActiveAlerts(");
    });
  }
});
