import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../lib/trpc", () => ({ createTRPCClient: vi.fn() }));

import { createStorage } from "../lib/storage";

function makeStorage() {
  const m = new Map<string, string>();
  return createStorage({
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
}

describe("clearAccountData vs clearAllData", () => {
  beforeEach(() => vi.clearAllMocks());

  it("clearAccountData preserves device-local preferences", async () => {
    const storage = makeStorage();
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

  it("clearAllData wipes preferences too", async () => {
    const storage = makeStorage();
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
