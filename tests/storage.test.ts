import { describe, expect, it, beforeEach, vi } from "vitest";
import type {
  Product,
  PriceAlert,
  AppSettings,
  BackOrderReminder,
  DistributorListing,
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
  setItemSyncMeta,
  markItemDeleted,
  clearItemSyncMeta,
  clearAllData,
  createStorage,
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
});

describe("settings", () => {
  it("returns defaults when nothing is stored", async () => {
    const s = await getSettings();
    expect(s.theme).toBe("auto");
    expect(s.displayCurrency).toBe("USD");
    expect(s.checkInterval).toBe("manual");
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
    expect(meta.items.watchlist?.p1).toEqual({ updatedAt: 1000, deleted: false });
    expect(meta.lastSyncedAt).toBe(5000);
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
});
