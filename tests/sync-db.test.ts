import { eq, sql } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { users } from "../drizzle/schema";
import { getDb } from "../server/db";
import {
  listChangedItems,
  purgeOldTombstones,
  shouldAcceptSyncWrite,
  TOMBSTONE_PURGE_WINDOW_MS,
  upsertSyncItem,
} from "../server/sync-db";
import type { SyncItem } from "../lib/types";

const TEST_URL = process.env.TEST_DATABASE_URL;
const runDbTests = Boolean(process.env.RUN_DB_TESTS) && Boolean(TEST_URL);
if (TEST_URL) process.env.DATABASE_URL = TEST_URL;

const TABLES = [
  "watchlist_items",
  "price_alerts",
  "back_order_reminders",
  "app_settings",
];

describe.skipIf(!runDbTests)("sync-db", () => {
  let userA: number;
  let userB: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Test DB not available");
    userA = await createUser("sync-db-a");
    userB = await createUser("sync-db-b");
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

  async function createUser(openId: string): Promise<number> {
    const db = await getDb();
    if (!db) throw new Error("Test DB not available");
    await db
      .insert(users)
      .values({ openId })
      .onDuplicateKeyUpdate({ set: { openId } });
    const [row] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.openId, openId))
      .limit(1);
    return row!.id;
  }

  function item(overrides: Partial<SyncItem> = {}): SyncItem {
    return {
      collection: "watchlist",
      id: "p1",
      data: { id: "p1", name: "Product" },
      updatedAt: 1000,
      deletedAt: null,
      ...overrides,
    };
  }

  it("upserts a new item and stamps server time", async () => {
    const result = await upsertSyncItem(userA, item({ updatedAt: 1000 }));
    expect(result.accepted).toBe(true);
    expect(result.updatedAt).toBeGreaterThanOrEqual(Date.now() - 5000);
    expect(result.updatedAt).toBeLessThanOrEqual(Date.now() + 5000);
    const changed = await listChangedItems(userA, null);
    expect(changed).toHaveLength(1);
    expect(changed[0]!.updatedAt).toBe(result.updatedAt);
    expect(changed[0]!.updatedAt).not.toBe(1000);
  });

  it("rejects an item that is not newer than the existing row", async () => {
    const now = Date.now();
    await upsertSyncItem(userA, item({ updatedAt: now }));
    const result = await upsertSyncItem(userA, item({ updatedAt: now - 500 }));
    expect(result.accepted).toBe(false);
  });

  it("accepts a newer item and overwrites the row", async () => {
    const now = Date.now();
    await upsertSyncItem(userA, item({ updatedAt: now }));
    const result = await upsertSyncItem(
      userA,
      item({ updatedAt: now + 500, data: { id: "p1", name: "Newer" } }),
    );
    expect(result.accepted).toBe(true);
    const changed = await listChangedItems(userA, null);
    expect((changed[0]!.data as { name: string }).name).toBe("Newer");
  });

  it("listChangedItems filters by since-cursor", async () => {
    await upsertSyncItem(userA, item({ id: "p1", updatedAt: Date.now() }));
    await new Promise((r) => setTimeout(r, 5));
    await upsertSyncItem(userA, item({ id: "p2", updatedAt: Date.now() }));
    const first = await listChangedItems(userA, null);
    expect(first.map((i) => i.id).sort()).toEqual(["p1", "p2"]);
    const since = first.find((i) => i.id === "p1")!.updatedAt;
    const second = await listChangedItems(userA, since);
    expect(second.map((i) => i.id)).toEqual(["p2"]);
  });

  it("isolates changes per user", async () => {
    await upsertSyncItem(userA, item({ id: "p1" }));
    await upsertSyncItem(userB, item({ id: "p2" }));
    const forA = await listChangedItems(userA, null);
    const forB = await listChangedItems(userB, null);
    expect(forA.map((i) => i.id)).toEqual(["p1"]);
    expect(forB.map((i) => i.id)).toEqual(["p2"]);
  });

  it("returns tombstoned rows with data null", async () => {
    const now = Date.now();
    await upsertSyncItem(userA, item({ id: "p1", updatedAt: now }));
    await upsertSyncItem(
      userA,
      item({ id: "p1", updatedAt: now + 500, deletedAt: now + 500 }),
    );
    const changed = await listChangedItems(userA, null);
    expect(changed).toHaveLength(1);
    expect(changed[0]!.deletedAt).not.toBeNull();
    expect(changed[0]!.data).toBeNull();
  });

  it("purgeOldTombstones removes old tombstones and keeps recent ones", async () => {
    const old = Date.now() - 40 * 24 * 60 * 60 * 1000;
    const recent = Date.now() - 1000;
    await upsertSyncItem(
      userA,
      item({ id: "old", updatedAt: old, deletedAt: old }),
    );
    await upsertSyncItem(
      userA,
      item({ id: "recent", updatedAt: recent, deletedAt: recent }),
    );
    await purgeOldTombstones(userA, Date.now() - TOMBSTONE_PURGE_WINDOW_MS);
    const changed = await listChangedItems(userA, null);
    expect(changed.map((i) => i.id)).toEqual(["recent"]);
  });

  it("accepts a slow-clock device's follow-up edit (client-clock LWW)", async () => {
    // Device clock runs 10 minutes behind. First edit lands...
    const first = await upsertSyncItem(
      userA,
      item({
        id: "p1",
        data: { id: "p1", name: "E1" },
        updatedAt: Date.now() - 600_000,
      }),
    );
    expect(first.accepted).toBe(true);
    // ...five minutes later the same device edits again; its timestamp is
    // still below the row's server stamp, but above its own previous stamp.
    const second = await upsertSyncItem(
      userA,
      item({
        id: "p1",
        data: { id: "p1", name: "E2" },
        updatedAt: Date.now() - 300_000,
      }),
    );
    expect(second.accepted).toBe(true);
    const changed = await listChangedItems(userA, null);
    expect((changed[0]!.data as { name: string }).name).toBe("E2");
  });
});

describe("shouldAcceptSyncWrite", () => {
  it("compares client clocks when both stamps exist", () => {
    // Fast-clock device wrote at its own now=99000 (server stamped 1000);
    // slow-clock device pushes updatedAt=50000 → must be rejected.
    expect(shouldAcceptSyncWrite(99_000, 1_000, 50_000)).toBe(false);
    expect(shouldAcceptSyncWrite(1_000, 999_000, 2_000)).toBe(true);
    expect(shouldAcceptSyncWrite(1_000, 1_000, 1_000)).toBe(false);
  });

  it("falls back to the server stamp for legacy rows without a client stamp", () => {
    expect(shouldAcceptSyncWrite(null, 5_000, 4_000)).toBe(false);
    expect(shouldAcceptSyncWrite(null, 1_000, 5_000)).toBe(true);
  });
});
