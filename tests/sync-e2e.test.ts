import { eq, sql } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { users } from "../drizzle/schema";
import { getDb } from "../server/db";
import { appRouter } from "../server/routers";
import { createStorage, type Storage } from "../lib/storage";
import { syncNow } from "../lib/sync";
import type { TrpcContext } from "../server/_core/context";
import type {
  AppSettings,
  DistributorListing,
  Product,
  StockStatus,
} from "../lib/types";

const TEST_URL = process.env.TEST_DATABASE_URL;
const runDbTests = Boolean(process.env.RUN_DB_TESTS) && Boolean(TEST_URL);
if (TEST_URL) process.env.DATABASE_URL = TEST_URL;

const TABLES = [
  "watchlist_items",
  "price_alerts",
  "back_order_reminders",
  "app_settings",
];

describe.skipIf(!runDbTests)("sync e2e", () => {
  let userId: number;
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Test DB not available");
    const openId = `e2e-${Date.now()}`;
    await db.insert(users).values({ openId });
    const [row] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.openId, openId))
      .limit(1);
    userId = row!.id;
    caller = appRouter.createCaller(createAuthContext(userId));
  });

  beforeEach(async () => {
    const db = await getDb();
    if (!db) return;
    await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
    for (const table of TABLES) {
      await db.execute(sql.raw(`TRUNCATE TABLE ${table}`));
    }
    await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
  });

  function createAuthContext(id: number): TrpcContext {
    const user = {
      id,
      openId: `e2e-${id}`,
      email: "e2e@example.com",
      name: "E2E User",
      loginMethod: "email",
      passwordHash: null,
      role: "user" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
    return {
      user,
      req: {
        protocol: "https",
        hostname: "localhost",
        headers: {},
      } as TrpcContext["req"],
      res: {
        clearCookie: (_name: string, _options: Record<string, unknown>) => {},
      } as TrpcContext["res"],
      deviceId: null,
    };
  }

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

  function makeDevice(): Storage {
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

  function makeProduct(
    id: string,
    listings: DistributorListing[] = [],
  ): Product {
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

  async function syncDevice(storage: Storage): Promise<void> {
    await syncNow({
      storage,
      isSignedIn: () => true,
      pull: (since) => caller.sync.pull({ since }),
      push: (items) => caller.sync.push({ items }),
    });
  }

  it("round-trips watchlist, alerts, settings, and capped price history between two devices", async () => {
    const deviceA = makeDevice();
    const deviceB = makeDevice();
    const weekAgo = new Date(Date.now() - 7 * 86_400_000)
      .toISOString()
      .slice(0, 10);

    const localListing = listing("d1", 100, "in_stock");
    localListing.priceHistory = [
      {
        date: weekAgo,
        price: 100,
        currency: "USD",
        stockStatus: "in_stock",
      },
    ];
    await deviceA.addToWatchlist(makeProduct("p1", [localListing]));
    await deviceA.addAlert({
      id: "a1",
      productId: "p1",
      targetPrice: 80,
      currency: "USD",
      isActive: true,
      createdAt: "2026-08-01T00:00:00.000Z",
    });
    await deviceA.saveSettings({
      theme: "auto",
      displayCurrency: "EUR",
      checkInterval: "manual",
      notificationsEnabled: true,
      stockAlerts: true,
      priceAlerts: true,
    } as AppSettings);
    // The app marks items dirty via setupSync's onChange hook; this test calls
    // syncNow directly, so mark the settings entry dirty explicitly.
    await deviceA.setItemSyncMeta("settings", "settings", Date.now());

    await syncDevice(deviceA);
    await syncDevice(deviceB);

    const bWatchlist = await deviceB.getWatchlist();
    expect(bWatchlist).toHaveLength(1);
    expect(bWatchlist[0]!.id).toBe("p1");
    expect(bWatchlist[0]!.listings[0]!.priceHistory).toEqual([
      {
        date: weekAgo,
        price: 100,
        currency: "USD",
        stockStatus: "in_stock",
      },
    ]);
    expect((await deviceB.getAlerts()).map((a) => a.id)).toEqual(["a1"]);
    expect((await deviceB.getSettings()).displayCurrency).toBe("EUR");

    // Device B edits the product price; device A pulls the change.
    const bProduct = (await deviceB.getWatchlist())[0]!;
    bProduct.listings[0]!.price = 90;
    await deviceB.saveWatchlist([bProduct]);
    await deviceB.setItemSyncMeta("watchlist", "p1", Date.now());
    await syncDevice(deviceB);
    await syncDevice(deviceA);
    expect((await deviceA.getWatchlist())[0]!.listings[0]!.price).toBe(90);

    // Device A deletes the product; device B sees the tombstone.
    await deviceA.removeFromWatchlist("p1");
    await deviceA.markItemDeleted("watchlist", "p1", Date.now());
    await syncDevice(deviceA);
    await syncDevice(deviceB);
    expect(await deviceB.getWatchlist()).toEqual([]);
  });

  it("does not leak data between users", async () => {
    const otherOpenId = `e2e-other-${Date.now()}`;
    const db = await getDb();
    if (!db) throw new Error("Test DB not available");
    await db.insert(users).values({ openId: otherOpenId });
    const [row] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.openId, otherOpenId))
      .limit(1);
    const otherCaller = appRouter.createCaller(createAuthContext(row!.id));

    const deviceA = makeDevice();
    await deviceA.addToWatchlist(makeProduct("p1"));
    await syncNow({
      storage: deviceA,
      isSignedIn: () => true,
      pull: (since) => caller.sync.pull({ since }),
      push: (items) => caller.sync.push({ items }),
    });

    const otherDevice = makeDevice();
    await syncNow({
      storage: otherDevice,
      isSignedIn: () => true,
      pull: (since) => otherCaller.sync.pull({ since }),
      push: (items) => otherCaller.sync.push({ items }),
    });
    expect(await otherDevice.getWatchlist()).toEqual([]);
  });
});
