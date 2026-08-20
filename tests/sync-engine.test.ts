import { describe, expect, it, vi } from "vitest";
import { createStorage, type Storage } from "../lib/storage";
import { setupSync, syncNow } from "../lib/sync";
import type {
  AppSettings,
  BackOrderReminder,
  DistributorListing,
  PriceAlert,
  Product,
  StockStatus,
  SyncItem,
  SyncStampedItem,
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
  healthAlerts: true,
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
    const pull = vi.fn(
      async (): Promise<{ lastSyncedAt: number; items: SyncItem[] }> => ({
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
      }),
    );
    const push = vi.fn(async (_items: SyncItem[]) => ({ accepted: 0, stamped: [] }));
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
    await storage.addToWatchlist(
      makeProduct("p1", [listing("d1", 100, "in_stock")]),
    );
    await storage.setItemSyncMeta("watchlist", "p1", 1000);
    const serverProduct = makeProduct("p1", [listing("d1", 90, "in_stock")]);
    const pull = vi.fn(
      async (): Promise<{ lastSyncedAt: number; items: SyncItem[] }> => ({
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
      }),
    );
    const push = vi.fn(async (_items: SyncItem[]) => ({ accepted: 0, stamped: [] }));
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
    await storage.addToWatchlist(
      makeProduct("p1", [listing("d1", 100, "in_stock")]),
    );
    await storage.setItemSyncMeta("watchlist", "p1", 5000);
    const serverProduct = makeProduct("p1", [listing("d1", 90, "in_stock")]);
    const pull = vi.fn(
      async (): Promise<{ lastSyncedAt: number; items: SyncItem[] }> => ({
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
      }),
    );
    const push = vi.fn(async (_items: SyncItem[]) => ({ accepted: 1, stamped: [] }));
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
    const pull = vi.fn(
      async (): Promise<{ lastSyncedAt: number; items: SyncItem[] }> => ({
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
      }),
    );
    const push = vi.fn(async (_items: SyncItem[]) => ({ accepted: 0, stamped: [] }));
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
      {
        date: new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10),
        price: 100,
        currency: "USD",
        stockStatus: "in_stock",
      },
    ];
    await storage.addToWatchlist(makeProduct("p1", [localListing]));
    await storage.setItemSyncMeta("watchlist", "p1", 1000);
    const serverProduct = makeProduct("p1", [listing("d1", 90, "in_stock")]);
    const pull = vi.fn(
      async (): Promise<{ lastSyncedAt: number; items: SyncItem[] }> => ({
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
      }),
    );
    const push = vi.fn(async (_items: SyncItem[]) => ({ accepted: 0, stamped: [] }));
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

  it("pushes dirty local items with capped priceHistory and advances lastSyncedAt", async () => {
    const storage = makeStorage();
    const localListing = listing("d1", 100, "in_stock");
    localListing.priceHistory = [
      {
        date: new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10),
        price: 100,
        currency: "USD",
        stockStatus: "in_stock",
      },
    ];
    await storage.addToWatchlist(makeProduct("p1", [localListing]));
    const pull = vi.fn(async () => ({ lastSyncedAt: 2000, items: [] }));
    const push = vi.fn(
      async (
        _items: SyncItem[],
      ): Promise<{ accepted: number; stamped: SyncStampedItem[] }> => ({
        accepted: 1,
        stamped: [{ collection: "watchlist", id: "p1", updatedAt: 2500 }],
      }),
    );
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
    expect(pushed[0]!.updatedAt).toBe(2000);
    expect(
      (pushed[0]!.data as Product).listings[0]!.priceHistory,
    ).toHaveLength(1);
    const meta = await storage.getSyncMeta();
    expect(meta.lastSyncedAt).toBe(2000);
    expect(meta.lastSyncError).toBeNull();
    expect(meta.lastSyncOkAt).toBe(3000);
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
    expect(meta.lastSyncError).toContain("Push failed");
  });

  it("keeps lastSyncedAt unchanged and records an error when pull fails", async () => {
    const storage = makeStorage();
    const pull = vi.fn(async () => {
      throw new Error("network down");
    });
    const push = vi.fn();
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
    expect(meta.lastSyncError).toContain("Pull failed");
    expect(push).not.toHaveBeenCalled();
  });

  it("clears a prior sync error on a successful sync", async () => {
    const storage = makeStorage();
    await storage.addToWatchlist(makeProduct("p1"));
    const failingPush = vi.fn(async (_items: SyncItem[]) => {
      throw new Error("network");
    });
    await syncNow({
      storage,
      isSignedIn: () => true,
      pull: vi.fn(async () => ({ lastSyncedAt: 2000, items: [] })),
      push: failingPush,
      now: () => 3000,
    });
    expect((await storage.getSyncMeta()).lastSyncError).toContain(
      "Push failed",
    );
    await syncNow({
      storage,
      isSignedIn: () => true,
      pull: vi.fn(async () => ({ lastSyncedAt: 4000, items: [] })),
      push: vi.fn(async (_items: SyncItem[]) => ({ accepted: 1, stamped: [] })),
      now: () => 5000,
    });
    const meta = await storage.getSyncMeta();
    expect(meta.lastSyncError).toBeNull();
    expect(meta.lastSyncOkAt).toBe(5000);
  });

  it("keeps a prior lastSyncedAt when a later sync fails", async () => {
    const storage = makeStorage();
    await storage.saveSyncMeta({ lastSyncedAt: 1000, items: {} });
    const pull = vi.fn(async () => {
      throw new Error("network down");
    });
    const push = vi.fn();
    await expect(
      syncNow({
        storage,
        isSignedIn: () => true,
        pull,
        push,
        now: () => 2000,
      }),
    ).resolves.toBeUndefined();
    const meta = await storage.getSyncMeta();
    expect(meta.lastSyncedAt).toBe(1000);
    expect(meta.lastSyncError).toContain("Pull failed");
    expect(meta.lastSyncOkAt).toBeUndefined();
  });

  it("pushes a re-added item as a live update, not a tombstone", async () => {
    const storage = makeStorage();
    await storage.addToWatchlist(makeProduct("p1"));
    await storage.setItemSyncMeta("watchlist", "p1", 1000);
    await storage.removeFromWatchlist("p1");
    await storage.markItemDeleted("watchlist", "p1", 2000);
    await storage.addToWatchlist(makeProduct("p1"));
    const pull = vi.fn(async () => ({ lastSyncedAt: 1500, items: [] }));
    const push = vi.fn(async (_items: SyncItem[]) => ({ accepted: 1, stamped: [] }));
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
    expect(pushed[0]!.deletedAt).toBeNull();
    expect(pushed[0]!.data).toBeTruthy();
  });

  it("keeps local when pulled updatedAt equals local meta updatedAt", async () => {
    const storage = makeStorage();
    await storage.addToWatchlist(
      makeProduct("p1", [listing("d1", 100, "in_stock")]),
    );
    await storage.setItemSyncMeta("watchlist", "p1", 4000);
    const serverProduct = makeProduct("p1", [listing("d1", 90, "in_stock")]);
    const pull = vi.fn(
      async (): Promise<{ lastSyncedAt: number; items: SyncItem[] }> => ({
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
      }),
    );
    const push = vi.fn(async (_items: SyncItem[]) => ({ accepted: 0, stamped: [] }));
    await syncNow({
      storage,
      isSignedIn: () => true,
      pull,
      push,
      now: () => 6000,
    });
    expect((await storage.getWatchlist())[0]!.listings[0]!.price).toBe(100);
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
    const push = vi.fn(async (_items: SyncItem[]) => ({ accepted: 0, stamped: [] }));
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
    const pull = vi.fn(
      async (): Promise<{ lastSyncedAt: number; items: SyncItem[] }> => ({
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
      }),
    );
    const push = vi.fn(async (_items: SyncItem[]) => ({ accepted: 0, stamped: [] }));
    await syncNow({
      storage,
      isSignedIn: () => true,
      pull,
      push,
      now: () => 6000,
    });
    expect((await storage.getSettings()).displayCurrency).toBe("GBP");
  });

  it("does not push settings with no stamped meta entry", async () => {
    const storage = makeStorage();
    await storage.saveSettings({ ...DEFAULT_SETTINGS, displayCurrency: "EUR" });
    const pull = vi.fn(
      async (): Promise<{ lastSyncedAt: number; items: SyncItem[] }> => ({
        lastSyncedAt: 5000,
        items: [],
      }),
    );
    const push = vi.fn(async (_items: SyncItem[]) => ({ accepted: 0, stamped: [] }));
    await syncNow({
      storage,
      isSignedIn: () => true,
      pull,
      push,
      now: () => 6000,
    });
    expect(push).not.toHaveBeenCalled();
  });

  it("merges pulled reminders into the correct array by reminderType", async () => {
    const storage = makeStorage();
    const dateReminder = makeReminder("r1", { reminderType: "date" });
    const stockWatch = makeReminder("w1", { reminderType: "back_in_stock" });
    const pull = vi.fn(
      async (): Promise<{ lastSyncedAt: number; items: SyncItem[] }> => ({
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
      }),
    );
    const push = vi.fn(async (_items: SyncItem[]) => ({ accepted: 0, stamped: [] }));
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
    const push = vi.fn(async (_items: SyncItem[]) => ({ accepted: 1, stamped: [] }));
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

  it("applies server-stamped timestamps from the push response to sync meta", async () => {
    const storage = makeStorage();
    await storage.addToWatchlist(makeProduct("p1"));
    const pull = vi.fn(async () => ({ lastSyncedAt: 2000, items: [] }));
    const push = vi.fn(
      async (
        _items: SyncItem[],
      ): Promise<{ accepted: number; stamped: SyncStampedItem[] }> => ({
        accepted: 1,
        stamped: [{ collection: "watchlist", id: "p1", updatedAt: 2500 }],
      }),
    );
    await syncNow({
      storage,
      isSignedIn: () => true,
      pull,
      push,
      now: () => 3000,
    });
    const meta = await storage.getSyncMeta();
    expect(meta.items.watchlist?.p1?.updatedAt).toBe(2500);
  });

  it("does not advance per-item meta for rejected pushes", async () => {
    const storage = makeStorage();
    await storage.addToWatchlist(makeProduct("p1"));
    await storage.setItemSyncMeta("watchlist", "p1", 1000);
    const pull = vi.fn(async () => ({ lastSyncedAt: 2000, items: [] }));
    const push = vi.fn(async (_items: SyncItem[]) => ({
      accepted: 0,
      stamped: [],
    }));
    await syncNow({
      storage,
      isSignedIn: () => true,
      pull,
      push,
      now: () => 3000,
    });
    const meta = await storage.getSyncMeta();
    expect(meta.items.watchlist?.p1?.updatedAt).toBe(1000);
  });

  it("uses the server cursor (pulled.lastSyncedAt) for lastSyncedAt", async () => {
    const storage = makeStorage();
    await storage.addToWatchlist(makeProduct("p1"));
    const pull = vi.fn(async () => ({ lastSyncedAt: 2000, items: [] }));
    const push = vi.fn(
      async (
        _items: SyncItem[],
      ): Promise<{ accepted: number; stamped: SyncStampedItem[] }> => ({
        accepted: 1,
        stamped: [{ collection: "watchlist", id: "p1", updatedAt: 2500 }],
      }),
    );
    await syncNow({
      storage,
      isSignedIn: () => true,
      pull,
      push,
      now: () => 9000,
    });
    const meta = await storage.getSyncMeta();
    expect(meta.lastSyncedAt).toBe(2000);
    expect(meta.lastSyncOkAt).toBe(9000);
  });

  it("marks offline edits with server-corrected time so a slow clock does not lose edits", async () => {
    const storage = makeStorage();
    const now = Date.now();
    // Server clock is 1 hour ahead of the client clock (client is slow).
    await storage.saveSyncMeta({
      lastSyncedAt: now + 3_600_000,
      lastSyncOkAt: now,
      items: {},
    });
    await storage.addToWatchlist(makeProduct("p1"));
    const pull = vi.fn(async () => ({
      lastSyncedAt: now + 3_600_000 + 5000,
      items: [],
    }));
    const push = vi.fn(
      async (
        _items: SyncItem[],
      ): Promise<{ accepted: number; stamped: SyncStampedItem[] }> => ({
        accepted: 1,
        stamped: [
          {
            collection: "watchlist",
            id: "p1",
            updatedAt: now + 3_600_000 + 5000,
          },
        ],
      }),
    );
    await syncNow({
      storage,
      isSignedIn: () => true,
      pull,
      push,
      now: () => now + 1000,
    });
    expect(push).toHaveBeenCalledTimes(1);
    const pushed = push.mock.calls[0]![0];
    expect(pushed[0]!.updatedAt).toBe(now + 3_600_000 + 5000);
  });

  it("pushes the per-item corrected edit time instead of the sync cursor", async () => {
    const storage = makeStorage();
    const now = Date.now();
    await storage.addToWatchlist(makeProduct("p1"));
    await storage.setItemSyncMeta("watchlist", "p1", now + 3_600_000);
    const pull = vi.fn(async () => ({ lastSyncedAt: now, items: [] }));
    const push = vi.fn(
      async (
        _items: SyncItem[],
      ): Promise<{ accepted: number; stamped: SyncStampedItem[] }> => ({
        accepted: 1,
        stamped: [],
      }),
    );
    await syncNow({
      storage,
      isSignedIn: () => true,
      pull,
      push,
      now: () => now,
    });
    expect(push).toHaveBeenCalledTimes(1);
    const pushed = push.mock.calls[0]![0];
    expect(pushed[0]!.updatedAt).toBe(now + 3_600_000);
  });

  it("marks offline edits with serverNow via the change listener", async () => {
    const storage = makeStorage();
    const now = Date.now();
    await storage.saveSyncMeta({
      lastSyncedAt: now + 3_600_000,
      lastSyncOkAt: now,
      items: {},
    });
    const pull = vi.fn(async () => ({
      lastSyncedAt: now + 3_600_000,
      items: [],
    }));
    const push = vi.fn(async (_items: SyncItem[]) => ({
      accepted: 0,
      stamped: [],
    }));
    setupSync({
      storage,
      isSignedIn: () => true,
      pull,
      push,
      now: () => now + 1000,
      debounceMs: 100_000,
    });
    await storage.addToWatchlist(makeProduct("p1"));
    await vi.waitFor(async () => {
      const meta = await storage.getSyncMeta();
      expect(meta.items.watchlist?.p1?.updatedAt).toBeGreaterThan(
        now + 3_600_000 - 1000,
      );
      expect(meta.items.watchlist?.p1?.updatedAt).toBeLessThan(
        now + 3_600_000 + 1000,
      );
    });
  });

  it("serializes capped price history (last 30 days) in pushed items", async () => {
    const storage = makeStorage();
    const daysAgo = (n: number) =>
      new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
    const localListing = listing("d1", 100, "in_stock");
    localListing.priceHistory = [
      {
        date: daysAgo(45),
        price: 120,
        currency: "USD",
        stockStatus: "in_stock",
      },
      {
        date: daysAgo(7),
        price: 100,
        currency: "USD",
        stockStatus: "in_stock",
      },
    ];
    await storage.addToWatchlist(makeProduct("p1", [localListing]));
    const pull = vi.fn(async () => ({ lastSyncedAt: 2000, items: [] }));
    const push = vi.fn(
      async (
        _items: SyncItem[],
      ): Promise<{ accepted: number; stamped: SyncStampedItem[] }> => ({
        accepted: 1,
        stamped: [{ collection: "watchlist", id: "p1", updatedAt: 2500 }],
      }),
    );
    await syncNow({
      storage,
      isSignedIn: () => true,
      pull,
      push,
      now: () => 3000,
    });
    const pushed = push.mock.calls[0]![0];
    const history = (pushed[0]!.data as Product).listings[0]!.priceHistory;
    expect(history.map((p) => p.date)).toEqual([daysAgo(7)]);
  });

  it("merges pulled price history into local history on apply", async () => {
    const storage = makeStorage();
    const daysAgo = (n: number) =>
      new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
    const localListing = listing("d1", 100, "in_stock");
    localListing.priceHistory = [
      {
        date: daysAgo(7),
        price: 100,
        currency: "USD",
        stockStatus: "in_stock",
      },
    ];
    await storage.addToWatchlist(makeProduct("p1", [localListing]));
    await storage.setItemSyncMeta("watchlist", "p1", 1000);
    const serverProduct = makeProduct("p1", [listing("d1", 90, "in_stock")]);
    serverProduct.listings[0]!.priceHistory = [
      {
        date: daysAgo(6),
        price: 90,
        currency: "USD",
        stockStatus: "in_stock",
      },
    ];
    const pull = vi.fn(
      async (): Promise<{ lastSyncedAt: number; items: SyncItem[] }> => ({
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
      }),
    );
    const push = vi.fn(async (_items: SyncItem[]) => ({
      accepted: 0,
      stamped: [],
    }));
    await syncNow({
      storage,
      isSignedIn: () => true,
      pull,
      push,
      now: () => 6000,
    });
    const history = (await storage.getWatchlist())[0]!.listings[0]!.priceHistory;
    expect(history.map((p) => p.date)).toEqual([daysAgo(7), daysAgo(6)]);
  });

  it("preserves local price history older than the 30-day sync window on merge", async () => {
    const storage = makeStorage();
    const daysAgo = (n: number) =>
      new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
    const localListing = listing("d1", 100, "in_stock");
    localListing.priceHistory = [
      {
        date: daysAgo(60),
        price: 120,
        currency: "USD",
        stockStatus: "in_stock",
      },
    ];
    await storage.addToWatchlist(makeProduct("p1", [localListing]));
    await storage.setItemSyncMeta("watchlist", "p1", 1000);
    const serverProduct = makeProduct("p1", [listing("d1", 90, "in_stock")]);
    serverProduct.listings[0]!.priceHistory = [
      {
        date: daysAgo(6),
        price: 90,
        currency: "USD",
        stockStatus: "in_stock",
      },
    ];
    const pull = vi.fn(
      async (): Promise<{ lastSyncedAt: number; items: SyncItem[] }> => ({
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
      }),
    );
    const push = vi.fn(async (_items: SyncItem[]) => ({
      accepted: 0,
      stamped: [],
    }));
    await syncNow({
      storage,
      isSignedIn: () => true,
      pull,
      push,
      now: () => 6000,
    });
    const history = (await storage.getWatchlist())[0]!.listings[0]!.priceHistory;
    expect(history.map((p) => p.date)).toEqual([daysAgo(60), daysAgo(6)]);
  });

  it("schedules exponential backoff retries after a failed push and resets on success", async () => {
    vi.useFakeTimers();
    try {
      const storage = makeStorage();
      await storage.addToWatchlist(makeProduct("p1"));
      let fail = true;
      const push = vi.fn(
        async (
          _items: SyncItem[],
        ): Promise<{ accepted: number; stamped: SyncStampedItem[] }> => {
          if (fail) throw new Error("network");
          return {
            accepted: 1,
            stamped: [{ collection: "watchlist", id: "p1", updatedAt: 4000 }],
          };
        },
      );
      const setup = setupSync({
        storage,
        isSignedIn: () => true,
        pull: vi.fn(async () => ({ lastSyncedAt: 2000, items: [] })),
        push,
        now: () => Date.now(),
      });
      setup.schedule();
      await vi.advanceTimersByTimeAsync(2000);
      expect(push).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(30_000);
      expect(push).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(60_000);
      expect(push).toHaveBeenCalledTimes(3);

      fail = false;
      await vi.advanceTimersByTimeAsync(120_000);
      expect(push).toHaveBeenCalledTimes(4);

      // A new edit after a successful sync must be pushed (serverNow > cursor).
      // NOTE: relies on vitest fake timers advancing the mocked Date so the
      // clock-offset correction yields a timestamp above the cursor.
      fail = true;
      await vi.advanceTimersByTimeAsync(1000);
      await storage.addToWatchlist(makeProduct("p2"));
      await vi.advanceTimersByTimeAsync(2000);
      expect(push).toHaveBeenCalledTimes(5);

      await vi.advanceTimersByTimeAsync(30_000);
      expect(push).toHaveBeenCalledTimes(6);
    } finally {
      vi.useRealTimers();
    }
  });
});
