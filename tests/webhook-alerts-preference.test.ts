import { describe, expect, it } from "vitest";
import { createStorage } from "../lib/storage";

function emptyStorage() {
  const store = new Map<string, string>();
  return createStorage({
    getItem: async (k) => store.get(k) ?? null,
    setItem: async (k, v) => void store.set(k, v),
    removeItem: async (k) => void store.delete(k),
    multiRemove: async (keys) => keys.forEach((k) => store.delete(k)),
  });
}

describe("webhookAlerts preference default", () => {
  it("defaults to false and an empty URL when unset", async () => {
    const settings = await emptyStorage().getSettings();
    expect(settings.webhookAlerts).toBe(false);
    expect(settings.alertWebhookUrl).toBe("");
  });

  it("round-trips enabled + URL through settings storage", async () => {
    const storage = emptyStorage();
    const base = await storage.getSettings();
    await storage.saveSettings({
      ...base,
      webhookAlerts: true,
      alertWebhookUrl: "https://discord.com/api/webhooks/1/x",
    });
    const settings = await storage.getSettings();
    expect(settings.webhookAlerts).toBe(true);
    expect(settings.alertWebhookUrl).toBe("https://discord.com/api/webhooks/1/x");
  });
});
