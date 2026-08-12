import { describe, expect, it, vi } from "vitest";
import { createStorage, type Storage } from "../lib/storage";
import { syncNow } from "../lib/sync";
import type {
  AppSettings,
  BackOrderReminder,
  DistributorListing,
  PriceAlert,
  Product,
  StockStatus,
  SyncItem,
} from "../lib/types";

function makeAdapter() {
  const store = new Map<string, string>();
  return {
    adapter: {
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
    },
    store,
  };
}

function makeStorage(): Storage {
  return createStorage(makeAdapter().adapter);
}

function listing(
  distributorId: string,
  price: number,
  stockStatus: StockStatus,
): DistributorListing {
  return {
    distributorId,
    productId: "p1",
    price,
    currency: "USD",
    stockStatus,
    url: "",
    lastChecked: "2026-08-11T00:00:00.000Z",
    priceHistory: [],
  };
}

function makeProduct(id: string, listings: DistributorListing[] = []): Product {
  return {
    id,
    name: `Product ${id}`,
    modelNumber: id,
    brand: "Test",
    category: "Switch",
    description: "",
    addedAt: "2026-08-01T00:00:00.000Z",
    isWatched: true,
    listings,
  };
}

function makeAlert(id: string, overrides: Partial<PriceAlert> = {}): PriceAlert {
  return {
    id,
    productId: "p1",
    targetPrice: 100,
    currency: "USD",
    isActive: true,
    createdAt: "2026-08-01T00:00:00.000Z",
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
    reminderDate: "2026-09-01T00:00:00.000Z",
    createdAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: "auto",
  displayCurrency: "USD",
  checkInterval: "manual",
  notificationsEnabled: true,
  stockAlerts: true,
  priceAlerts: true,
};

describe("syncNow", () => {
  it("no-ops when signed out", async () => {
    const storage = makeStorage();
    const pull = vi.fn();
    const push = vi.fn();
    await syncNow({
      storage,
      isSignedIn: () => false,
      pull,
      push,
      now: () => 1000,
    });
    expect(pull).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("pulls and merges server items on first sync without re-pushing them", async () => {
    const storage = makeStorage();
    const serverProduct = makeProduct("p1", [listing("d1", 100, "in_stock")]);
    const pull = vi.fn(async (): Promise<{ lastSyncedAt: number; items: SyncItem[] }> => ({
      lastSyncedAt: 2000,
      items: [
        {
          collection: "watchlist",
          id: "p1",
          data: serverProduct,
          updatedAt: 1500,
          deletedAt: null,
        },
      ],
    }));
    const push = vi.fn(async (_items: SyncItem[]) => ({ accepted: 0 }));
    await syncNow({
      storage,
      isSignedIn: () => true,
      pull,
      push,
      now: () => 3000,
    });
    const list = await storage.getWatchlist();
    expect(list).toHaveLength(1);
    expect(list[0]!.id).toBe("p1");
    expect(pull).toHaveBeenCalledWith(null);
    expect(push).not.toHaveBeenCalled();
  });

  it("server wins per item when newer", async () => {
    const storage = makeStorage();
    await storage.addToWatchlist(makeProduct("p1", [listing("d1", 100, "in_stock")]));
    await storage.setItemSyncMeta("watchlist", "p1", 1000);
    const serverProduct = makeProduct("p1", [listing("d1", 90, "in_stock")]);
    const pull = vi.fn(async (): Promise<{ lastSyncedAt: number; items: SyncItem[] }> => ({
      lastSyncedAt: 5000,
      items: [
        {
          collection: "watchlist",
          id: "p1",
          data: serverProduct,
          updatedAt: 4000,
          deletedAt: null,
        },
      ],
    }));
    const push = vi.fn(async (_items: SyncItem[]) => ({ accepted: 0 }));
    await syncNow({
      storage,
      isSignedIn: () => true,
      pull,
      push,
      now: () => 6000,
    });
    expect((await storage.getWatchlist())[0]!.listings[0]!.price).toBe(90);
    expect(push).not.toHaveBeenCalled();
  });

  it("keeps local when local is newer and pushes it", async () => {
    const storage = makeStorage();
    await storage.addToWatchlist(makeProduct("p1", [listing("d1", 100, "in_stock")]));
    await storage.setItemSyncMeta("watchlist", "p1", 5000);
    const serverProduct = makeProduct("p1", [listing("d1", 90, "in_stock")]);
    const pull = vi.fn(async (): Promise<{ lastSyncedAt: number; items: SyncItem[] }> => ({
      lastSyncedAt: 6000,
      items: [
        {
          collection: "watchlist",
          id: "p1",
          data: serverProduct,
          updatedAt: 4000,
          deletedAt: null,
        },
      ],
    }));
    const push = vi.fn(async (_items: SyncItem[]) => ({ accepted: 1 }));
    await syncNow({
      storage,
      isSignedIn: () => true,
      pull,
      push,
      now: () => 7000,
    });
    expect((await storage.getWatchlist())[0]!.listings[0]!.price).toBe(100);
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("removes local item on server tombstone", async () => {
    const storage = makeStorage();
    await storage.addToWatchlist(makeProduct("p1"));
    await storage.setItemSyncMeta("watchlist", "p1", 1000);
    const pull = vi.fn(async (): Promise<{ lastSyncedAt: number; items: SyncItem[] }> => ({
      lastSyncedAt: 5000,
      items: [
        {
          collection: "watchlist",
          id: "p1",
          data: null,
          updatedAt: 4000,
          deletedAt: 4000,
        },
      ],
    }));
    const push = vi.fn(async (_items: SyncItem[]) => ({ accepted: 0 }));
    await syncNow({
      storage,
      isSignedIn: () => true,
      pull,
      push,
      now: () => 6000,
    });
    expect(await storage.getWatchlist()).toEqual([]);
  });

  it("preserves local priceHistory while replacing listing state", async () => {
    const storage = makeStorage();
    const localListing = listing("d1", 100, "in_stock");
    localListing.priceHistory = [
      { date: "2026-01-01", price: 100, currency: "USD", stockStatus: "in_stock" },
    ];
    await storage.addToWatchlist(makeProduct("p1", [localListing]));
    await storage.setItemSyncMeta("watchlist", "p1", 1000);
    const serverProduct = makeProduct("p1", [listing("d1", 90, "in_stock")]);
    const pull = vi.fn(async (): Promise<{ lastSyncedAt: number; items: SyncItem[] }> => ({
      lastSyncedAt: 5000,
      items: [
        {
          collection: "watchlist",
          id: "p1",
          data: serverProduct,
          updatedAt: 4000,
          deletedAt: null,
        },
      ],
    }));
    const push = vi.fn(async (_items: SyncItem[]) => ({ accepted: 0 }));
    await syncNow({
      storage,
      isSignedIn: () => true,
      pull,
      push,
      now: () => 6000,
    });
    const product = (await storage.getWatchlist())[0]!;
    expect(product.listings[0]!.price).toBe(90);
    expect(product.listings[0]!.priceHistory).toHaveLength(1);
  });

  it("pushes dirty local items with stripped priceHistory and advances lastSyncedAt", async () => {
    const storage = makeStorage();
    const localListing = listing("d1", 100, "in_stock");
    localListing.priceHistory = [
      { date: "2026-01-01", price: 100, currency: "USD", stockStatus: "in_stock" },
    ];
    await storage.addToWatchlist(makeProduct("p1", [localListing]));
    const pull = vi.fn(async () => ({ lastSyncedAt: 2000, items: [] }));
    const push = vi.fn(async (_items: SyncItem[]) => ({ accepted: 1 }));
    await syncNow({
      storage,
      isSignedIn: () => true,
      pull,
      push,
      now: () => 3000,
    });
    expect(push).toHaveBeenCalledTimes(1);
    const pushed = push.mock.calls[0]![0];
    expect(pushed).toHaveLength(1);
    expect(pushed[0]!.collection).toBe("watchlist");
    expect(pushed[0]!.id).toBe("p1");
    expect(pushed[0]!.updatedAt).toBe(3000);
    expect((pushed[0]!.data as Product).listings[0]!.priceHistory).toBeUndefined();
    const meta = await storage.getSyncMeta();
    expect(meta.lastSyncedAt).toBe(3000);
  });

  it("keeps lastSyncedAt unchanged when push fails", async () => {
    const storage = makeStorage();
    await storage.addToWatchlist(makeProduct("p1"));
    const pull = vi.fn(async () => ({ lastSyncedAt: 2000, items: [] }));
    const push = vi.fn(async (_items: SyncItem[]) => {
      throw new Error("network");
    });
    await expect(
      syncNow({
        storage,
        isSignedIn: () => true,
        pull,
        push,
        now: () => 3000,
      }),
    ).resolves.toBeUndefined();
    const meta = await storage.getSyncMeta();
    expect(meta.lastSyncedAt).toBe(0);
  });

  it("runs a single flight for concurrent calls", async () => {
    const storage = makeStorage();
    let resolvePull: (value: { lastSyncedAt: number; items: [] }) => void;
    const pull = vi.fn(
      () =>
        new Promise<{ lastSyncedAt: number; items: [] }>((res) => {
          resolvePull = res;
        }),
    );
    const push = vi.fn(async (_items: SyncItem[]) => ({ accepted: 0 }));
    const opts = {
      storage,
      isSignedIn: () => true,
      pull,
      push,
      now: () => 1000,
    };
    const p1 = syncNow(opts);
    const p2 = syncNow(opts);
    await vi.waitFor(() => expect(pull).toHaveBeenCalledTimes(1));
    resolvePull!({ lastSyncedAt: 2000, items: [] });
    await Promise.all([p1, p2]);
    expect(pull).toHaveBeenCalledTimes(1);
  });

  it("merges settings single-object", async () => {
    const storage = makeStorage();
    await storage.saveSettings({ ...DEFAULT_SETTINGS, displayCurrency: "EUR" });
    await storage.setItemSyncMeta("settings", "settings", 1000);
    const serverSettings = { ...DEFAULT_SETTINGS, displayCurrency: "GBP" };
    const pull = vi.fn(async (): Promise<{ lastSyncedAt: number; items: SyncItem[] }> => ({
      lastSyncedAt: 5000,
      items: [
        {
          collection: "settings",
          id: "settings",
          data: serverSettings,
          updatedAt: 4000,
          deletedAt: null,
        },
      ],
    }));
    const push = vi.fn(async (_items: SyncItem[]) => ({ accepted: 0 }));
    await syncNow({
      storage,
      isSignedIn: () => true,
      pull,
      push,
      now: () => 6000,
    });
    expect((await storage.getSettings()).displayCurrency).toBe("GBP");
  });

  it("merges pulled reminders into the correct array by reminderType", async () => {
    const storage = makeStorage();
    const dateReminder = makeReminder("r1", { reminderType: "date" });
    const stockWatch = makeReminder("w1", { reminderType: "back_in_stock" });
    const pull = vi.fn(async (): Promise<{ lastSyncedAt: number; items: SyncItem[] }> => ({
      lastSyncedAt: 5000,
      items: [
        {
          collection: "reminders",
          id: "r1",
          data: dateReminder,
          updatedAt: 4000,
          deletedAt: null,
        },
        {
          collection: "reminders",
          id: "w1",
          data: stockWatch,
          updatedAt: 4000,
          deletedAt: null,
        },
      ],
    }));
    const push = vi.fn(async (_items: SyncItem[]) => ({ accepted: 0 }));
    await syncNow({
      storage,
      isSignedIn: () => true,
      pull,
      push,
      now: () => 6000,
    });
    expect((await storage.getBackOrderReminders()).map((r) => r.id)).toEqual([
      "r1",
    ]);
    expect((await storage.getStockWatches()).map((w) => w.id)).toEqual(["w1"]);
  });

  it("pushes a tombstone for a locally deleted item", async () => {
    const storage = makeStorage();
    await storage.addToWatchlist(makeProduct("p1"));
    await storage.setItemSyncMeta("watchlist", "p1", 1000);
    await storage.removeFromWatchlist("p1");
    await storage.markItemDeleted("watchlist", "p1", 2000);
    const pull = vi.fn(async () => ({ lastSyncedAt: 1500, items: [] }));
    const push = vi.fn(async (_items: SyncItem[]) => ({ accepted: 1 }));
    await syncNow({
      storage,
      isSignedIn: () => true,
      pull,
      push,
      now: () => 3000,
    });
    expect(push).toHaveBeenCalledTimes(1);
    const pushed = push.mock.calls[0]![0];
    expect(pushed).toHaveLength(1);
    expect(pushed[0]!.collection).toBe("watchlist");
    expect(pushed[0]!.id).toBe("p1");
    expect(pushed[0]!.deletedAt).toBe(2000);
    expect(pushed[0]!.data).toBeNull();
  });
});
