# Sync Hardening (v4.6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Verify and harden the existing cross-device sync engine: server-authoritative timestamps (no clock-skew data loss), capped 30-day price-history sync, offline retry/backoff, real-MySQL integration tests, and an end-to-end sync test.

**Architecture:** The server stamps every accepted pushed item with its own clock and returns the stamped timestamps; the client stores them in sync meta and additionally corrects offline edit timestamps by a measured server-clock offset so every LWW comparison is server-comparable. Price history is serialized with a 30-day cap and merged on apply. `setupSync` gains an exponential-backoff retry timer plus a foreground retry hook. DB-backed tests run behind `RUN_DB_TESTS=1` against a dedicated `stock_tracker_test` database in the existing MySQL container.

**Tech Stack:** TypeScript 5.9 (strict), Drizzle ORM + mysql2, tRPC v11, vitest, Expo/React Native, AsyncStorage.

**Design spec:** `docs/superpowers/specs/2026-08-16-sync-hardening-v4.6-design.md`

**Design refinement (flagged during planning):** Pure push-response stamping only re-anchors meta to server time *after* a sync. Edits made *between* syncs still carry client-clock timestamps, so a device whose clock is behind can still lose an offline edit (its timestamp reads older than the server's). The plan therefore adds a minimal client-side clock-offset correction: `markDirty` timestamps offline edits as `Date.now() + (lastSyncedAt - lastSyncOkAt)`, and the sync cursor becomes `pulled.lastSyncedAt` (server time) instead of `max(pulled.lastSyncedAt, clientNow)`. This is a few lines, keeps the server fully authoritative, and makes the spec's "no silent data loss" claim actually true.

**Design refinement 2 (decided during Task 3 code review):** Dirty push payloads carry the per-item corrected edit time (`entry.updatedAt` from `markDirty`/`serverNow`), not the sync cursor, so the server's LWW reject check compares against the actual edit time ("latest edit wins"), not "latest sync wins". `collectDirty` uses `entry.updatedAt` when the meta entry exists and is not deleted, falling back to the cursor (`now`) for brand-new items. (Note: the Task 3 Step 6 assertion `pushed[0]!.updatedAt` toBe `2000` still holds because that test's item has no meta entry and hits the fallback.)

---

## File Structure

| File | Responsibility | Change |
| --- | --- | --- |
| `shared/const.ts` | Shared constants | Add `PRICE_HISTORY_SYNC_DAYS = 30` |
| `lib/types.ts` | Domain types | Add `SyncStampedItem` |
| `server/sync-db.ts` | Sync SQL layer | `upsertSyncItem` stamps server time, returns `{ accepted, updatedAt }` |
| `server/routers.ts` | tRPC router | `sync.push` returns `{ accepted, stamped }` |
| `lib/sync.ts` | Client sync engine | Stamped-meta handling, server cursor, offset correction, capped history, backoff |
| `app/_layout.tsx` | Root layout | Foreground retry hook |
| `tests/sync-router.test.ts` | Router no-DB tests | Expect `stamped: []` |
| `tests/sync-engine.test.ts` | Client engine tests | Update mocks/assertions; add stamped, cursor, offset, history, backoff tests |
| `scripts/setup-test-db.sh` | Test DB bootstrap | Create `stock_tracker_test` + run migrations |
| `tests/sync-db.test.ts` | DB integration tests | `listChangedItems`/`upsertSyncItem`/`purgeOldTombstones` against real MySQL |
| `tests/sync-e2e.test.ts` | End-to-end sync test | storage → `syncNow` → real router → DB → back |

---

### Task 1: Shared constant and stamped type

**Files:**
- Modify: `shared/const.ts`
- Modify: `lib/types.ts`

- [x] **Step 1: Add the price-history sync window constant**

Edit `shared/const.ts` to add the last line:

```ts
export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = "Please login (10001)";
export const NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
export const DEVICE_REVOKED_ERR_MSG = "This device was signed out (10003)";
export const PRICE_HISTORY_SYNC_DAYS = 30;
```

- [x] **Step 2: Add the `SyncStampedItem` type**

Edit `lib/types.ts` — append after the `SyncItem` interface (which ends at line 133):

```ts
export interface SyncStampedItem {
  collection: Collection;
  id: string;
  updatedAt: number;
}
```

- [x] **Step 3: Typecheck**

Run: `pnpm check`
Expected: 0 errors.

- [x] **Step 4: Commit**

```bash
git add shared/const.ts lib/types.ts
git commit -m "feat(sync): add PRICE_HISTORY_SYNC_DAYS and SyncStampedItem type"
```

---

### Task 2: Server push-response stamping

**Files:**
- Modify: `server/sync-db.ts`
- Modify: `server/routers.ts`
- Test: `tests/sync-router.test.ts`

- [x] **Step 1: Write the failing router test**

Edit `tests/sync-router.test.ts` — change the push no-DB assertion (line 44):

```ts
  it("push accepts nothing when DB is unavailable", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.sync.push({ items: [] });
    expect(result).toEqual({ accepted: 0, stamped: [] });
  });
```

- [x] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/sync-router.test.ts`
Expected: FAIL — `push` returns `{ accepted: 0 }`, not `{ accepted: 0, stamped: [] }`.

- [x] **Step 3: Change `upsertSyncItem` to stamp server time and return the stamped value**

Edit `server/sync-db.ts`. Replace the entire `upsertSyncItem` function (lines 110–243) with:

```ts
/**
 * Last-write-wins upsert. The stored row's updatedAtMs is stamped with the
 * server clock (not the client's), so LWW ordering is server-authoritative.
 * Returns { accepted, updatedAt }: accepted is false when the incoming item
 * is not newer than the existing row; updatedAt is the server-stamped value
 * on acceptance (or the existing row's timestamp on rejection).
 */
export async function upsertSyncItem(
  userId: number,
  item: SyncItem,
): Promise<{ accepted: boolean; updatedAt: number }> {
  const db = await getDb();
  if (!db) return { accepted: false, updatedAt: item.updatedAt };
  const stampedAt = Date.now();

  switch (item.collection) {
    case "watchlist": {
      const existing = await db
        .select({ updatedAtMs: watchlistItems.updatedAtMs })
        .from(watchlistItems)
        .where(
          and(
            eq(watchlistItems.userId, userId),
            eq(watchlistItems.productId, item.id),
          ),
        )
        .limit(1);
      if (existing.length > 0 && existing[0]!.updatedAtMs >= item.updatedAt) {
        return { accepted: false, updatedAt: existing[0]!.updatedAtMs };
      }
      await db
        .insert(watchlistItems)
        .values({
          userId,
          productId: item.id,
          data: item.data,
          updatedAtMs: stampedAt,
          deletedAtMs: item.deletedAt,
        })
        .onDuplicateKeyUpdate({
          set: {
            data: item.data,
            updatedAtMs: stampedAt,
            deletedAtMs: item.deletedAt,
          },
        });
      return { accepted: true, updatedAt: stampedAt };
    }
    case "alerts": {
      const existing = await db
        .select({ updatedAtMs: priceAlerts.updatedAtMs })
        .from(priceAlerts)
        .where(
          and(eq(priceAlerts.userId, userId), eq(priceAlerts.alertId, item.id)),
        )
        .limit(1);
      if (existing.length > 0 && existing[0]!.updatedAtMs >= item.updatedAt) {
        return { accepted: false, updatedAt: existing[0]!.updatedAtMs };
      }
      await db
        .insert(priceAlerts)
        .values({
          userId,
          alertId: item.id,
          data: item.data,
          updatedAtMs: stampedAt,
          deletedAtMs: item.deletedAt,
        })
        .onDuplicateKeyUpdate({
          set: {
            data: item.data,
            updatedAtMs: stampedAt,
            deletedAtMs: item.deletedAt,
          },
        });
      return { accepted: true, updatedAt: stampedAt };
    }
    case "reminders": {
      const existing = await db
        .select({ updatedAtMs: backOrderReminders.updatedAtMs })
        .from(backOrderReminders)
        .where(
          and(
            eq(backOrderReminders.userId, userId),
            eq(backOrderReminders.reminderId, item.id),
          ),
        )
        .limit(1);
      if (existing.length > 0 && existing[0]!.updatedAtMs >= item.updatedAt) {
        return { accepted: false, updatedAt: existing[0]!.updatedAtMs };
      }
      await db
        .insert(backOrderReminders)
        .values({
          userId,
          reminderId: item.id,
          data: item.data,
          updatedAtMs: stampedAt,
          deletedAtMs: item.deletedAt,
        })
        .onDuplicateKeyUpdate({
          set: {
            data: item.data,
            updatedAtMs: stampedAt,
            deletedAtMs: item.deletedAt,
          },
        });
      return { accepted: true, updatedAt: stampedAt };
    }
    case "settings": {
      const existing = await db
        .select({ updatedAtMs: appSettings.updatedAtMs })
        .from(appSettings)
        .where(eq(appSettings.userId, userId))
        .limit(1);
      if (existing.length > 0 && existing[0]!.updatedAtMs >= item.updatedAt) {
        return { accepted: false, updatedAt: existing[0]!.updatedAtMs };
      }
      await db
        .insert(appSettings)
        .values({
          userId,
          data: item.data,
          updatedAtMs: stampedAt,
          deletedAtMs: item.deletedAt,
        })
        .onDuplicateKeyUpdate({
          set: {
            data: item.data,
            updatedAtMs: stampedAt,
            deletedAtMs: item.deletedAt,
          },
        });
      return { accepted: true, updatedAt: stampedAt };
    }
  }
}
```

- [x] **Step 4: Update the router to return stamped entries**

Edit `server/routers.ts`. Add `SyncStampedItem` to the import from `../lib/types` (line 9 area):

```ts
import type { SyncStampedItem } from "../lib/types";
```

Replace the `sync.push` mutation (lines 63–80) with:

```ts
    push: protectedProcedure
      .input(z.object({ items: z.array(syncItemSchema) }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) {
          console.warn("[Sync] Database not available; accepting nothing");
          return { accepted: 0, stamped: [] };
        }
        const stamped: SyncStampedItem[] = [];
        let accepted = 0;
        for (const item of input.items) {
          const result = await upsertSyncItem(ctx.user.id, item);
          if (result.accepted) {
            accepted += 1;
            stamped.push({
              collection: item.collection,
              id: item.id,
              updatedAt: result.updatedAt,
            });
          }
        }
        await purgeOldTombstones(
          ctx.user.id,
          Date.now() - TOMBSTONE_PURGE_WINDOW_MS,
        );
        return { accepted, stamped };
      }),
```

- [x] **Step 5: Run the router test to verify it passes**

Run: `pnpm vitest run tests/sync-router.test.ts`
Expected: PASS (both tests).

- [x] **Step 6: Typecheck and full non-DB test run**

Run: `pnpm check && pnpm vitest run`
Expected: `pnpm check` 0 errors; all non-DB tests pass (the client still ignores `stamped`, so `sync-engine.test.ts` is unaffected).

- [x] **Step 7: Commit**

```bash
git add server/sync-db.ts server/routers.ts tests/sync-router.test.ts
git commit -m "feat(sync): server stamps pushed items with authoritative timestamps"
```

---

### Task 3: Client stamped-meta handling, server cursor, clock-offset correction

**Files:**
- Modify: `lib/sync.ts`
- Test: `tests/sync-engine.test.ts`

- [x] **Step 1: Write failing tests for the new client behaviors**

Append these three tests to `tests/sync-engine.test.ts` (inside the `describe("syncNow", ...)` block, before the closing `});` at line 594):

```ts
  it("applies server-stamped timestamps from the push response to sync meta", async () => {
    const storage = makeStorage();
    await storage.addToWatchlist(makeProduct("p1"));
    const pull = vi.fn(async () => ({ lastSyncedAt: 2000, items: [] }));
    const push = vi.fn(async (_items: SyncItem[]) => ({
      accepted: 1,
      stamped: [{ collection: "watchlist", id: "p1", updatedAt: 2500 }],
    }));
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
    const push = vi.fn(async (_items: SyncItem[]) => ({
      accepted: 1,
      stamped: [{ collection: "watchlist", id: "p1", updatedAt: 2500 }],
    }));
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
    const push = vi.fn(async (_items: SyncItem[]) => ({
      accepted: 1,
      stamped: [
        { collection: "watchlist", id: "p1", updatedAt: now + 3_600_000 + 5000 },
      ],
    }));
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
```

- [x] **Step 2: Run the new tests to verify they fail**

Run: `pnpm vitest run tests/sync-engine.test.ts`
Expected: The 4 new tests FAIL (client ignores `stamped`, uses `max(pulled.lastSyncedAt, now)` for the cursor, and uses raw `Date.now()` in `markDirty`).

- [x] **Step 3: Update the push contract in `SyncNowOptions`**

Edit `lib/sync.ts`:

- Add `SyncStampedItem` to the type import (line 2–10 block):

```ts
import type {
  AppSettings,
  BackOrderReminder,
  Collection,
  PriceAlert,
  Product,
  SyncItem,
  SyncMeta,
  SyncStampedItem,
} from "./types";
```

- Change the `push` signature (line 18):

```ts
  push: (
    items: SyncItem[],
  ) => Promise<{ accepted: number; stamped: SyncStampedItem[] }>;
```

- [x] **Step 4: Implement stamped-meta handling and the server cursor in `doSync`**

Edit `lib/sync.ts`:

Replace the dirty-push block (lines 91–114) with:

```ts
  if (dirty.length > 0) {
    let stamped: SyncStampedItem[] = [];
    try {
      const result = await opts.push(dirty);
      stamped = result.stamped;
    } catch (error) {
      console.warn("[Sync] Push failed; local changes kept", error);
      await storage.saveSyncMeta({
        ...(await storage.getSyncMeta()),
        lastSyncError: `Push failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
      return;
    }
    const stampedByKey = new Map(
      stamped.map((s) => [`${s.collection}:${s.id}`, s.updatedAt]),
    );
    const metaAfter = await storage.getSyncMeta();
    for (const item of dirty) {
      const stampedAt = stampedByKey.get(`${item.collection}:${item.id}`);
      if (stampedAt === undefined) continue;
      const col = metaAfter.items[item.collection] ?? {};
      col[item.id] = {
        updatedAt: stampedAt,
        deleted: item.deletedAt !== null,
      };
      metaAfter.items[item.collection] = col;
    }
    await storage.saveSyncMeta(metaAfter);
  }

  const nextCursor = pulled.lastSyncedAt;
```

Replace the `collectDirty` call (line 89) with:

```ts
  const dirty = await collectDirty(storage, oldCursor, applied, pulled.lastSyncedAt);
```

- [x] **Step 5: Implement the clock-offset correction in `markDirty`**

Edit `lib/sync.ts`. Replace the `markDirty` function (lines 361–373) with:

```ts
// Best estimate of the server clock: the measured offset from the last
// successful sync (lastSyncedAt is server time, lastSyncOkAt is client time)
// applied to the current client time. Keeps offline edits server-comparable
// so device clock skew cannot lose or wrongly win edits.
async function serverNow(storage: Storage): Promise<number> {
  const meta = await storage.getSyncMeta();
  const okAt = meta.lastSyncOkAt ?? meta.lastSyncedAt;
  return Date.now() + (meta.lastSyncedAt - okAt);
}

async function markDirty(
  storage: Storage,
  collection: Collection,
  id: string,
): Promise<void> {
  const now = await serverNow(storage);
  const exists = await itemExists(storage, collection, id);
  if (exists) {
    await storage.setItemSyncMeta(collection, id, now);
  } else {
    await storage.markItemDeleted(collection, id, now);
  }
}
```

- [x] **Step 6: Update the existing tests for the new contract**

Edit `tests/sync-engine.test.ts`:

1. Replace every push mock return `({ accepted: 0 })` with `({ accepted: 0, stamped: [] })` — use replace-all on the exact string `({ accepted: 0 })` → `({ accepted: 0, stamped: [] })`.
2. Replace every push mock return `({ accepted: 1 })` with `({ accepted: 1, stamped: [] })` — use replace-all on `({ accepted: 1 })` → `({ accepted: 1, stamped: [] })`.
3. In the test `"pushes dirty local items with stripped priceHistory and advances lastSyncedAt"` (starts line 292), change the push mock to return a stamped entry and update the cursor assertions:

```ts
    const pull = vi.fn(async () => ({ lastSyncedAt: 2000, items: [] }));
    const push = vi.fn(async (_items: SyncItem[]) => ({
      accepted: 1,
      stamped: [{ collection: "watchlist", id: "p1", updatedAt: 2500 }],
    }));
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
    const meta = await storage.getSyncMeta();
    expect(meta.lastSyncedAt).toBe(2000);
    expect(meta.lastSyncError).toBeNull();
    expect(meta.lastSyncOkAt).toBe(3000);
```

- [x] **Step 7: Run the engine tests to verify they pass**

Run: `pnpm vitest run tests/sync-engine.test.ts`
Expected: PASS (all existing + 4 new tests).

- [x] **Step 8: Typecheck and full non-DB test run**

Run: `pnpm check && pnpm vitest run`
Expected: 0 TS errors; all non-DB tests pass.

- [x] **Step 9: Commit**

```bash
git add lib/sync.ts tests/sync-engine.test.ts
git commit -m "feat(sync): client uses server-stamped timestamps and clock-offset correction"
```

---

### Task 4: Capped price-history sync

**Files:**
- Modify: `lib/sync.ts`
- Test: `tests/sync-engine.test.ts`

- [x] **Step 1: Write failing tests for capped history serialize/merge**

Append to `tests/sync-engine.test.ts` (inside the `describe("syncNow", ...)` block):

```ts
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
    const push = vi.fn(async (_items: SyncItem[]) => ({
      accepted: 1,
      stamped: [{ collection: "watchlist", id: "p1", updatedAt: 2500 }],
    }));
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
```

- [x] **Step 2: Run the new tests to verify they fail**

Run: `pnpm vitest run tests/sync-engine.test.ts`
Expected: Both new tests FAIL (serialize strips `priceHistory`; apply keeps only local history).

- [x] **Step 3: Implement capped serialize and merge-on-apply**

Edit `lib/sync.ts`:

Add the import at the top (after the existing type import):

```ts
import { PRICE_HISTORY_SYNC_DAYS } from "@/shared/const";
import { mergePriceHistory } from "@/lib/price-history";
```

Replace `serializeItem` (lines 219–236) with:

```ts
function serializeItem(collection: Collection, item: unknown): unknown {
  if (collection !== "watchlist") return item;
  const product = item as Product;
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - PRICE_HISTORY_SYNC_DAYS);
  const cutoffDay = cutoff.toISOString().slice(0, 10);
  return {
    ...product,
    listings: product.listings.map((l) => ({
      distributorId: l.distributorId,
      productId: l.productId,
      price: l.price,
      currency: l.currency,
      stockStatus: l.stockStatus,
      expectedDate: l.expectedDate,
      url: l.url,
      lastChecked: l.lastChecked,
      taxRate: l.taxRate,
      priceHistory: l.priceHistory.filter(
        (p) => p.date.slice(0, 10) >= cutoffDay,
      ),
    })),
  };
}
```

Replace the watchlist branch of `applyLocalItem` (lines 244–268) with:

```ts
    case "watchlist": {
      const incoming = data as Product;
      const list = await storage.getWatchlist();
      const existing = list.find((p) => p.id === incoming.id);
      if (existing) {
        const merged: Product = {
          ...incoming,
          listings: incoming.listings.map((l) => {
            const local = existing.listings.find(
              (el) => el.distributorId === l.distributorId,
            );
            return local
              ? {
                  ...l,
                  priceHistory: mergePriceHistory(
                    local.priceHistory,
                    l.priceHistory ?? [],
                    PRICE_HISTORY_DAYS,
                  ),
                }
              : l;
          }),
        };
        await storage.saveWatchlist(
          list.map((p) => (p.id === incoming.id ? merged : p)),
        );
      } else {
        await storage.saveWatchlist([
          ...list,
          { ...incoming, isWatched: true },
        ]);
      }
      break;
    }
```

- [x] **Step 4: Update the two existing tests affected by the history change**

Edit `tests/sync-engine.test.ts`:

1. In `"preserves local priceHistory while replacing listing state"` (line 251), change the local point date from `"2026-01-01"` to a date within the 30-day window (the old date falls outside the window and would be dropped by the merge):

```ts
    localListing.priceHistory = [
      {
        date: new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10),
        price: 100,
        currency: "USD",
        stockStatus: "in_stock",
      },
    ];
```

2. In `"pushes dirty local items with stripped priceHistory and advances lastSyncedAt"` (line 292), the local point date is `"2026-01-01"` which now falls outside the window. Change the local point date to a within-window date and replace the assertion from expecting `priceHistory` to be `undefined` to expecting the capped point to be included:

```ts
    localListing.priceHistory = [
      {
        date: new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10),
        price: 100,
        currency: "USD",
        stockStatus: "in_stock",
      },
    ];
```

and replace the assertion (line 319–321):

```ts
    expect(
      (pushed[0]!.data as Product).listings[0]!.priceHistory,
    ).toHaveLength(1);
```

- [x] **Step 5: Run the engine tests to verify they pass**

Run: `pnpm vitest run tests/sync-engine.test.ts`
Expected: PASS (all tests).

- [x] **Step 6: Typecheck and full non-DB test run**

Run: `pnpm check && pnpm vitest run`
Expected: 0 TS errors; all non-DB tests pass.

- [x] **Step 7: Commit**

```bash
git add lib/sync.ts tests/sync-engine.test.ts
git commit -m "feat(sync): sync capped 30-day price history across devices"
```

---

### Task 5: Offline retry/backoff + foreground retry

**Files:**
- Modify: `lib/sync.ts`
- Modify: `app/_layout.tsx`
- Test: `tests/sync-engine.test.ts`

- [x] **Step 1: Write failing tests for backoff scheduling**

First update the import at the top of `tests/sync-engine.test.ts` (line 3) to include `setupSync`:

```ts
import { setupSync, syncNow } from "../lib/sync";
```

Then append to `tests/sync-engine.test.ts` (inside the `describe("syncNow", ...)` block):

```ts
  it("schedules exponential backoff retries after a failed push and resets on success", async () => {
    vi.useFakeTimers();
    try {
      const storage = makeStorage();
      await storage.addToWatchlist(makeProduct("p1"));
      let fail = true;
      const push = vi.fn(async (_items: SyncItem[]) => {
        if (fail) throw new Error("network");
        return {
          accepted: 1,
          stamped: [{ collection: "watchlist", id: "p1", updatedAt: 4000 }],
        };
      });
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
```

Note: this test asserts the full backoff ladder (2s debounce → 30s → 60s → 120s retries, reset to 30s after success). `vi.useFakeTimers()` mocks `setTimeout` and `Date`; `vi.advanceTimersByTimeAsync` flushes microtasks between timer fires.

- [x] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/sync-engine.test.ts`
Expected: The backoff test FAILS — `setupSync` currently has no retry timer, so `push` is called only once.

- [x] **Step 3: Implement the backoff scheduler in `setupSync`**

Edit `lib/sync.ts`. Replace the entire `setupSync` function (lines 375–403) with:

```ts
const RETRY_BASE_MS = 30_000;
const RETRY_MAX_MS = 5 * 60_000;

export function setupSync(
  opts: SyncNowOptions & { debounceMs?: number },
): SyncSetup {
  const debounceMs = opts.debounceMs ?? 2000;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retryDelayMs = RETRY_BASE_MS;

  const clearRetry = () => {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    retryDelayMs = RETRY_BASE_MS;
  };

  const scheduleRetry = () => {
    if (retryTimer) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void run();
    }, retryDelayMs);
    retryDelayMs = Math.min(retryDelayMs * 2, RETRY_MAX_MS);
  };

  const afterSync = async () => {
    if (!opts.isSignedIn()) {
      clearRetry();
      return;
    }
    const meta = await opts.storage.getSyncMeta();
    if (meta.lastSyncError) {
      scheduleRetry();
    } else {
      clearRetry();
    }
  };

  const run = async () => {
    timer = null;
    await syncNow(opts).catch((error) => {
      console.warn("[Sync] Background sync failed", error);
    });
    await afterSync();
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(run, debounceMs);
  };

  const runNow = async () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    await syncNow(opts).catch((error) => {
      console.warn("[Sync] Launch sync failed", error);
    });
    await afterSync();
  };

  opts.storage.setOnChange((collection, itemId) => {
    markDirty(opts.storage, collection, itemId).then(() => schedule());
  });
  return { syncNow: runNow, schedule };
}
```

- [x] **Step 4: Run the backoff test to verify it passes**

Run: `pnpm vitest run tests/sync-engine.test.ts`
Expected: PASS (all tests, including backoff).

- [x] **Step 5: Add the foreground retry hook in the root layout**

Edit `app/_layout.tsx`:

Add `AppState` to the existing react-native import (line 8):

```ts
import { Alert, AppState, Platform } from "react-native";
```

Add `getSyncMeta` to the existing storage import (lines 16–22):

```ts
import {
  getWatchlist,
  addToWatchlist,
  updateProductListings,
  getSettings,
  defaultStorage,
  getSyncMeta,
} from "@/lib/storage";
```

Add a new effect after the sync-setup effect (after line 207):

```ts
  // Retry a failed sync when the app returns to the foreground.
  useEffect(() => {
    const onActive = async () => {
      const setup = getSyncSetup();
      if (!setup) return;
      const meta = await getSyncMeta();
      if (meta.lastSyncError) void setup.syncNow();
    };
    if (Platform.OS === "web") {
      window.addEventListener("focus", onActive);
      return () => window.removeEventListener("focus", onActive);
    }
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void onActive();
    });
    return () => sub.remove();
  }, []);
```

- [x] **Step 6: Typecheck and full non-DB test run**

Run: `pnpm check && pnpm vitest run`
Expected: 0 TS errors; all non-DB tests pass.

- [x] **Step 7: Commit**

```bash
git add lib/sync.ts app/_layout.tsx tests/sync-engine.test.ts
git commit -m "feat(sync): exponential backoff retries and foreground retry hook"
```

---

### Task 6: Test DB setup script

**Files:**
- Create: `scripts/setup-test-db.sh`

- [x] **Step 1: Create the setup script**

Create `scripts/setup-test-db.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Bootstraps the dedicated sync-test database in the running MySQL container
# and applies the drizzle migrations. Idempotent.
#
# Usage:
#   scripts/setup-test-db.sh
#
# Reads credentials from the container env (docker inspect). Override with:
#   MYSQL_CONTAINER=<name> TEST_DB_NAME=<db> scripts/setup-test-db.sh

CONTAINER="${MYSQL_CONTAINER:-promptgen-mysql}"
DB_NAME="${TEST_DB_NAME:-stock_tracker_test}"

ENV_LINE=$(docker inspect "$CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}')
MYSQL_USER=$(printf '%s\n' "$ENV_LINE" | sed -n 's/^MYSQL_USER=//p')
MYSQL_PASSWORD=$(printf '%s\n' "$ENV_LINE" | sed -n 's/^MYSQL_PASSWORD=//p')
MYSQL_ROOT_PASSWORD=$(printf '%s\n' "$ENV_LINE" | sed -n 's/^MYSQL_ROOT_PASSWORD=//p')
PORT=$(docker port "$CONTAINER" 3306/tcp | sed -n 's/.*://p' | head -1)

if [[ -z "$MYSQL_USER" || -z "$MYSQL_PASSWORD" || -z "$MYSQL_ROOT_PASSWORD" || -z "$PORT" ]]; then
  echo "Could not read MySQL credentials/port from container $CONTAINER" >&2
  exit 1
fi

docker exec "$CONTAINER" mysql -u root -p"$MYSQL_ROOT_PASSWORD" \
  -e "CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$MYSQL_USER'@'%'; FLUSH PRIVILEGES;"

TEST_DATABASE_URL=$(node -e "
  const user = process.argv[1];
  const pass = process.argv[2];
  const port = process.argv[3];
  const db = process.argv[4];
  process.stdout.write('mysql://' + encodeURIComponent(user) + ':' + encodeURIComponent(pass) + '@127.0.0.1:' + port + '/' + db);
" "$MYSQL_USER" "$MYSQL_PASSWORD" "$PORT" "$DB_NAME")

DATABASE_URL="$TEST_DATABASE_URL" pnpm exec drizzle-kit migrate

echo "Test DB ready: $TEST_DATABASE_URL"
echo "Run DB tests with: TEST_DATABASE_URL=\"$TEST_DATABASE_URL\" RUN_DB_TESTS=1 pnpm test"
```

- [x] **Step 2: Make it executable and run it**

Run:
```bash
chmod +x scripts/setup-test-db.sh
./scripts/setup-test-db.sh
```

Expected: prints `Test DB ready: mysql://...@127.0.0.1:3307/stock_tracker_test` and the run command. The migrations apply cleanly (the `users` table and all sync tables exist in the test DB).

- [x] **Step 3: Verify the test DB schema**

Run:
```bash
docker exec promptgen-mysql mysql -u root -p"$(docker inspect promptgen-mysql --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^MYSQL_ROOT_PASSWORD=//p')" -e "SHOW TABLES FROM stock_tracker_test;"
```

Expected: lists `users`, `watchlist_items`, `price_alerts`, `back_order_reminders`, `app_settings`, and the other schema tables.

- [x] **Step 4: Commit**

```bash
git add scripts/setup-test-db.sh
git commit -m "chore(sync): add test DB bootstrap script"
```

---

### Task 7: sync-db integration tests

**Files:**
- Create: `tests/sync-db.test.ts`

- [x] **Step 1: Create the integration test file**

Create `tests/sync-db.test.ts`:

```ts
import { eq, sql } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { users } from "../drizzle/schema";
import { getDb } from "../server/db";
import {
  listChangedItems,
  purgeOldTombstones,
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
    const since = first[0]!.updatedAt;
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
    await purgeOldTombstones(
      userA,
      Date.now() - TOMBSTONE_PURGE_WINDOW_MS,
    );
    const changed = await listChangedItems(userA, null);
    expect(changed.map((i) => i.id)).toEqual(["recent"]);
  });
});
```

- [x] **Step 2: Run the DB tests to verify they pass**

Run: `TEST_DATABASE_URL="$(docker inspect promptgen-mysql --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^MYSQL_USER=//p'):$(docker inspect promptgen-mysql --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^MYSQL_PASSWORD=//p')@127.0.0.1:3307/stock_tracker_test" RUN_DB_TESTS=1 pnpm vitest run tests/sync-db.test.ts`

(Or use the `TEST_DATABASE_URL` printed by `scripts/setup-test-db.sh` from Task 6.)

Expected: PASS (all 7 tests).

- [x] **Step 3: Verify the tests are skipped without the flag**

Run: `pnpm vitest run tests/sync-db.test.ts`
Expected: PASS with the suite skipped (0 tests run, no DB connection attempted).

- [x] **Step 4: Typecheck**

Run: `pnpm check`
Expected: 0 errors.

- [x] **Step 5: Commit**

```bash
git add tests/sync-db.test.ts
git commit -m "test(sync): add MySQL integration tests for sync-db"
```

---

### Task 8: End-to-end sync test

**Files:**
- Create: `tests/sync-e2e.test.ts`
- Modify: `vitest.config.ts` (set `fileParallelism: false` so the DB suites truncating shared tables cannot race)
- Modify: `tests/sync-engine.test.ts` (add regression test: settings with no stamped meta entry is not pushed)

> **Implementation notes (deviations from the original snippet):**
> - The test calls `syncNow` directly, bypassing `setupSync`'s `onChange → markDirty` wiring that the real app relies on. The initial watchlist/alert adds need no explicit stamp (they push via `collectDirty`'s `!entry` branch), but the settings save, the price edit, and the deletion do: the test marks them dirty explicitly with `setItemSyncMeta`/`markItemDeleted` (mirroring `markDirty`'s effect). Without this, `saveSettings`/`saveWatchlist`/`removeFromWatchlist` never bump sync meta and the changes are never pushed.
> - The original snippet's settings behavior was NOT changed in `lib/sync.ts`: settings with no stamped meta entry must NOT be pushed (a fresh device pushing defaults could overwrite another device's settings). The regression test added to `sync-engine.test.ts` locks this in.
> - The committed test calls the tRPC procedures directly (`caller.sync.pull({ since })` / `caller.sync.push({ items })`) rather than the snippet's `.query()`/`.mutate()` forms, matching the repo's existing convention in `tests/sync-router.test.ts`.

- [x] **Step 1: Create the end-to-end test file**

Create `tests/sync-e2e.test.ts`:

```ts
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
  PriceAlert,
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
      loginMethod: "manus",
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

  async function syncDevice(storage: Storage): Promise<void> {
    await syncNow({
      storage,
      isSignedIn: () => true,
      pull: (since) => caller.sync.pull.query({ since }),
      push: (items) => caller.sync.push.mutate({ items }),
    });
  }

  it("round-trips watchlist, alerts, settings, and capped price history between two devices", async () => {
    const deviceA = makeDevice();
    const deviceB = makeDevice();

    const localListing = listing("d1", 100, "in_stock");
    localListing.priceHistory = [
      {
        date: new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10),
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
        date: new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10),
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
      pull: (since) => caller.sync.pull.query({ since }),
      push: (items) => caller.sync.push.mutate({ items }),
    });

    const otherDevice = makeDevice();
    await syncNow({
      storage: otherDevice,
      isSignedIn: () => true,
      pull: (since) => otherCaller.sync.pull.query({ since }),
      push: (items) => otherCaller.sync.push.mutate({ items }),
    });
    expect(await otherDevice.getWatchlist()).toEqual([]);
  });
});
```

- [x] **Step 2: Run the e2e tests to verify they pass**

Run: `TEST_DATABASE_URL="$(docker inspect promptgen-mysql --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^MYSQL_USER=//p'):$(docker inspect promptgen-mysql --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^MYSQL_PASSWORD=//p')@127.0.0.1:3307/stock_tracker_test" RUN_DB_TESTS=1 pnpm vitest run tests/sync-e2e.test.ts`

Expected: PASS (both tests).

- [x] **Step 3: Verify the tests are skipped without the flag**

Run: `pnpm vitest run tests/sync-e2e.test.ts`
Expected: PASS with the suite skipped.

- [x] **Step 4: Typecheck**

Run: `pnpm check`
Expected: 0 errors.

- [x] **Step 5: Commit**

```bash
git add tests/sync-e2e.test.ts
git commit -m "test(sync): add end-to-end sync test against real MySQL"
```

---

### Task 9: Final verification and checkpoint

**Files:** none (verification only)

- [x] **Step 1: Full non-DB verification**

Run: `pnpm check && pnpm lint && pnpm test`
Expected: 0 TS errors, lint clean, all non-DB tests pass (DB suites skipped).

- [x] **Step 2: Full DB verification**

Run: `TEST_DATABASE_URL="$(docker inspect promptgen-mysql --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^MYSQL_USER=//p'):$(docker inspect promptgen-mysql --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^MYSQL_PASSWORD=//p')@127.0.0.1:3307/stock_tracker_test" RUN_DB_TESTS=1 pnpm test`
Expected: all tests pass including `sync-db.test.ts` and `sync-e2e.test.ts`.

- [x] **Step 3: Update todo.md**

Append a new phase entry to `todo.md` summarizing the sync hardening work (match the existing phase style).

- [x] **Step 4: Commit**

```bash
git add todo.md
git commit -m "Checkpoint: v4.6: sync hardening (server-authoritative timestamps, capped price-history sync, retry/backoff, DB integration + e2e tests). TypeScript: 0 errors."
```

---

## Self-Review

**Spec coverage:**
- §2 Server-authoritative timestamps → Task 2 (server stamping) + Task 3 (client stamped-meta, cursor, offset correction).
- §3 Capped price-history sync → Task 4.
- §4 Offline retry/backoff + foreground retry → Task 5.
- §5 Server DB test coverage → Task 6 (script) + Task 7 (sync-db tests).
- §5 End-to-end integration test → Task 8.
- §6 Testing strategy (gates) → Task 9.

**Placeholder scan:** All steps contain complete code; no TBD/TODO; the two repetitive test-mock edits in Task 3 Step 6 use exact replace-all strings rather than placeholders.

**Type consistency:**
- `SyncStampedItem` (Task 1) is used by the `push` contract (Task 3), the router response (Task 2), and the client `doSync` (Task 3).
- `upsertSyncItem` returns `{ accepted: boolean; updatedAt: number }` everywhere it is called (Task 2 router).
- `PRICE_HISTORY_SYNC_DAYS` (Task 1) is used by `serializeItem` (the 30-day push cap); `applyLocalItem` merges with `PRICE_HISTORY_DAYS` (90) so a device's accumulated local history survives pulls (user-approved decision during Task 4 review).
- The `push` mock shape `{ accepted, stamped }` is consistent across all updated tests.