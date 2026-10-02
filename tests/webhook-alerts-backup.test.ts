import { describe, expect, it } from "vitest";
import { buildBackup, parseBackup, applyBackup } from "../lib/backup";
import { stripDeviceLocalSettings } from "../lib/settings-privacy";
import type { AppSettings } from "../lib/types";

const base: AppSettings = {
  theme: "auto",
  displayCurrency: "USD",
  checkInterval: "manual",
  notificationsEnabled: true,
  stockAlerts: true,
  priceAlerts: true,
  healthAlerts: true,
  webhookAlerts: true,
  alertWebhookUrl: "https://discord.com/api/webhooks/1/secret",
};

describe("webhook URL is a backup secret", () => {
  it("omits the URL from an exported backup", () => {
    const json = buildBackup({
      watchlist: [],
      alerts: [],
      reminders: [],
      stockWatches: [],
      settings: base,
    });
    expect(json).not.toContain("secret");
    expect(parseBackup(json)!.settings?.alertWebhookUrl).toBeUndefined();
  });

  it("never adopts a URL from an imported backup", () => {
    const crafted = JSON.stringify({
      format: "product-stock-finder-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      watchlist: [],
      alerts: [],
      reminders: [],
      stockWatches: [],
      settings: { ...base, alertWebhookUrl: "https://hooks.slack.com/services/from-file" },
    });
    const parsed = parseBackup(crafted)!;
    const result = applyBackup(parsed, {
      watchlist: [],
      alerts: [],
      reminders: [],
      stockWatches: [],
      settings: base,
    });
    expect(result.settings.alertWebhookUrl).toBe(base.alertWebhookUrl);
  });

  it("does not strip the URL from settings sync (server needs it)", () => {
    expect(stripDeviceLocalSettings(base).alertWebhookUrl).toBe(base.alertWebhookUrl);
  });
});
