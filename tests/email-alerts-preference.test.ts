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

describe("emailAlerts preference default", () => {
  it("defaults to false when unset", async () => {
    const settings = await emptyStorage().getSettings();
    expect(settings.emailAlerts).toBe(false);
  });

  it("round-trips a true value through settings storage", async () => {
    const storage = emptyStorage();
    await storage.saveSettings({ ...(await storage.getSettings()), emailAlerts: true });
    expect((await storage.getSettings()).emailAlerts).toBe(true);
  });
});
