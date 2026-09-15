import { describe, expect, it, vi } from "vitest";
import { createStorage } from "../lib/storage";
import { syncNow } from "../lib/sync";
import type { AppSettings, SyncItem } from "../lib/types";

function adapter() {
  const m = new Map<string, string>();
  return {
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
  };
}

function settings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    theme: "auto",
    displayCurrency: "USD",
    checkInterval: "manual",
    notificationsEnabled: true,
    stockAlerts: true,
    priceAlerts: true,
    healthAlerts: true,
    ...overrides,
  };
}

describe("settings per-field merge on pull", () => {
  it("keeps a local-only field edit while taking remote changes", async () => {
    const storage = createStorage(adapter());
    // Last synced state: theme=auto, currency=USD.
    await storage.saveSettings(settings());
    await storage.saveSyncMeta({
      lastSyncedAt: 1000,
      lastSyncOkAt: 1000,
      lastSyncError: null,
      items: {},
      settingsSnapshot: settings(),
    });
    // Local device changes only the theme.
    await storage.saveSettings(settings({ theme: "dark" }));

    // Remote changed only the currency.
    const pull = vi.fn(async () => ({
      lastSyncedAt: 5000,
      items: [
        {
          collection: "settings",
          id: "settings",
          data: settings({ displayCurrency: "EUR" }),
          updatedAt: 4000,
          deletedAt: null,
        },
      ] as SyncItem[],
    }));
    const push = vi.fn(async () => ({ accepted: 0, stamped: [] }));

    await syncNow({ storage, isSignedIn: () => true, pull, push, now: () => 6000 });

    const merged = await storage.getSettings();
    // Remote currency wins (local didn't change it)…
    expect(merged.displayCurrency).toBe("EUR");
    // …but the local theme edit is preserved.
    expect(merged.theme).toBe("dark");
  });
});
