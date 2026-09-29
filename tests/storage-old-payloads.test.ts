import { describe, expect, it } from "vitest";
import { createStorage, type Storage } from "../lib/storage";

// Simulates an app upgrade: the store holds payloads written by an older build
// that predates several fields. Nothing may throw, and the missing fields must
// take their documented defaults rather than surfacing as `undefined`.
function storageWith(seed: Record<string, string>): Storage {
  const store = new Map(Object.entries(seed));
  return createStorage({
    getItem: async (k: string) => store.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: async (k: string) => {
      store.delete(k);
    },
    multiRemove: async (keys: string[]) => {
      keys.forEach((k) => store.delete(k));
    },
  });
}

describe("older stored payloads (app upgrade)", () => {
  it("reads a pre-tags product without throwing", async () => {
    const storage = storageWith({
      watchlist_products: JSON.stringify([
        {
          id: "p1",
          name: "Old Product",
          modelNumber: "M1",
          brand: "B",
          category: "C",
          description: "",
          addedAt: "2025-01-01T00:00:00.000Z",
          isWatched: true,
          // No `tags`, no `tagsUpdatedAt`, and a listing with no `priceHistory`.
          listings: [{ distributorId: "d1", price: 10, currency: "USD", stockStatus: "in_stock" }],
        },
      ]),
    });
    const list = await storage.getWatchlist();
    expect(list).toHaveLength(1);
    expect(list[0]!.tags).toBeUndefined();
    expect(list[0]!.listings[0]!.priceHistory).toBeUndefined();
  });

  it("reads a pre-snooze alert and treats it as active", async () => {
    const storage = storageWith({
      price_alerts: JSON.stringify([
        {
          id: "a1",
          productId: "p1",
          targetPrice: 100,
          currency: "USD",
          createdAt: "2025-01-01T00:00:00.000Z",
          isActive: true,
          // No `snoozedUntil`, no `triggeredAt`.
        },
      ]),
    });
    const alerts = await storage.getAlerts();
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.snoozedUntil).toBeUndefined();
  });

  it("reads pre-tagDefinitions settings and defaults them to an empty map", async () => {
    const storage = storageWith({
      app_settings: JSON.stringify({
        theme: "dark",
        displayCurrency: "EUR",
        checkInterval: "daily",
        notificationsEnabled: true,
        stockAlerts: true,
        priceAlerts: true,
        healthAlerts: true,
        // No `tagDefinitions`, no `llmProvider`, no digest fields.
      }),
    });
    const settings = await storage.getSettings();
    expect(settings.tagDefinitions).toBeUndefined();
    expect(await storage.getTagDefinitions()).toEqual({});
    // The display currency from the old payload still applies.
    expect(settings.displayCurrency).toBe("EUR");
  });

  it("reads a pre-reminderType reminder", async () => {
    const storage = storageWith({
      back_order_reminders: JSON.stringify([
        {
          id: "r1",
          productId: "p1",
          productName: "P",
          distributorId: "d1",
          distributorName: "D",
          reminderDate: "2026-01-01T00:00:00.000Z",
          createdAt: "2025-01-01T00:00:00.000Z",
          // No `reminderType` (added later).
        },
      ]),
    });
    const reminders = await storage.getBackOrderReminders();
    expect(reminders).toHaveLength(1);
    expect(reminders[0]!.reminderType).toBeUndefined();
  });

  it("quarantines a payload of the wrong type instead of losing it", async () => {
    // An older build may have stored an object where an array is expected.
    const store = new Map<string, string>([
      ["watchlist_products", JSON.stringify({ products: [] })],
    ]);
    const storage = createStorage({
      getItem: async (k: string) => store.get(k) ?? null,
      setItem: async (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: async (k: string) => {
        store.delete(k);
      },
      multiRemove: async (keys: string[]) => {
        keys.forEach((k) => store.delete(k));
      },
    });
    expect(await storage.getWatchlist()).toEqual([]);
    // The original payload survives under a quarantine key (readable directly
    // from the adapter, since the public Storage surface does not expose the
    // quarantine index).
    const quarantined = [...store.keys()].filter((k) =>
      k.startsWith("watchlist_products.corrupt-"),
    );
    expect(quarantined).toHaveLength(1);
    expect(store.get(quarantined[0]!)).toBe(JSON.stringify({ products: [] }));
  });
});

describe("history cap keeps the newest points regardless of stored order", () => {
  it("sorts a descending history before trimming to the cap", async () => {
    // A hand-edited backup or a server pull can store history newest-first;
    // the cap's `slice(-N)`/`shift()` assumed oldest-first and kept the OLDEST.
    const history = Array.from({ length: 600 }, (_, i) => ({
      date: new Date(Date.now() - i * 86_400_000).toISOString(),
      price: 100 + i,
      currency: "USD",
      stockStatus: "in_stock",
    }));
    const storage = storageWith({
      watchlist_products: JSON.stringify([
        {
          id: "p1",
          name: "P",
          modelNumber: "M",
          brand: "B",
          category: "C",
          description: "",
          isWatched: true,
          addedAt: new Date().toISOString(),
          listings: [
            {
              distributorId: "d1",
              productId: "p1",
              price: 100,
              currency: "USD",
              stockStatus: "in_stock",
              url: "",
              lastChecked: new Date().toISOString(),
              priceHistory: history,
            },
          ],
        },
      ]),
    });
    await storage.addToWatchlist({
      id: "p2",
      name: "P2",
      modelNumber: "M2",
      brand: "B",
      category: "C",
      description: "",
      isWatched: true,
      addedAt: new Date().toISOString(),
      listings: [],
    });
    const list = await storage.getWatchlist();
    const kept = list.find((p) => p.id === "p1")!.listings[0]!.priceHistory;
    expect(kept).toHaveLength(500);
    // The newest point (price 100) is kept; the oldest (price 699) is dropped.
    expect(kept.some((p) => p.price === 100)).toBe(true);
    expect(kept.some((p) => p.price === 699)).toBe(false);
  });
});
