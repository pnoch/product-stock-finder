import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("email alerts settings UI", () => {
  it("exposes an Email Alerts switch bound to emailAlerts (mobile)", () => {
    const mobile = readFileSync(
      "components/settings/notifications-section.tsx",
      "utf8",
    );
    expect(mobile).toContain("Email Alerts");
    expect(mobile).toContain('updateSetting("emailAlerts"');
  });
});
