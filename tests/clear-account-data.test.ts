import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../lib/trpc", () => ({ createTRPCClient: vi.fn() }));

import { createStorage } from "../lib/storage";

function makeStorage() {
  const m = new Map<string, string>();
  const storage = createStorage({
    getItem: async (k: string) => m.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      m.set(k, v);
    },
    removeItem: async (k: string) => {
      m.delete(k);
    },
    multiRemove: async (keys: string[]) => {
      keys.forEach((k) => m.delete(k));
    },
  });
  return { storage, map: m };
}

describe("clearAccountData vs clearAllData", () => {
  beforeEach(() => vi.clearAllMocks());

  it("clearAccountData preserves device-local preferences", async () => {
    const { storage } = makeStorage();
    await storage.saveSettings({
      theme: "dark",
      displayCurrency: "EUR",
      checkInterval: "hourly",
      notificationsEnabled: true,
      stockAlerts: true,
      priceAlerts: true,
      healthAlerts: true,
    });
    await storage.addToWatchlist({
      id: "p1",
      name: "P1",
      modelNumber: "M1",
      brand: "B",
      category: "C",
      description: "",
      addedAt: "2026-01-01T00:00:00.000Z",
      isWatched: true,
      listings: [],
    });

    await storage.clearAccountData();

    // Account data cleared…
    expect(await storage.getWatchlist()).toEqual([]);
    // …but preferences survive so signing back in doesn't reset the app.
    const settings = await storage.getSettings();
    expect(settings.theme).toBe("dark");
    expect(settings.displayCurrency).toBe("EUR");
  });

  it("drops the BYO-LLM credential while keeping the other preferences", async () => {
    const { storage } = makeStorage();
    await storage.saveSettings({
      theme: "dark",
      displayCurrency: "EUR",
      checkInterval: "manual",
      notificationsEnabled: true,
      stockAlerts: true,
      priceAlerts: true,
      healthAlerts: true,
      llmProvider: "openai",
      llmApiKey: "sk-previous-user",
      llmModel: "gpt-4o",
    });

    await storage.clearAccountData();

    const settings = await storage.getSettings();
    // Device preferences still survive…
    expect(settings.theme).toBe("dark");
    expect(settings.displayCurrency).toBe("EUR");
    // …but a credential must not: the next account could reveal it in Settings
    // and every request they made would carry it, billing the previous user.
    expect(settings.llmApiKey).toBeUndefined();
    expect(settings.llmModel).toBeUndefined();
    expect(settings.llmProvider).toBe("forge");
  });

  it("drops the webhook credential while keeping the other preferences", async () => {
    const { storage } = makeStorage();
    await storage.saveSettings({
      theme: "dark",
      displayCurrency: "EUR",
      checkInterval: "manual",
      notificationsEnabled: true,
      stockAlerts: true,
      priceAlerts: true,
      healthAlerts: true,
      webhookAlerts: true,
      alertWebhookUrl: "https://discord.com/api/webhooks/1/secret",
    });

    await storage.clearAccountData();

    const settings = await storage.getSettings();
    expect(settings.theme).toBe("dark");
    expect(settings.notificationsEnabled).toBe(true);
    // getSettings() merges DEFAULT_SETTINGS, which defines alertWebhookUrl as
    // "" — so a cleared credential reads back as "" (not undefined).
    expect(settings.alertWebhookUrl).toBe("");
    expect(settings.webhookAlerts).toBe(false);
  });

  // QA round 286: `recent_searches` had its own key outside STORAGE_KEYS, so
  // neither wipe removed it — "Clear all data" (and the next user on the
  // device) still saw the previous user's search terms.
  it("both wipes remove recent searches and error breadcrumbs", async () => {
    for (const wipe of ["clearAccountData", "clearAllData"] as const) {
      const { storage, map } = makeStorage();
      map.set("recent_searches", JSON.stringify(["rtx 5090", "crs326"]));
      map.set("last_error", "boom: user bob@example.com");
      map.set("last_route_error", "boom");
      await storage[wipe]();
      for (const key of ["recent_searches", "last_error", "last_route_error"]) {
        expect(map.has(key), `${wipe} should clear ${key}`).toBe(false);
      }
    }
  });

  it("clearAllData wipes preferences too", async () => {
    const { storage } = makeStorage();
    await storage.saveSettings({
      theme: "dark",
      displayCurrency: "EUR",
      checkInterval: "hourly",
      notificationsEnabled: true,
      stockAlerts: true,
      priceAlerts: true,
      healthAlerts: true,
    });
    await storage.clearAllData();
    const settings = await storage.getSettings();
    expect(settings.theme).toBe("auto");
    expect(settings.displayCurrency).toBe("USD");
  });
});

describe("quarantine blobs", () => {
  it("are removed by both wipes", async () => {
    for (const wipe of ["clearAccountData", "clearAllData"] as const) {
      const { storage, map } = makeStorage();
      // Simulate a quarantined corrupt payload + its persisted index.
      map.set("watchlist_products.corrupt-123", "raw user data");
      map.set("quarantine_index", JSON.stringify(["watchlist_products.corrupt-123"]));
      await storage[wipe]();
      // They hold raw user payloads and must not outlive the account.
      expect(map.has("watchlist_products.corrupt-123"), wipe).toBe(false);
      expect(map.has("quarantine_index"), wipe).toBe(false);
    }
  });
});
