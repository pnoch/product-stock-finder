import { describe, expect, it, beforeEach, vi } from "vitest";
import type {
  Product,
  PriceAlert,
  AppSettings,
  BackOrderReminder,
  DistributorListing,
  NotificationHistoryEntry,
} from "../lib/types";

// In-memory AsyncStorage mock
const store = new Map<string, string>();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (key: string) => store.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: async (key: string) => {
      store.delete(key);
    },
    multiRemove: async (keys: string[]) => {
      keys.forEach((k) => store.delete(k));
    },
  },
}));

import {
  getWatchlist,
  saveWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  updateProductListings,
  refreshWatchlistPrices,
  getAlerts,
  saveAlerts,
  addAlert,
  removeAlert,
  toggleAlert,
  rearmAlert,
  getSettings,
  saveSettings,
  getBackOrderReminders,
  addBackOrderReminder,
  removeBackOrderReminder,
  getStockWatches,
  addStockWatch,
  removeStockWatch,
  updateStockWatchStatus,
  getSyncMeta,
  saveSyncMeta,
  getDisplayedEventIds,
  recordDisplayedEventId,
  getNotificationHistory,
  recordNotificationEvent,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadNotificationCount,
  setItemSyncMeta,
  markItemDeleted,
  clearItemSyncMeta,
  getFxRates,
  saveFxRates,
  clearAllData,
  createStorage,
  DISTRIBUTOR_BREAKER_KEY,
  getTagDefinitions,
  saveTagDefinitions,
  setProductTags,
  createTag,
  renameTag,
  setTagColor,
  deleteTag,
  updateWatchlist,
  updateAlerts,
  updateReminders,
  updateStockWatches,
} from "../lib/storage";

function makeProduct(id: string, listings: DistributorListing[] = []): Product {
  return {
    id,
    name: `Product ${id}`,
    modelNumber: id,
    brand: "Test",
    category: "Switch",
    description: "",
    addedAt: new Date().toISOString(),
    isWatched: true,
    listings,
  };
}

function makeAlert(
  id: string,
  overrides: Partial<PriceAlert> = {},
): PriceAlert {
  return {
    id,
    productId: "p1",
    targetPrice: 100,
    currency: "USD",
    isActive: true,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeReminder(
  id: string,
  overrides: Partial<BackOrderReminder> = {},
): BackOrderReminder {
  return {
    id,
    productId: "p1",
    productName: "Product p1",
    distributorId: "d1",
    distributorName: "Distributor",
    reminderDate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeHistoryEntry(
  id: string,
  overrides: Partial<NotificationHistoryEntry> = {},
): NotificationHistoryEntry {
  return {
    id,
    type: "price_drop",
    title: "Price dropped",
    body: "CRS804 below $500",
    productId: "p1",
    createdAt: 1000,
    read: false,
    ...overrides,
  };
}

beforeEach(() => {
  store.clear();
});

describe("watchlist", () => {
  it("returns an empty array when nothing is stored", async () => {
    expect(await getWatchlist()).toEqual([]);
  });

  it("round-trips a saved watchlist", async () => {
    await saveWatchlist([makeProduct("p1"), makeProduct("p2")]);
    const list = await getWatchlist();
    expect(list).toHaveLength(2);
    expect(list[0]!.id).toBe("p1");
  });

  it("addToWatchlist prepends and stamps isWatched/addedAt", async () => {
    await addToWatchlist(makeProduct("p1"));
    const list = await getWatchlist();
    expect(list).toHaveLength(1);
    expect(list[0]!.isWatched).toBe(true);
    expect(list[0]!.addedAt).toBeTruthy();
  });

  it("addToWatchlist does not duplicate an existing product", async () => {
    await addToWatchlist(makeProduct("p1"));
    await addToWatchlist(makeProduct("p1"));
    expect(await getWatchlist()).toHaveLength(1);
  });

  it("removeFromWatchlist removes only the matching product", async () => {
    await saveWatchlist([makeProduct("p1"), makeProduct("p2")]);
    await removeFromWatchlist("p1");
    const list = await getWatchlist();
    expect(list).toHaveLength(1);
    expect(list[0]!.id).toBe("p2");
  });

  it("updateProductListings replaces listings for the matching product only", async () => {
    await saveWatchlist([makeProduct("p1"), makeProduct("p2")]);
    const newListing = {
      distributorId: "d1",
      productId: "p1",
      price: 10,
      currency: "USD",
      stockStatus: "in_stock",
      url: "",
      lastChecked: new Date().toISOString(),
      priceHistory: [],
    } as DistributorListing;
    await updateProductListings("p1", [newListing]);
    const list = await getWatchlist();
    expect(list[0]!.listings).toHaveLength(1);
    expect(list[1]!.listings).toHaveLength(0);
  });

  it("refreshWatchlistPrices stamps lastRefreshed on every product", async () => {
    await saveWatchlist([makeProduct("p1"), makeProduct("p2")]);
    await refreshWatchlistPrices();
    const list = await getWatchlist();
    expect(list[0]!.lastRefreshed).toBeTruthy();
    expect(list[1]!.lastRefreshed).toBeTruthy();
  });
});

describe("alerts", () => {
  it("addAlert prepends and saveAlerts persists", async () => {
    await addAlert(makeAlert("a1"));
    await addAlert(makeAlert("a2"));
    const alerts = await getAlerts();
    expect(alerts).toHaveLength(2);
    expect(alerts[0]!.id).toBe("a2");
  });

  it("removeAlert removes only the matching alert", async () => {
    await saveAlerts([makeAlert("a1"), makeAlert("a2")]);
    await removeAlert("a1");
    expect((await getAlerts()).map((a) => a.id)).toEqual(["a2"]);
  });

  it("toggleAlert flips isActive", async () => {
    await saveAlerts([makeAlert("a1")]);
    await toggleAlert("a1");
    expect((await getAlerts())[0]!.isActive).toBe(false);
    await toggleAlert("a1");
    expect((await getAlerts())[0]!.isActive).toBe(true);
  });

  it("rearmAlert reactivates and clears triggered state", async () => {
    await saveAlerts([
      makeAlert("a1", {
        isActive: false,
        triggeredAt: "2026-01-01",
        triggeredPrice: 90,
      }),
    ]);
    await rearmAlert("a1");
    const alert = (await getAlerts())[0]!;
    expect(alert.isActive).toBe(true);
    expect(alert.triggeredAt).toBeUndefined();
    expect(alert.triggeredPrice).toBeUndefined();
  });

  it("serializes concurrent saveAlerts in call order", async () => {
    const { createStorage } = await import("../lib/storage");
    const store = new Map<string, string>();
    let writes = 0;
    const storage = createStorage({
      getItem: async (key: string) => store.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        writes += 1;
        await new Promise((resolve) => setTimeout(resolve, writes === 1 ? 20 : 0));
        store.set(key, value);
      },
      removeItem: async (key: string) => {
        store.delete(key);
      },
      multiRemove: async (keys: string[]) => {
        keys.forEach((key) => store.delete(key));
      },
    });
    const first = storage.saveAlerts([makeAlert("a1")]);
    const second = storage.saveAlerts([makeAlert("a2")]);
    await Promise.all([first, second]);
    const saved = JSON.parse(store.get("price_alerts") ?? "[]");
    expect(saved.map((a: { id: string }) => a.id)).toEqual(["a2"]);
  });
});

describe("settings", () => {
  it("returns defaults when nothing is stored", async () => {
    const s = await getSettings();
    expect(s.theme).toBe("auto");
    expect(s.displayCurrency).toBe("USD");
    expect(s.checkInterval).toBe("manual");
    expect(s.webNotificationsEnabled).toBe(false);
  });

  it("merges stored settings over defaults", async () => {
    await saveSettings({
      theme: "dark",
      displayCurrency: "EUR",
      checkInterval: "hourly",
      notificationsEnabled: false,
      stockAlerts: true,
      priceAlerts: true,
    } as AppSettings);
    const s = await getSettings();
    expect(s.theme).toBe("dark");
    expect(s.displayCurrency).toBe("EUR");
    expect(s.checkInterval).toBe("hourly");
  });

  it("serializes concurrent saveSettings in call order", async () => {
    const { createStorage } = await import("../lib/storage");
    const store = new Map<string, string>();
    let writes = 0;
    const storage = createStorage({
      getItem: async (key: string) => store.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        writes += 1;
        await new Promise((resolve) => setTimeout(resolve, writes === 1 ? 20 : 0));
        store.set(key, value);
      },
      removeItem: async (key: string) => {
        store.delete(key);
      },
      multiRemove: async (keys: string[]) => {
        keys.forEach((key) => store.delete(key));
      },
    });
    const base = await storage.getSettings();
    const first = storage.saveSettings({ ...base, theme: "dark" });
    const second = storage.saveSettings({ ...base, theme: "light" });
    await Promise.all([first, second]);
    const saved = JSON.parse(store.get("app_settings") ?? "{}");
    expect(saved.theme).toBe("light");
  });
});

describe("reminders & stock watches", () => {
  it("addBackOrderReminder updates an existing product+distributor instead of duplicating", async () => {
    await addBackOrderReminder(
      makeReminder("r1", { reminderDate: "2026-01-01" }),
    );
    await addBackOrderReminder(
      makeReminder("r1", { reminderDate: "2026-02-01" }),
    );
    const reminders = await getBackOrderReminders();
    expect(reminders).toHaveLength(1);
    expect(reminders[0]!.reminderDate).toBe("2026-02-01");
  });

  it("removeBackOrderReminder removes by id", async () => {
    await addBackOrderReminder(makeReminder("r1"));
    await addBackOrderReminder(makeReminder("r2"));
    await removeBackOrderReminder("r1");
    expect((await getBackOrderReminders()).map((r) => r.id)).toEqual(["r2"]);
  });

  it("serializes concurrent saveBackOrderReminders in call order", async () => {
    const { createStorage } = await import("../lib/storage");
    const store = new Map<string, string>();
    let writes = 0;
    const storage = createStorage({
      getItem: async (key: string) => store.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        writes += 1;
        await new Promise((resolve) => setTimeout(resolve, writes === 1 ? 20 : 0));
        store.set(key, value);
      },
      removeItem: async (key: string) => {
        store.delete(key);
      },
      multiRemove: async (keys: string[]) => {
        keys.forEach((key) => store.delete(key));
      },
    });
    const first = storage.saveBackOrderReminders([makeReminder("r1")]);
    const second = storage.saveBackOrderReminders([makeReminder("r2")]);
    await Promise.all([first, second]);
    const saved = JSON.parse(store.get("back_order_reminders") ?? "[]");
    expect(saved.map((r: { id: string }) => r.id)).toEqual(["r2"]);
  });

  it("serializes concurrent saveStockWatches in call order", async () => {
    const { createStorage } = await import("../lib/storage");
    const store = new Map<string, string>();
    let writes = 0;
    const storage = createStorage({
      getItem: async (key: string) => store.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        writes += 1;
        await new Promise((resolve) => setTimeout(resolve, writes === 1 ? 20 : 0));
        store.set(key, value);
      },
      removeItem: async (key: string) => {
        store.delete(key);
      },
      multiRemove: async (keys: string[]) => {
        keys.forEach((key) => store.delete(key));
      },
    });
    const first = storage.saveStockWatches([makeReminder("w1")]);
    const second = storage.saveStockWatches([makeReminder("w2")]);
    await Promise.all([first, second]);
    const saved = JSON.parse(store.get("back_in_stock_watches") ?? "[]");
    expect(saved.map((r: { id: string }) => r.id)).toEqual(["w2"]);
  });

  it("addStockWatch dedupes by product+distributor", async () => {
    await addStockWatch(
      makeReminder("w1", { productId: "p1", distributorId: "d1" }),
    );
    await addStockWatch(
      makeReminder("w2", { productId: "p1", distributorId: "d1" }),
    );
    expect(await getStockWatches()).toHaveLength(1);
  });

  it("updateStockWatchStatus updates lastKnownStatus for the matching watch", async () => {
    await addStockWatch(
      makeReminder("w1", {
        productId: "p1",
        distributorId: "d1",
        lastKnownStatus: "back_order",
      }),
    );
    await updateStockWatchStatus("p1", "d1", "in_stock");
    expect((await getStockWatches())[0]!.lastKnownStatus).toBe("in_stock");
  });

  it("removeStockWatch removes by id", async () => {
    await addStockWatch(makeReminder("w1"));
    await removeStockWatch("w1");
    expect(await getStockWatches()).toHaveLength(0);
  });
});

describe("sync meta", () => {
  it("returns empty meta by default", async () => {
    const meta = await getSyncMeta();
    expect(meta.lastSyncedAt).toBe(0);
    expect(meta.items).toEqual({});
  });

  it("setItemSyncMeta records an item and saveSyncMeta persists lastSyncedAt", async () => {
    await setItemSyncMeta("watchlist", "p1", 1000);
    await saveSyncMeta({ lastSyncedAt: 5000, items: {} });
    const meta = await getSyncMeta();
    expect(meta.items.watchlist?.p1).toEqual({
      updatedAt: 1000,
      deleted: false,
    });
    expect(meta.lastSyncedAt).toBe(5000);
  });

  it("round-trips lastSyncOkAt and lastSyncError through saveSyncMeta", async () => {
    await saveSyncMeta({
      lastSyncedAt: 5000,
      items: {},
      lastSyncError: "Push failed: network",
      lastSyncOkAt: 4000,
    });
    const meta = await getSyncMeta();
    expect(meta.lastSyncError).toBe("Push failed: network");
    expect(meta.lastSyncOkAt).toBe(4000);
  });

  it("markItemDeleted flags an item as deleted", async () => {
    await markItemDeleted("alerts", "a1", 2000);
    const meta = await getSyncMeta();
    expect(meta.items.alerts?.a1).toEqual({ updatedAt: 2000, deleted: true });
  });

  it("clearItemSyncMeta removes an item entry", async () => {
    await setItemSyncMeta("watchlist", "p1", 1000);
    await clearItemSyncMeta("watchlist", "p1");
    const meta = await getSyncMeta();
    expect(meta.items.watchlist?.p1).toBeUndefined();
  });
});

describe("onChange callback", () => {
  it("fires after addToWatchlist and removeFromWatchlist", async () => {
    const calls: Array<[string, string]> = [];
    const localStore = new Map<string, string>();
    const storage = createStorage(
      {
        getItem: async (k) => localStore.get(k) ?? null,
        setItem: async (k, v) => {
          localStore.set(k, v);
        },
        removeItem: async (k) => {
          localStore.delete(k);
        },
        multiRemove: async (keys) => {
          keys.forEach((k) => localStore.delete(k));
        },
      },
      { onChange: (collection, itemId) => calls.push([collection, itemId]) },
    );
    await storage.addToWatchlist(makeProduct("p1"));
    await storage.removeFromWatchlist("p1");
    expect(calls).toEqual([
      ["watchlist", "p1"],
      ["watchlist", "p1"],
    ]);
  });

  it("does not fire onChange for raw saveWatchlist", async () => {
    const calls: Array<[string, string]> = [];
    const localStore = new Map<string, string>();
    const storage = createStorage(
      {
        getItem: async (k) => localStore.get(k) ?? null,
        setItem: async (k, v) => {
          localStore.set(k, v);
        },
        removeItem: async (k) => {
          localStore.delete(k);
        },
        multiRemove: async (keys) => {
          keys.forEach((k) => localStore.delete(k));
        },
      },
      { onChange: (collection, itemId) => calls.push([collection, itemId]) },
    );
    await storage.saveWatchlist([makeProduct("p1")]);
    expect(calls).toEqual([]);
  });
});

describe("clearAllData", () => {
  it("clears all app keys", async () => {
    await saveWatchlist([makeProduct("p1")]);
    await saveAlerts([makeAlert("a1")]);
    await clearAllData();
    expect(await getWatchlist()).toEqual([]);
    expect(await getAlerts()).toEqual([]);
  });

  it("clearAllData removes the distributor breaker state", async () => {
    store.set(DISTRIBUTOR_BREAKER_KEY, JSON.stringify([{ distributorId: "d1" }]));
    await clearAllData();
    expect(store.has(DISTRIBUTOR_BREAKER_KEY)).toBe(false);
  });

  it("clearAllData drains in-flight queued writes instead of resurrecting them", async () => {
    const { createStorage } = await import("../lib/storage");
    const store = new Map<string, string>();
    let writes = 0;
    const storage = createStorage({
      getItem: async (key: string) => store.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        writes += 1;
        await new Promise((resolve) => setTimeout(resolve, writes === 1 ? 20 : 0));
        store.set(key, value);
      },
      removeItem: async (key: string) => {
        store.delete(key);
      },
      multiRemove: async (keys: string[]) => {
        keys.forEach((key) => store.delete(key));
      },
    });
    const save = storage.saveWatchlist([makeProduct("p1")]);
    const clear = storage.clearAllData();
    await Promise.all([save, clear]);
    expect(await storage.getWatchlist()).toEqual([]);
  });
});

describe("displayed event ids", () => {
  it("returns an empty list by default", async () => {
    expect(await getDisplayedEventIds()).toEqual([]);
  });

  it("records ids and dedupes repeats", async () => {
    await recordDisplayedEventId("e1");
    await recordDisplayedEventId("e1");
    await recordDisplayedEventId("e2");
    expect(await getDisplayedEventIds()).toEqual(["e1", "e2"]);
  });

  it("keeps only the most recent 200 ids", async () => {
    for (let i = 0; i < 250; i++) {
      await recordDisplayedEventId(`e${i}`);
    }
    const ids = await getDisplayedEventIds();
    expect(ids).toHaveLength(200);
    expect(ids[0]).toBe("e50");
    expect(ids[199]).toBe("e249");
  });
});

describe("notification history", () => {
  it("returns an empty array and zero unread when nothing is stored", async () => {
    expect(await getNotificationHistory()).toEqual([]);
    expect(await getUnreadNotificationCount()).toBe(0);
  });

  it("recordNotificationEvent prepends new entries newest-first as unread", async () => {
    await recordNotificationEvent(makeHistoryEntry("e1"));
    await recordNotificationEvent(makeHistoryEntry("e2"));
    const list = await getNotificationHistory();
    expect(list.map((e) => e.id)).toEqual(["e2", "e1"]);
    expect(list[0]!.read).toBe(false);
  });

  it("recordNotificationEvent does not duplicate an existing id and preserves read state", async () => {
    await recordNotificationEvent(makeHistoryEntry("e1"));
    await markNotificationRead("e1");
    await recordNotificationEvent(makeHistoryEntry("e1"));
    const list = await getNotificationHistory();
    expect(list).toHaveLength(1);
    expect(list[0]!.read).toBe(true);
  });

  it("recordNotificationEvent caps the list at 200 entries keeping the newest", async () => {
    for (let i = 0; i < 205; i++) {
      await recordNotificationEvent(makeHistoryEntry(`e${i}`));
    }
    const list = await getNotificationHistory();
    expect(list).toHaveLength(200);
    expect(list[0]!.id).toBe("e204");
  });

  it("markNotificationRead marks only the matching entry", async () => {
    await recordNotificationEvent(makeHistoryEntry("e1"));
    await recordNotificationEvent(makeHistoryEntry("e2"));
    await markNotificationRead("e1");
    const list = await getNotificationHistory();
    expect(list.find((e) => e.id === "e1")!.read).toBe(true);
    expect(list.find((e) => e.id === "e2")!.read).toBe(false);
    expect(await getUnreadNotificationCount()).toBe(1);
  });

  it("markAllNotificationsRead marks every entry read", async () => {
    await recordNotificationEvent(makeHistoryEntry("e1"));
    await recordNotificationEvent(makeHistoryEntry("e2"));
    await markAllNotificationsRead();
    expect(await getUnreadNotificationCount()).toBe(0);
  });

  it("clearAllData removes notification history", async () => {
    await recordNotificationEvent(makeHistoryEntry("e1"));
    await clearAllData();
    expect(await getNotificationHistory()).toEqual([]);
  });
});

describe("fx rates", () => {
  it("returns null when nothing is stored", async () => {
    expect(await getFxRates()).toBeNull();
  });

  it("round-trips a rates payload", async () => {
    await saveFxRates({ rates: { EUR: 0.9, GBP: 0.78 }, fetchedAt: 123456 });
    expect(await getFxRates()).toEqual({
      rates: { EUR: 0.9, GBP: 0.78 },
      fetchedAt: 123456,
    });
  });

  it("returns null for a corrupt payload", async () => {
    store.set("fx_rates", "{not valid json");
    expect(await getFxRates()).toBeNull();
  });

  it("returns null for a payload without a rates object", async () => {
    store.set("fx_rates", JSON.stringify({ fetchedAt: 5 }));
    expect(await getFxRates()).toBeNull();
  });

  it("drops non-numeric rate values from a tampered payload", async () => {
    store.set(
      "fx_rates",
      JSON.stringify({
        rates: { EUR: 0.9, GBP: "oops", THB: 34.5 },
        fetchedAt: 5,
      }),
    );
    expect(await getFxRates()).toEqual({
      rates: { EUR: 0.9, THB: 34.5 },
      fetchedAt: 5,
    });
  });

  it("returns null when a payload has no valid rate values", async () => {
    store.set(
      "fx_rates",
      JSON.stringify({ rates: { EUR: "oops", GBP: "x" }, fetchedAt: 5 }),
    );
    expect(await getFxRates()).toBeNull();
  });
});

describe("watchlist tags", () => {
  it("returns empty tag definitions by default", async () => {
    expect(await getTagDefinitions()).toEqual({});
  });

  it("creates a tag and persists it", async () => {
    const tag = await createTag("Backhaul", "#00C896");
    expect(tag.id).toBeTruthy();
    expect(tag.name).toBe("Backhaul");
    expect((await getTagDefinitions())[tag.id]).toEqual(tag);
  });

  it("rejects duplicate tag names case-insensitively", async () => {
    await createTag("Backhaul", "#00C896");
    await expect(createTag("backhaul", "#EF4444")).rejects.toThrow();
  });

  it("renames a tag", async () => {
    const tag = await createTag("Backhaul", "#00C896");
    await renameTag(tag.id, "Core");
    expect((await getTagDefinitions())[tag.id].name).toBe("Core");
  });

  it("rejects renaming to an existing name", async () => {
    const a = await createTag("A", "#00C896");
    await createTag("B", "#EF4444");
    await expect(renameTag(a.id, "b")).rejects.toThrow();
  });

  it("changes a tag color", async () => {
    const tag = await createTag("A", "#00C896");
    await setTagColor(tag.id, "#EF4444");
    expect((await getTagDefinitions())[tag.id].color).toBe("#EF4444");
  });

  it("deletes a tag and strips it from products", async () => {
    const tag = await createTag("A", "#00C896");
    await addToWatchlist(makeProduct("p1", []));
    await setProductTags("p1", [tag.id]);
    await deleteTag(tag.id);
    expect(await getTagDefinitions()).toEqual({});
    expect((await getWatchlist())[0].tags ?? []).toEqual([]);
  });

  it("saveTagDefinitions does not clobber other settings", async () => {
    await saveSettings({ ...(await getSettings()), displayCurrency: "EUR" });
    await saveTagDefinitions({ a: { id: "a", name: "A", color: "#00C896" } });
    expect((await getSettings()).displayCurrency).toBe("EUR");
  });

  it("setProductTags updates a product's tags", async () => {
    await addToWatchlist(makeProduct("p1", []));
    await setProductTags("p1", ["a", "b"]);
    expect((await getWatchlist())[0].tags).toEqual(["a", "b"]);
    await setProductTags("p1", []);
    expect((await getWatchlist())[0].tags ?? []).toEqual([]);
  });
});

describe("enqueued read-modify-write helpers", () => {
  beforeEach(async () => {
    await clearAllData();
  });

  it("updateWatchlist serializes with concurrent watchlist mutations", async () => {
    await addToWatchlist(makeProduct("p1"));

    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));

    const transform = updateWatchlist(async (list) => {
      await gate;
      return list.map((p) => (p.id === "p1" ? { ...p, name: "synced" } : p));
    });
    const addition = addToWatchlist(makeProduct("p2"));

    release();
    await Promise.all([transform, addition]);

    const list = await getWatchlist();
    expect(list.map((p) => p.id).sort()).toEqual(["p1", "p2"]);
    expect(list.find((p) => p.id === "p1")?.name).toBe("synced");
  });

  it("updateAlerts applies its transform to the latest stored alerts", async () => {
    await addAlert(makeAlert("a1"));
    await updateAlerts(async (alerts) => [
      ...alerts,
      makeAlert("a2", { isActive: false }),
    ]);
    const alerts = await getAlerts();
    expect(alerts.map((a) => a.id).sort()).toEqual(["a1", "a2"]);
  });

  it("updateReminders and updateStockWatches apply atomically", async () => {
    await addBackOrderReminder(
      makeReminder("r1", { reminderType: "date" }),
    );
    await updateReminders(async (reminders) =>
      reminders.map((r) =>
        r.id === "r1" ? { ...r, reminderDate: "2026-09-01" } : r,
      ),
    );
    const reminders = await getBackOrderReminders();
    expect(reminders).toHaveLength(1);
    expect(reminders[0]!.reminderDate).toBe("2026-09-01");

    await addStockWatch(
      makeReminder("w1", { reminderType: "back_in_stock" }),
    );
    await updateStockWatches(async (watches) =>
      watches.filter((w) => w.id !== "w1"),
    );
    expect(await getStockWatches()).toHaveLength(0);
  });
});
