import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("webhook alerts settings UI", () => {
  it("exposes URL input, enable toggle and test button on mobile", () => {
    const mobile = readFileSync("components/settings/notifications-section.tsx", "utf8");
    expect(mobile).toContain("Webhook Alerts");
    expect(mobile).toContain('updateSetting("alertWebhookUrl"');
    expect(mobile).toContain('updateSetting("webhookAlerts"');
    expect(mobile).toContain("Send test");
    expect(mobile).toContain("testWebhook");
  });

  it("exposes the same affordances on desktop", () => {
    const desktop = readFileSync(
      "desktop/src/components/settings/notification-settings-section.tsx",
      "utf8",
    );
    const hook = readFileSync(
      "desktop/src/hooks/use-alert-webhook.ts",
      "utf8",
    );
    expect(desktop).toContain("Webhook Alerts");
    expect(hook).toContain("alertWebhookUrl");
    expect(hook).toContain("testWebhook");
    expect(desktop).toContain("Send test");
  });
});
