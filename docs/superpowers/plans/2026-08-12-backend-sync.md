# Backend Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the scaffolded Express + tRPC + Drizzle backend to the app so all user data (watchlist, price alerts, settings, back-order reminders + stock watches) syncs to the cloud and back across devices on mobile and the Tauri desktop app, with optional Manus OAuth login.

**Architecture:** Four new normalized Drizzle tables hold one JSON row per item keyed by `(userId, itemId)` with epoch-ms `updatedAtMs`/`deletedAtMs` sync metadata. A new `sync` tRPC router exposes `pull` (all rows changed since a cursor) and `push` (last-write-wins upserts) under `protectedProcedure`. A shared `lib/sync.ts` engine runs identically on mobile and desktop: pull → server-wins merge (preserving local `priceHistory`) → push dirty items → advance cursor, guarded by a single-flight lock. Mobile reuses the existing OAuth flow; desktop gets a localhost-loopback Tauri command (`start_oauth`) plus a new React Query tRPC client.

**Tech Stack:** tRPC v11, Drizzle ORM (MySQL), superjson, zod, React Query, Expo/React Native (AsyncStorage), Tauri v2 (Rust `tokio` TcpListener loopback), Vite + React.

---

## File Structure Map

```
Server
  drizzle/schema.ts            MODIFY — add 4 sync tables (watchlist_items, price_alerts, back_order_reminders, app_settings)
  server/sync-db.ts            CREATE — DB helpers: listChangedItems, upsertSyncItem, purgeOldTombstones
  server/routers.ts            MODIFY — add sync router (pull/push, protectedProcedure)
  tests/sync-router.test.ts    CREATE — no-DB no-op path tests

Shared client
  lib/types.ts                 MODIFY — add Collection, SyncItem, SyncMeta types
  lib/storage.ts               MODIFY — sync_meta key + helpers, onChange/setOnChange/setChangeSuppressed, clearAllData
  lib/sync.ts                  CREATE — shared sync engine (syncNow, setupSync)
  tests/storage.test.ts        MODIFY — sync_meta + onChange tests
  tests/sync-engine.test.ts    CREATE — engine unit tests

Mobile
  app/_layout.tsx              MODIFY — setupSync + launch sync on auth
  app/(tabs)/settings.tsx      MODIFY — Account section + sync status
  components/ui/icon-symbol.tsx MODIFY — 3 new icon mappings

Desktop
  desktop/package.json         MODIFY — add @tanstack/react-query, @trpc/*, superjson
  desktop/src/vite-env.d.ts    CREATE — vite/client types for import.meta.env
  desktop/src/lib/api-base.ts  CREATE — API base URL + OAuth portal helpers
  desktop/src/hooks/use-auth.ts CREATE — localStorage auth + useAuth hook + buildLoginUrl
  desktop/src/lib/trpc.ts      CREATE — React Query tRPC client
  desktop/src-tauri/src/lib.rs MODIFY — start_oauth command (loopback listener)
  desktop/src/App.tsx          MODIFY — trpc/QueryClient providers + setupSync + launch sync
  desktop/src/pages/Settings.tsx MODIFY — Account section + sync status
  desktop/tests/pages.test.tsx MODIFY — add getSyncMeta to storage mock
```

---

## Task 1: Drizzle schema — 4 sync tables

**Files:**

- Modify: `drizzle/schema.ts`
- Verify: generated `drizzle/0001_*.sql`

- [ ] **Step 1: Add the sync tables to `drizzle/schema.ts`**

Replace the `// TODO: Add your tables here` comment (line 35) with the tables below. Update the import from `drizzle-orm/mysql-core` to include `bigint`, `json`, `primaryKey`.

```ts
export const watchlistItems = mysqlTable(
  "watchlist_items",
  {
    userId: int("userId")
      .notNull()
      .references(() => users.id),
    productId: varchar("productId", { length: 191 }).notNull(),
    data: json("data").notNull(),
    updatedAtMs: bigint("updatedAtMs", { mode: "number" }).notNull(),
    deletedAtMs: bigint("deletedAtMs", { mode: "number" }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.productId] })],
);

export const priceAlerts = mysqlTable(
  "price_alerts",
  {
    userId: int("userId")
      .notNull()
      .references(() => users.id),
    alertId: varchar("alertId", { length: 191 }).notNull(),
    data: json("data").notNull(),
    updatedAtMs: bigint("updatedAtMs", { mode: "number" }).notNull(),
    deletedAtMs: bigint("deletedAtMs", { mode: "number" }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.alertId] })],
);

export const backOrderReminders = mysqlTable(
  "back_order_reminders",
  {
    userId: int("userId")
      .notNull()
      .references(() => users.id),
    reminderId: varchar("reminderId", { length: 191 }).notNull(),
    data: json("data").notNull(),
    updatedAtMs: bigint("updatedAtMs", { mode: "number" }).notNull(),
    deletedAtMs: bigint("deletedAtMs", { mode: "number" }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.reminderId] })],
);

export const appSettings = mysqlTable("app_settings", {
  userId: int("userId")
    .notNull()
    .references(() => users.id)
    .primaryKey(),
  data: json("data").notNull(),
  updatedAtMs: bigint("updatedAtMs", { mode: "number" }).notNull(),
  deletedAtMs: bigint("deletedAtMs", { mode: "number" }),
});

export type WatchlistItem = typeof watchlistItems.$inferSelect;
export type InsertWatchlistItem = typeof watchlistItems.$inferInsert;
export type PriceAlertRow = typeof priceAlerts.$inferSelect;
export type InsertPriceAlertRow = typeof priceAlerts.$inferInsert;
export type BackOrderReminderRow = typeof backOrderReminders.$inferSelect;
export type InsertBackOrderReminderRow = typeof backOrderReminders.$inferInsert;
export type AppSettingsRow = typeof appSettings.$inferSelect;
export type InsertAppSettingsRow = typeof appSettings.$inferInsert;
```

The `json("data")` column maps to MySQL `json` and its inferred type is `unknown` (verified in `node_modules/drizzle-orm/mysql-core/columns/json.d.ts`), so `data` accepts any JSON payload.

- [ ] **Step 2: Generate the migration SQL**

Run (dummy URL is fine — `generate` reads the schema, it does not connect):

```bash
DATABASE_URL=mysql://root:root@localhost:3306/product_stock_finder pnpm exec drizzle-kit generate
```

Expected: a new file `drizzle/0001_*.sql` is created and `drizzle/meta/_journal.json` gains an entry. Verify the SQL matches this shape (adjust only if drizzle-kit emits a different-but-equivalent form):

```sql
CREATE TABLE `watchlist_items` (
	`userId` int NOT NULL,
	`productId` varchar(191) NOT NULL,
	`data` json NOT NULL,
	`updatedAtMs` bigint NOT NULL,
	`deletedAtMs` bigint,
	CONSTRAINT `watchlist_items_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action,
	CONSTRAINT `watchlist_items_userId_productId_pk` PRIMARY KEY(`userId`,`productId`)
);
```

and the analogous tables for `price_alerts`, `back_order_reminders`, `app_settings` (the latter with `CONSTRAINT \`app_settings_userId_pk\` PRIMARY KEY(\`userId\`)`).

- [ ] **Step 3: Typecheck**

Run: `pnpm check`
Expected: PASS (0 errors).

- [ ] **Step 4: Commit**

```bash
git add drizzle/schema.ts drizzle/0001_*.sql drizzle/meta/_journal.json
git commit -m "feat(server): add sync drizzle tables (watchlist/alerts/reminders/settings)"
```

---

## Task 2: Server sync DB helpers — `server/sync-db.ts`

**Files:**

- Create: `server/sync-db.ts`

- [ ] **Step 1: Write `server/sync-db.ts`**

```ts
import { and, eq, gt, lt, or } from "drizzle-orm";
import {
  appSettings,
  backOrderReminders,
  priceAlerts,
  watchlistItems,
} from "../drizzle/schema";
import { getDb } from "./db";
import type { Collection, SyncItem } from "../lib/types";

const TOMBSTONE_PURGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Returns all rows for the user whose updatedAtMs OR deletedAtMs is newer than
 * `since` (epoch ms). `since === null` means first sync (return everything).
 * Tombstoned rows carry `data: null` so the client only needs the deletion.
 */
export async function listChangedItems(
  userId: number,
  since: number | null,
): Promise<SyncItem[]> {
  const db = await getDb();
  if (!db) return [];
  const sinceMs = since ?? 0;
  const changed = (updatedAtMs: unknown, deletedAtMs: unknown) =>
    or(gt(updatedAtMs, sinceMs), gt(deletedAtMs, sinceMs));

  const [watchlist, alerts, reminders, settings] = await Promise.all([
    db
      .select()
      .from(watchlistItems)
      .where(
        and(
          eq(watchlistItems.userId, userId),
          changed(watchlistItems.updatedAtMs, watchlistItems.deletedAtMs),
        ),
      ),
    db
      .select()
      .from(priceAlerts)
      .where(
        and(
          eq(priceAlerts.userId, userId),
          changed(priceAlerts.updatedAtMs, priceAlerts.deletedAtMs),
        ),
      ),
    db
      .select()
      .from(backOrderReminders)
      .where(
        and(
          eq(backOrderReminders.userId, userId),
          changed(
            backOrderReminders.updatedAtMs,
            backOrderReminders.deletedAtMs,
          ),
        ),
      ),
    db
      .select()
      .from(appSettings)
      .where(
        and(
          eq(appSettings.userId, userId),
          changed(appSettings.updatedAtMs, appSettings.deletedAtMs),
        ),
      ),
  ]);

  const items: SyncItem[] = [];
  for (const row of watchlist) {
    items.push({
      collection: "watchlist",
      id: row.productId,
      data: row.deletedAtMs === null ? row.data : null,
      updatedAt: row.updatedAtMs,
      deletedAt: row.deletedAtMs,
    });
  }
  for (const row of alerts) {
    items.push({
      collection: "alerts",
      id: row.alertId,
      data: row.deletedAtMs === null ? row.data : null,
      updatedAt: row.updatedAtMs,
      deletedAt: row.deletedAtMs,
    });
  }
  for (const row of reminders) {
    items.push({
      collection: "reminders",
      id: row.reminderId,
      data: row.deletedAtMs === null ? row.data : null,
      updatedAt: row.updatedAtMs,
      deletedAt: row.deletedAtMs,
    });
  }
  for (const row of settings) {
    items.push({
      collection: "settings",
      id: "settings",
      data: row.deletedAtMs === null ? row.data : null,
      updatedAt: row.updatedAtMs,
      deletedAt: row.deletedAtMs,
    });
  }
  return items;
}

/**
 * Last-write-wins upsert. Returns true when the incoming item was accepted
 * (row absent, or incoming.updatedAt strictly newer than the existing row).
 * Tombstoned items (deletedAt set) are soft-deleted so pull can propagate them.
 */
export async function upsertSyncItem(
  userId: number,
  item: SyncItem,
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

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
        return false;
      }
      await db
        .insert(watchlistItems)
        .values({
          userId,
          productId: item.id,
          data: item.data,
          updatedAtMs: item.updatedAt,
          deletedAtMs: item.deletedAt,
        })
        .onDuplicateKeyUpdate({
          set: {
            data: item.data,
            updatedAtMs: item.updatedAt,
            deletedAtMs: item.deletedAt,
          },
        });
      return true;
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
        return false;
      }
      await db
        .insert(priceAlerts)
        .values({
          userId,
          alertId: item.id,
          data: item.data,
          updatedAtMs: item.updatedAt,
          deletedAtMs: item.deletedAt,
        })
        .onDuplicateKeyUpdate({
          set: {
            data: item.data,
            updatedAtMs: item.updatedAt,
            deletedAtMs: item.deletedAt,
          },
        });
      return true;
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
        return false;
      }
      await db
        .insert(backOrderReminders)
        .values({
          userId,
          reminderId: item.id,
          data: item.data,
          updatedAtMs: item.updatedAt,
          deletedAtMs: item.deletedAt,
        })
        .onDuplicateKeyUpdate({
          set: {
            data: item.data,
            updatedAtMs: item.updatedAt,
            deletedAtMs: item.deletedAt,
          },
        });
      return true;
    }
    case "settings": {
      const existing = await db
        .select({ updatedAtMs: appSettings.updatedAtMs })
        .from(appSettings)
        .where(eq(appSettings.userId, userId))
        .limit(1);
      if (existing.length > 0 && existing[0]!.updatedAtMs >= item.updatedAt) {
        return false;
      }
      await db
        .insert(appSettings)
        .values({
          userId,
          data: item.data,
          updatedAtMs: item.updatedAt,
          deletedAtMs: item.deletedAt,
        })
        .onDuplicateKeyUpdate({
          set: {
            data: item.data,
            updatedAtMs: item.updatedAt,
            deletedAtMs: item.deletedAt,
          },
        });
      return true;
    }
  }
}

/** Hard-deletes tombstoned rows older than the cutoff (epoch ms). */
export async function purgeOldTombstones(
  userId: number,
  cutoff: number,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await Promise.all([
    db
      .delete(watchlistItems)
      .where(
        and(
          eq(watchlistItems.userId, userId),
          lt(watchlistItems.deletedAtMs, cutoff),
        ),
      ),
    db
      .delete(priceAlerts)
      .where(
        and(
          eq(priceAlerts.userId, userId),
          lt(priceAlerts.deletedAtMs, cutoff),
        ),
      ),
    db
      .delete(backOrderReminders)
      .where(
        and(
          eq(backOrderReminders.userId, userId),
          lt(backOrderReminders.deletedAtMs, cutoff),
        ),
      ),
    db
      .delete(appSettings)
      .where(
        and(
          eq(appSettings.userId, userId),
          lt(appSettings.deletedAtMs, cutoff),
        ),
      ),
  ]);
}

export const TOMBSTONE_PURGE_WINDOW_MS = TOMBSTONE_PURGE_MS;
```

Note: `TOMBSTONE_PURGE_MS` is exported via `TOMBSTONE_PURGE_WINDOW_MS` for potential reuse; if `pnpm lint` flags the unused private const, drop the private const and inline the literal in the export. If `data: item.data` (type `unknown`) fails to assign to the `json` column, cast to `item.data as unknown`.

- [ ] **Step 2: Typecheck**

Run: `pnpm check`
Expected: PASS (0 errors).

- [ ] **Step 3: Commit**

```bash
git add server/sync-db.ts
git commit -m "feat(server): add sync DB helpers (listChangedItems/upsertSyncItem/purgeOldTombstones)"
```

---

## Task 3: tRPC sync router + tests

**Files:**

- Create: `tests/sync-router.test.ts`
- Modify: `server/routers.ts`

- [ ] **Step 1: Write the failing test `tests/sync-router.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role: "user",
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
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("sync router", () => {
  it("pull returns empty items when DB is unavailable", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.sync.pull({ since: null });
    expect(result.items).toEqual([]);
    expect(typeof result.lastSyncedAt).toBe("number");
  });

  it("push accepts nothing when DB is unavailable", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.sync.push({ items: [] });
    expect(result).toEqual({ accepted: 0 });
  });
});
```

These tests rely on `getDb()` returning `null` because `DATABASE_URL` is unset in the vitest environment (same no-DB path the app hits in local-only deployments).

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/sync-router.test.ts`
Expected: FAIL — `caller.sync` is `undefined` (router not added yet).

- [ ] **Step 3: Add the sync router to `server/routers.ts`**

Update the imports and replace the `// TODO: add feature routers here` comment block:

```ts
import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import {
  listChangedItems,
  purgeOldTombstones,
  upsertSyncItem,
} from "./sync-db";

const syncItemSchema = z.object({
  collection: z.enum(["watchlist", "alerts", "reminders", "settings"]),
  id: z.string(),
  data: z.unknown(),
  updatedAt: z.number(),
  deletedAt: z.number().nullable(),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  sync: router({
    pull: protectedProcedure
      .input(z.object({ since: z.number().nullable() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) {
          console.warn("[Sync] Database not available; returning empty pull");
          return { lastSyncedAt: Date.now(), items: [] };
        }
        const items = await listChangedItems(ctx.user.id, input.since);
        return { lastSyncedAt: Date.now(), items };
      }),
    push: protectedProcedure
      .input(z.object({ items: z.array(syncItemSchema) }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) {
          console.warn("[Sync] Database not available; accepting nothing");
          return { accepted: 0 };
        }
        let accepted = 0;
        for (const item of input.items) {
          if (await upsertSyncItem(ctx.user.id, item)) accepted += 1;
        }
        await purgeOldTombstones(
          ctx.user.id,
          Date.now() - 30 * 24 * 60 * 60 * 1000,
        );
        return { accepted };
      }),
  }),
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run tests/sync-router.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Full verification**

Run: `pnpm check` and `pnpm test`
Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add server/routers.ts tests/sync-router.test.ts
git commit -m "feat(server): add sync tRPC router (pull/push, protected)"
```

---

## Task 4: Shared types — `lib/types.ts`

**Files:**

- Modify: `lib/types.ts`

- [ ] **Step 1: Append the shared sync types**

Add at the end of `lib/types.ts`:

```ts
export type Collection = "watchlist" | "alerts" | "reminders" | "settings";

export interface SyncItem {
  collection: Collection;
  id: string;
  data: unknown;
  updatedAt: number;
  deletedAt: number | null;
}

export interface SyncMeta {
  lastSyncedAt: number;
  items: Record<
    string,
    Record<string, { updatedAt: number; deleted: boolean }>
  >;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat(shared): add Collection/SyncItem/SyncMeta types"
```

---

## Task 5: Storage — `sync_meta` key, helpers, onChange wiring

**Files:**

- Modify: `lib/storage.ts`
- Modify: `tests/storage.test.ts`

- [ ] **Step 1: Write the failing tests in `tests/storage.test.ts`**

Add `createStorage` to the import from `../lib/storage` (keep the existing named imports), then append these two `describe` blocks:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run tests/storage.test.ts`
Expected: FAIL — `getSyncMeta`/`setItemSyncMeta`/`markItemDeleted`/`clearItemSyncMeta`/`saveSyncMeta` are not exported yet.

- [ ] **Step 3: Implement the storage changes in `lib/storage.ts`**

(a) Update the import to bring in the `Collection` type:

```ts
import {
  Product,
  PriceAlert,
  AppSettings,
  DistributorListing,
  BackOrderReminder,
} from "./types";
import type { Collection, SyncMeta } from "./types";
```

(b) Change the `createStorage` signature and add the sync-meta machinery. Replace the current signature line and the `writeQueues` block preamble:

```ts
export function createStorage(
  adapter: StorageAdapter,
  opts?: { onChange?: (collection: Collection, itemId: string) => void },
) {
  const KEYS = {
    WATCHLIST: "watchlist_products",
    ALERTS: "price_alerts",
    SETTINGS: "app_settings",
    REMINDERS: "back_order_reminders",
    STOCK_WATCHES: "back_in_stock_watches",
    DIGEST_SNAPSHOT: "price_digest_snapshot",
    SYNC_META: "sync_meta",
  };

  let onChange = opts?.onChange ?? null;
  let suppressChange = false;

  function notify(collection: Collection, itemId: string) {
    if (!suppressChange && onChange) onChange(collection, itemId);
  }

  function setOnChange(
    fn: ((collection: Collection, itemId: string) => void) | null,
  ) {
    onChange = fn;
  }

  function setChangeSuppressed(flag: boolean) {
    suppressChange = flag;
  }
```

(c) Add the sync-meta helpers (place them in a new `// ─── Sync Meta ───` section before `// ─── Clear All Data ───`):

```ts
// ─── Sync Meta ─────────────────────────────────────────────────────────────

async function getSyncMeta(): Promise<SyncMeta> {
  try {
    const raw = await adapter.getItem(KEYS.SYNC_META);
    if (!raw) return { lastSyncedAt: 0, items: {} };
    const parsed = JSON.parse(raw);
    return {
      lastSyncedAt:
        typeof parsed.lastSyncedAt === "number" ? parsed.lastSyncedAt : 0,
      items: parsed.items ?? {},
    };
  } catch {
    return { lastSyncedAt: 0, items: {} };
  }
}

async function saveSyncMeta(meta: SyncMeta): Promise<void> {
  await adapter.setItem(KEYS.SYNC_META, JSON.stringify(meta));
}

function updateItemMeta(
  collection: Collection,
  id: string,
  patch: { updatedAt: number; deleted: boolean },
): Promise<void> {
  return enqueue(KEYS.SYNC_META, async () => {
    const meta = await getSyncMeta();
    const col = meta.items[collection] ?? {};
    col[id] = patch;
    meta.items[collection] = col;
    await saveSyncMeta(meta);
  });
}

async function setItemSyncMeta(
  collection: Collection,
  id: string,
  updatedAt: number,
): Promise<void> {
  await updateItemMeta(collection, id, { updatedAt, deleted: false });
}

async function markItemDeleted(
  collection: Collection,
  id: string,
  updatedAt: number,
): Promise<void> {
  await updateItemMeta(collection, id, { updatedAt, deleted: true });
}

async function clearItemSyncMeta(
  collection: Collection,
  id: string,
): Promise<void> {
  await enqueue(KEYS.SYNC_META, async () => {
    const meta = await getSyncMeta();
    const col = meta.items[collection];
    if (col && col[id]) {
      delete col[id];
      await saveSyncMeta(meta);
    }
  });
}
```

(d) Fire `notify(...)` from the semantic mutations. Apply these exact edits:

- `addToWatchlist` — inside the `if (!exists)` block, after `await saveWatchlist(list);`:

```ts
notify("watchlist", product.id);
```

- `removeFromWatchlist` — replace the body so it only notifies when something was removed:

```ts
async function removeFromWatchlist(productId: string): Promise<void> {
  await enqueue(KEYS.WATCHLIST, async () => {
    const list = await getWatchlist();
    const next = list.filter((p) => p.id !== productId);
    if (next.length !== list.length) {
      await saveWatchlist(next);
      notify("watchlist", productId);
    }
  });
}
```

- `updateProductListings` — after `await saveWatchlist(updated);`:

```ts
notify("watchlist", productId);
```

- `refreshWatchlistPrices` — after `await saveWatchlist(updated);`:

```ts
for (const p of updated) notify("watchlist", p.id);
```

- `addAlert` — after `await saveAlerts(alerts);`:

```ts
notify("alerts", alert.id);
```

- `removeAlert` — after `await saveAlerts(...)`:

```ts
notify("alerts", alertId);
```

- `toggleAlert`, `rearmAlert`, `deactivateAlert` — after their `await saveAlerts(updated);`:

```ts
notify("alerts", alertId);
```

- `saveSettings` — after `await adapter.setItem(KEYS.SETTINGS, ...)`:

```ts
notify("settings", "settings");
```

- `addBackOrderReminder` — after `await saveBackOrderReminders(reminders);`:

```ts
notify("reminders", reminder.id);
```

- `removeBackOrderReminder` — after `await saveBackOrderReminders(...)`:

```ts
notify("reminders", reminderId);
```

- `addStockWatch` — after `await saveStockWatches(watches);`:

```ts
notify("reminders", watch.id);
```

- `removeStockWatch` — after `await saveStockWatches(...)`:

```ts
notify("reminders", watchId);
```

- `updateStockWatchStatus` — replace the body to capture the target id:

```ts
async function updateStockWatchStatus(
  productId: string,
  distributorId: string,
  status: string,
): Promise<void> {
  await enqueue(KEYS.STOCK_WATCHES, async () => {
    const watches = await getStockWatches();
    let targetId: string | null = null;
    const updated = watches.map((w) => {
      if (w.productId === productId && w.distributorId === distributorId) {
        targetId = w.id;
        return { ...w, lastKnownStatus: status };
      }
      return w;
    });
    await saveStockWatches(updated);
    if (targetId) notify("reminders", targetId);
  });
}
```

(e) Add `"sync_meta"` to the `clearAllData` `multiRemove` array.

(f) Add the new functions to the returned object and to the destructured named exports:

```ts
return {
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
  deactivateAlert,
  getSettings,
  saveSettings,
  getBackOrderReminders,
  saveBackOrderReminders,
  addBackOrderReminder,
  removeBackOrderReminder,
  getStockWatches,
  saveStockWatches,
  addStockWatch,
  removeStockWatch,
  updateStockWatchStatus,
  getPriceDigestSnapshot,
  savePriceDigestSnapshot,
  getSyncMeta,
  saveSyncMeta,
  setItemSyncMeta,
  markItemDeleted,
  clearItemSyncMeta,
  setOnChange,
  setChangeSuppressed,
  clearAllData,
};
```

(g) Export the default instance and add the new named exports to the destructure:

```ts
export const defaultStorage = createStorage(AsyncStorage);

export const {
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
  deactivateAlert,
  getSettings,
  saveSettings,
  getBackOrderReminders,
  saveBackOrderReminders,
  addBackOrderReminder,
  removeBackOrderReminder,
  getStockWatches,
  saveStockWatches,
  addStockWatch,
  removeStockWatch,
  updateStockWatchStatus,
  getPriceDigestSnapshot,
  savePriceDigestSnapshot,
  getSyncMeta,
  saveSyncMeta,
  setItemSyncMeta,
  markItemDeleted,
  clearItemSyncMeta,
  setOnChange,
  setChangeSuppressed,
  clearAllData,
} = defaultStorage;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run tests/storage.test.ts`
Expected: PASS (all existing + new tests).

- [ ] **Step 5: Full verification**

Run: `pnpm check` and `pnpm test`
Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/storage.ts tests/storage.test.ts
git commit -m "feat(storage): add sync_meta key, helpers, and onChange wiring"
```

---

## Task 6: Sync engine tests — `tests/sync-engine.test.ts`

**Files:**

- Create: `tests/sync-engine.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
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
    const pull = vi.fn(async () => ({
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
    const push = vi.fn(async () => ({ accepted: 0 }));
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
    const pull = vi.fn(async () => ({
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
    const push = vi.fn(async () => ({ accepted: 0 }));
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
    const pull = vi.fn(async () => ({
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
    const push = vi.fn(async () => ({ accepted: 1 }));
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
    const pull = vi.fn(async () => ({
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
    const push = vi.fn(async () => ({ accepted: 0 }));
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
        date: "2026-01-01",
        price: 100,
        currency: "USD",
        stockStatus: "in_stock",
      },
    ];
    await storage.addToWatchlist(makeProduct("p1", [localListing]));
    await storage.setItemSyncMeta("watchlist", "p1", 1000);
    const serverProduct = makeProduct("p1", [listing("d1", 90, "in_stock")]);
    const pull = vi.fn(async () => ({
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
    const push = vi.fn(async () => ({ accepted: 0 }));
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
      {
        date: "2026-01-01",
        price: 100,
        currency: "USD",
        stockStatus: "in_stock",
      },
    ];
    await storage.addToWatchlist(makeProduct("p1", [localListing]));
    const pull = vi.fn(async () => ({ lastSyncedAt: 2000, items: [] }));
    const push = vi.fn(async () => ({ accepted: 1 }));
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
    expect(pushed[0]!.data.listings[0]!.priceHistory).toBeUndefined();
    const meta = await storage.getSyncMeta();
    expect(meta.lastSyncedAt).toBe(3000);
  });

  it("keeps lastSyncedAt unchanged when push fails", async () => {
    const storage = makeStorage();
    await storage.addToWatchlist(makeProduct("p1"));
    const pull = vi.fn(async () => ({ lastSyncedAt: 2000, items: [] }));
    const push = vi.fn(async () => {
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
    const push = vi.fn(async () => ({ accepted: 0 }));
    const opts = {
      storage,
      isSignedIn: () => true,
      pull,
      push,
      now: () => 1000,
    };
    const p1 = syncNow(opts);
    const p2 = syncNow(opts);
    resolvePull!({ lastSyncedAt: 2000, items: [] });
    await Promise.all([p1, p2]);
    expect(pull).toHaveBeenCalledTimes(1);
  });

  it("merges settings single-object", async () => {
    const storage = makeStorage();
    await storage.saveSettings({ ...DEFAULT_SETTINGS, displayCurrency: "EUR" });
    await storage.setItemSyncMeta("settings", "settings", 1000);
    const serverSettings = { ...DEFAULT_SETTINGS, displayCurrency: "GBP" };
    const pull = vi.fn(async () => ({
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
    const push = vi.fn(async () => ({ accepted: 0 }));
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
    const pull = vi.fn(async () => ({
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
    const push = vi.fn(async () => ({ accepted: 0 }));
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
    const push = vi.fn(async () => ({ accepted: 1 }));
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run tests/sync-engine.test.ts`
Expected: FAIL — `../lib/sync` does not exist.

- [ ] **Step 3: Commit the failing tests (red)**

```bash
git add tests/sync-engine.test.ts
git commit -m "test(sync): add failing sync engine tests"
```

---

## Task 7: Sync engine — `lib/sync.ts`

**Files:**

- Create: `lib/sync.ts`

- [ ] **Step 1: Implement `lib/sync.ts`**

```ts
import type { Storage } from "./storage";
import type {
  AppSettings,
  BackOrderReminder,
  Collection,
  PriceAlert,
  Product,
  SyncItem,
} from "./types";

export interface SyncNowOptions {
  storage: Storage;
  isSignedIn: () => boolean;
  pull: (
    since: number | null,
  ) => Promise<{ lastSyncedAt: number; items: SyncItem[] }>;
  push: (items: SyncItem[]) => Promise<{ accepted: number }>;
  now?: () => number;
}

export interface SyncSetup {
  syncNow: () => Promise<void>;
  schedule: () => void;
}

const COLLECTIONS: Collection[] = [
  "watchlist",
  "alerts",
  "reminders",
  "settings",
];
const SETTINGS_ID = "settings";

let inFlight: Promise<void> | null = null;

export async function syncNow(opts: SyncNowOptions): Promise<void> {
  if (!opts.isSignedIn()) return;
  if (inFlight) return inFlight;
  inFlight = doSync(opts).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function doSync(opts: SyncNowOptions): Promise<void> {
  const now = opts.now ?? Date.now;
  const storage = opts.storage;
  const meta = await storage.getSyncMeta();
  const oldCursor = meta.lastSyncedAt || 0;
  const since = meta.lastSyncedAt || null;

  let pulled: { lastSyncedAt: number; items: SyncItem[] };
  try {
    pulled = await opts.pull(since);
  } catch (error) {
    console.warn("[Sync] Pull failed; skipping sync", error);
    return;
  }

  const applied = new Set<string>();
  storage.setChangeSuppressed(true);
  try {
    for (const item of pulled.items) {
      const key = `${item.collection}:${item.id}`;
      const local = meta.items[item.collection]?.[item.id];
      if (item.deletedAt !== null) {
        if (!local || item.updatedAt > local.updatedAt) {
          await removeLocalItem(storage, item.collection, item.id);
          await storage.clearItemSyncMeta(item.collection, item.id);
          applied.add(key);
        }
      } else if (!local || item.updatedAt > local.updatedAt) {
        await applyLocalItem(storage, item.collection, item.data);
        await storage.setItemSyncMeta(item.collection, item.id, item.updatedAt);
        applied.add(key);
      }
    }
  } finally {
    storage.setChangeSuppressed(false);
  }

  const dirty = await collectDirty(storage, oldCursor, applied, now);

  if (dirty.length > 0) {
    try {
      await opts.push(dirty);
    } catch (error) {
      console.warn("[Sync] Push failed; local changes kept", error);
      return;
    }
    const metaAfter = await storage.getSyncMeta();
    for (const item of dirty) {
      const col = metaAfter.items[item.collection] ?? {};
      col[item.id] = {
        updatedAt: item.updatedAt,
        deleted: item.deletedAt !== null,
      };
      metaAfter.items[item.collection] = col;
    }
    await storage.saveSyncMeta(metaAfter);
  }

  const nextCursor = Math.max(pulled.lastSyncedAt, now());
  await storage.saveSyncMeta({
    ...(await storage.getSyncMeta()),
    lastSyncedAt: nextCursor,
  });
}

async function collectDirty(
  storage: Storage,
  oldCursor: number,
  applied: Set<string>,
  now: () => number,
): Promise<SyncItem[]> {
  const meta = await storage.getSyncMeta();
  const dirty: SyncItem[] = [];
  const keyOf = (c: Collection, id: string) => `${c}:${id}`;
  const local = await collectLocalState(storage);

  for (const collection of COLLECTIONS) {
    if (collection === "settings") {
      const key = keyOf("settings", SETTINGS_ID);
      if (applied.has(key)) continue;
      const entry = meta.items.settings?.[SETTINGS_ID];
      if (!entry || entry.updatedAt > oldCursor) {
        dirty.push({
          collection: "settings",
          id: SETTINGS_ID,
          data: local.settings,
          updatedAt: now(),
          deletedAt: null,
        });
      }
      continue;
    }
    const items = local[collection] as { id: string }[];
    for (const item of items) {
      const key = keyOf(collection, item.id);
      if (applied.has(key)) continue;
      const entry = meta.items[collection]?.[item.id];
      if (!entry || entry.updatedAt > oldCursor || entry.deleted) {
        dirty.push({
          collection,
          id: item.id,
          data: serializeItem(collection, item),
          updatedAt: now(),
          deletedAt: null,
        });
        if (entry?.deleted) {
          await storage.setItemSyncMeta(collection, item.id, now());
        }
      }
    }
  }

  for (const collection of ["watchlist", "alerts", "reminders"] as const) {
    const colMeta = meta.items[collection] ?? {};
    const localItems = local[collection] as { id: string }[];
    for (const [id, entry] of Object.entries(colMeta)) {
      if (!entry.deleted) continue;
      const key = keyOf(collection, id);
      if (applied.has(key)) continue;
      if (localItems.some((item) => item.id === id)) continue;
      if (entry.updatedAt > oldCursor) {
        dirty.push({
          collection,
          id,
          data: null,
          updatedAt: entry.updatedAt,
          deletedAt: entry.updatedAt,
        });
      } else {
        await storage.clearItemSyncMeta(collection, id);
      }
    }
  }

  return dirty;
}

async function collectLocalState(storage: Storage): Promise<{
  watchlist: Product[];
  alerts: PriceAlert[];
  reminders: BackOrderReminder[];
  settings: AppSettings;
}> {
  const [watchlist, alerts, reminders, stockWatches, settings] =
    await Promise.all([
      storage.getWatchlist(),
      storage.getAlerts(),
      storage.getBackOrderReminders(),
      storage.getStockWatches(),
      storage.getSettings(),
    ]);
  return {
    watchlist,
    alerts,
    reminders: [...reminders, ...stockWatches],
    settings,
  };
}

function serializeItem(collection: Collection, item: unknown): unknown {
  if (collection !== "watchlist") return item;
  const product = item as Product;
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
    })),
  };
}

async function applyLocalItem(
  storage: Storage,
  collection: Collection,
  data: unknown,
): Promise<void> {
  switch (collection) {
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
            return local ? { ...l, priceHistory: local.priceHistory } : l;
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
    case "alerts": {
      const incoming = data as PriceAlert;
      const alerts = await storage.getAlerts();
      const existing = alerts.find((a) => a.id === incoming.id);
      if (existing) {
        await storage.saveAlerts(
          alerts.map((a) => (a.id === incoming.id ? incoming : a)),
        );
      } else {
        await storage.saveAlerts([...alerts, incoming]);
      }
      break;
    }
    case "reminders": {
      const incoming = data as BackOrderReminder;
      const targetWatches = incoming.reminderType === "back_in_stock";
      const reminders = await storage.getBackOrderReminders();
      const watches = await storage.getStockWatches();
      if (targetWatches) {
        const existing = watches.find((w) => w.id === incoming.id);
        await storage.saveStockWatches(
          existing
            ? watches.map((w) => (w.id === incoming.id ? incoming : w))
            : [...watches, incoming],
        );
      } else {
        const existing = reminders.find((r) => r.id === incoming.id);
        await storage.saveBackOrderReminders(
          existing
            ? reminders.map((r) => (r.id === incoming.id ? incoming : r))
            : [...reminders, incoming],
        );
      }
      break;
    }
    case "settings": {
      await storage.saveSettings(data as AppSettings);
      break;
    }
  }
}

async function removeLocalItem(
  storage: Storage,
  collection: Collection,
  id: string,
): Promise<void> {
  switch (collection) {
    case "watchlist": {
      const list = await storage.getWatchlist();
      await storage.saveWatchlist(list.filter((p) => p.id !== id));
      break;
    }
    case "alerts": {
      const alerts = await storage.getAlerts();
      await storage.saveAlerts(alerts.filter((a) => a.id !== id));
      break;
    }
    case "reminders": {
      const reminders = await storage.getBackOrderReminders();
      const watches = await storage.getStockWatches();
      await storage.saveBackOrderReminders(
        reminders.filter((r) => r.id !== id),
      );
      await storage.saveStockWatches(watches.filter((w) => w.id !== id));
      break;
    }
    case "settings":
      break;
  }
}

async function itemExists(
  storage: Storage,
  collection: Collection,
  id: string,
): Promise<boolean> {
  switch (collection) {
    case "watchlist":
      return (await storage.getWatchlist()).some((p) => p.id === id);
    case "alerts":
      return (await storage.getAlerts()).some((a) => a.id === id);
    case "reminders":
      return (
        (await storage.getBackOrderReminders()).some((r) => r.id === id) ||
        (await storage.getStockWatches()).some((w) => w.id === id)
      );
    case "settings":
      return true;
  }
}

async function markDirty(
  storage: Storage,
  collection: Collection,
  id: string,
): Promise<void> {
  const now = Date.now();
  const exists = await itemExists(storage, collection, id);
  if (exists) {
    await storage.setItemSyncMeta(collection, id, now);
  } else {
    await storage.markItemDeleted(collection, id, now);
  }
}

export function setupSync(
  opts: SyncNowOptions & { debounceMs?: number },
): SyncSetup {
  const debounceMs = opts.debounceMs ?? 2000;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const run = () => {
    timer = null;
    syncNow(opts).catch((error) => {
      console.warn("[Sync] Background sync failed", error);
    });
  };
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(run, debounceMs);
  };
  const runNow = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    return syncNow(opts);
  };
  opts.storage.setOnChange((collection, itemId) => {
    markDirty(opts.storage, collection, itemId).then(() => schedule());
  });
  return { syncNow: runNow, schedule };
}
```

- [ ] **Step 2: Run the tests to verify they pass**

Run: `pnpm vitest run tests/sync-engine.test.ts`
Expected: PASS (all 12 tests).

- [ ] **Step 3: Full verification**

Run: `pnpm check` and `pnpm test`
Expected: both PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/sync.ts
git commit -m "feat(sync): add shared sync engine (pull/merge/push, single-flight)"
```

---

## Task 8: Mobile launch sync — `app/_layout.tsx`

**Files:**

- Modify: `app/_layout.tsx`

- [ ] **Step 1: Add imports**

Add `useRef` to the react import, and add these imports:

```ts
import { useAuth } from "@/hooks/use-auth";
import { defaultStorage } from "@/lib/storage";
import { setupSync, type SyncSetup } from "@/lib/sync";
```

- [ ] **Step 2: Wire auth + sync inside `RootLayout`**

After the `const [trpcClient] = useState(() => createTRPCClient());` line, add:

```tsx
const { isAuthenticated } = useAuth();
const isAuthenticatedRef = useRef(isAuthenticated);
isAuthenticatedRef.current = isAuthenticated;
const syncRef = useRef<SyncSetup | null>(null);

useEffect(() => {
  syncRef.current = setupSync({
    storage: defaultStorage,
    isSignedIn: () => isAuthenticatedRef.current,
    pull: (since) => trpcClient.query("sync.pull", { since }),
    push: (items) => trpcClient.mutate("sync.push", { items }),
  });
}, [trpcClient]);

useEffect(() => {
  if (isAuthenticated) syncRef.current?.syncNow();
}, [isAuthenticated]);
```

- [ ] **Step 3: Verify**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat(mobile): trigger sync on launch and auth change"
```

---

## Task 9: Mobile Settings — Account section + sync status

**Files:**

- Modify: `app/(tabs)/settings.tsx`
- Modify: `components/ui/icon-symbol.tsx`

- [ ] **Step 1: Add icon mappings to `components/ui/icon-symbol.tsx`**

Add to the `MAPPING` object (alphabetical-ish, near the other entries):

```ts
  "person.crop.circle.fill": "account-circle",
  "person.crop.circle.badge.plus": "person-add",
  "arrow.triangle.2.circlepath": "sync",
```

- [ ] **Step 2: Add imports to `app/(tabs)/settings.tsx`**

```ts
import { startOAuthLogin } from "@/constants/oauth";
import { useAuth } from "@/hooks/use-auth";
import { getSyncMeta } from "@/lib/storage";
```

- [ ] **Step 3: Add auth + sync-status state inside `SettingsScreen`**

After the existing `const [products, setProducts] = useState<Product[]>([]);` line, add:

```tsx
const { user, isAuthenticated, logout } = useAuth();
const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

useEffect(() => {
  let cancelled = false;
  const refresh = async () => {
    const meta = await getSyncMeta();
    if (!cancelled) setLastSyncedAt(meta.lastSyncedAt || null);
  };
  refresh();
  const interval = setInterval(refresh, 30000);
  return () => {
    cancelled = true;
    clearInterval(interval);
  };
}, []);

const syncStatusLabel = (() => {
  if (!isAuthenticated) return "Sign in to sync across devices";
  if (!lastSyncedAt) return "Not synced yet";
  const minutes = Math.floor((Date.now() - lastSyncedAt) / 60000);
  if (minutes < 1) return "Synced just now";
  if (minutes < 60) return `Last synced ${minutes}m ago`;
  return `Last synced ${Math.floor(minutes / 60)}h ago`;
})();

const handleSignIn = useCallback(() => {
  if (Platform.OS !== "web")
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  startOAuthLogin();
}, []);
```

- [ ] **Step 4: Add the Account section JSX**

Insert this block immediately after the `<Text className="text-2xl font-bold text-foreground">Settings</Text>` title View and before `<SectionHeader title="Notifications" />`:

```tsx
        <SectionHeader title="Account" />
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            marginHorizontal: 16,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: "hidden",
          }}
        >
          {isAuthenticated && user ? (
            <SettingRow
              icon="person.crop.circle.fill"
              label={user.name ?? "Signed in"}
              description={user.email ?? user.openId}
              right={
                <Text
                  style={{ color: colors.success, fontSize: 12, fontWeight: "600" }}
                >
                  Signed in
                </Text>
              }
            />
          ) : (
            <SettingRow
              icon="person.crop.circle.badge.plus"
              label="Sign in to sync"
              description="Sync your watchlist and alerts across devices"
              right={
                <TouchableOpacity
                  onPress={handleSignIn}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 12,
                    backgroundColor: colors.primary + "22",
                  }}
                >
                  <Text
                    style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}
                  >
                    Sign in
                  </Text>
                </TouchableOpacity>
              }
            />
          )}
          <SettingRow
            icon="arrow.triangle.2.circlepath"
            label="Sync status"
            description={syncStatusLabel}
            right={
              isAuthenticated ? (
                <TouchableOpacity
                  onPress={logout}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 12,
                    backgroundColor: colors.error + "22",
                  }}
                >
                  <Text
                    style={{ color: colors.error, fontSize: 13, fontWeight: "600" }}
                  >
                    Sign out
                  </Text>
                </TouchableOpacity>
              ) : undefined
            }
          />
        </View>
```

- [ ] **Step 5: Verify**

Run: `pnpm check` and `pnpm lint`
Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add app/\(tabs\)/settings.tsx components/ui/icon-symbol.tsx
git commit -m "feat(mobile): add account section and sync status to settings"
```

---

## Task 10: Desktop deps + Vite env types

**Files:**

- Modify: `desktop/package.json`
- Create: `desktop/src/vite-env.d.ts`

- [ ] **Step 1: Add dependencies to `desktop/package.json`**

Add to `dependencies`:

```json
    "@tanstack/react-query": "^5.90.12",
    "@trpc/client": "11.7.2",
    "@trpc/react-query": "11.7.2",
    "@trpc/server": "11.7.2",
    "superjson": "^1.13.3"
```

- [ ] **Step 2: Install**

Run: `pnpm install`
Expected: resolves the new deps from the hoisted workspace root.

- [ ] **Step 3: Create `desktop/src/vite-env.d.ts`**

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 4: Verify**

Run: `pnpm check:desktop`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/package.json desktop/pnpm-lock.yaml desktop/src/vite-env.d.ts
git commit -m "feat(desktop): add react-query/trpc deps and vite env types"
```

Note: `desktop/pnpm-lock.yaml` does not exist (lockfile is at the root); if the root `pnpm-lock.yaml` changed, stage that instead.

---

## Task 11: Desktop API base + OAuth portal helpers

**Files:**

- Create: `desktop/src/lib/api-base.ts`

- [ ] **Step 1: Write `desktop/src/lib/api-base.ts`**

```ts
export function getApiBaseUrl(): string {
  const base = import.meta.env.VITE_API_BASE_URL ?? "";
  return (base || "http://localhost:3000").replace(/\/$/, "");
}

export function getOAuthPortalUrl(): string {
  return (import.meta.env.VITE_OAUTH_PORTAL_URL ?? "").replace(/\/$/, "");
}

export function getAppId(): string {
  return import.meta.env.VITE_APP_ID ?? "";
}
```

- [ ] **Step 2: Verify**

Run: `pnpm check:desktop`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add desktop/src/lib/api-base.ts
git commit -m "feat(desktop): add api-base and oauth portal helpers"
```

---

## Task 12: Desktop auth hook — `desktop/src/hooks/use-auth.ts`

**Files:**

- Create: `desktop/src/hooks/use-auth.ts`

- [ ] **Step 1: Write `desktop/src/hooks/use-auth.ts`**

```ts
import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getAppId, getOAuthPortalUrl } from "../lib/api-base";

const SESSION_TOKEN_KEY = "desktop_session_token";
const USER_INFO_KEY = "desktop_user_info";

export type User = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  lastSignedIn: string;
};

export function getSessionToken(): string | null {
  return localStorage.getItem(SESSION_TOKEN_KEY);
}

export function setSessionToken(token: string): void {
  localStorage.setItem(SESSION_TOKEN_KEY, token);
}

export function removeSessionToken(): void {
  localStorage.removeItem(SESSION_TOKEN_KEY);
}

export function getUserInfo(): User | null {
  const raw = localStorage.getItem(USER_INFO_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function setUserInfo(user: User): void {
  localStorage.setItem(USER_INFO_KEY, JSON.stringify(user));
}

export function clearUserInfo(): void {
  localStorage.removeItem(USER_INFO_KEY);
}

export function buildLoginUrl(): string {
  const portal = getOAuthPortalUrl();
  if (!portal) return "";
  const redirectUri = "http://localhost:3420/callback";
  const url = new URL(`${portal}/app-auth`);
  url.searchParams.set("appId", getAppId());
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", btoa(redirectUri));
  url.searchParams.set("type", "signIn");
  return url.toString();
}

type Listener = () => void;
const listeners = new Set<Listener>();
function notify() {
  listeners.forEach((l) => l());
}
export function subscribeAuth(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => getUserInfo());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return subscribeAuth(() => {
      setUser(getUserInfo());
      setError(null);
    });
  }, []);

  const login = useCallback(async (loginUrl: string) => {
    if (!loginUrl) {
      setError("OAuth portal is not configured");
      return false;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<{ sessionToken: string; user: string }>(
        "start_oauth",
        { loginUrl },
      );
      if (!result?.sessionToken) {
        setError("Sign-in failed: no session token returned");
        return false;
      }
      setSessionToken(result.sessionToken);
      if (result.user) {
        try {
          const decoded = JSON.parse(atob(result.user)) as {
            id?: number;
            openId?: string;
            name?: string | null;
            email?: string | null;
            loginMethod?: string | null;
            lastSignedIn?: string;
          };
          setUserInfo({
            id: decoded.id ?? 0,
            openId: decoded.openId ?? "",
            name: decoded.name ?? null,
            email: decoded.email ?? null,
            loginMethod: decoded.loginMethod ?? null,
            lastSignedIn: decoded.lastSignedIn ?? new Date().toISOString(),
          });
        } catch {
          // ignore malformed user payload; the token is still valid
        }
      }
      notify();
      return true;
    } catch (e) {
      setError(String(e));
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    removeSessionToken();
    clearUserInfo();
    notify();
  }, []);

  return {
    user,
    loading,
    error,
    isAuthenticated: Boolean(user),
    login,
    logout,
  };
}
```

- [ ] **Step 2: Verify**

Run: `pnpm check:desktop`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add desktop/src/hooks/use-auth.ts
git commit -m "feat(desktop): add localStorage auth hook and login url builder"
```

---

## Task 13: Desktop tRPC client — `desktop/src/lib/trpc.ts`

**Files:**

- Create: `desktop/src/lib/trpc.ts`

- [ ] **Step 1: Write `desktop/src/lib/trpc.ts`**

```ts
import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../../../server/routers";
import { getSessionToken } from "../hooks/use-auth";
import { getApiBaseUrl } from "./api-base";

export const trpc = createTRPCReact<AppRouter>();

export function createTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${getApiBaseUrl()}/api/trpc`,
        transformer: superjson,
        async headers() {
          const token = getSessionToken();
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
      }),
    ],
  });
}
```

- [ ] **Step 2: Verify**

Run: `pnpm check:desktop`
Expected: PASS. (Verified during planning that the desktop tsconfig typechecks `import type { AppRouter } from "../../server/routers"` — the transitive server imports resolve because the desktop tsconfig includes all `@types` packages by default.)

- [ ] **Step 3: Commit**

```bash
git add desktop/src/lib/trpc.ts
git commit -m "feat(desktop): add react-query tRPC client"
```

---

## Task 14: Desktop Tauri `start_oauth` command

**Files:**

- Modify: `desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Add tokio imports at the top of `lib.rs`**

After the existing `use` block (after line 9), add:

```rust
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
```

- [ ] **Step 2: Add the OAuth section + command**

Insert this block (e.g. after the Import/Export section, before `// ─── Background Polling ───`):

```rust
// ─── OAuth (localhost loopback) ───────────────────────────────────────────────

fn parse_query_params(query: &str) -> std::collections::HashMap<String, String> {
    let mut params = std::collections::HashMap::new();
    if let Some(q) = query.split('?').nth(1) {
        for pair in q.split('&') {
            if let Some((k, v)) = pair.split_once('=') {
                let decoded = urlencoding::decode(v).unwrap_or_else(|_| v.into());
                params.insert(k.to_string(), decoded.to_string());
            }
        }
    }
    params
}

fn open_system_browser(url: &str) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn start_oauth(login_url: String) -> Result<serde_json::Value, String> {
    open_system_browser(&login_url)?;

    let listener = TcpListener::bind("127.0.0.1:3420")
        .await
        .map_err(|e| format!("Failed to bind OAuth callback listener: {e}"))?;

    let (mut socket, _) = listener
        .accept()
        .await
        .map_err(|e| format!("Failed to accept OAuth callback: {e}"))?;

    let mut buf = [0u8; 8192];
    let n = socket
        .read(&mut buf)
        .await
        .map_err(|e| format!("Failed to read OAuth callback: {e}"))?;
    let request = String::from_utf8_lossy(&buf[..n]).to_string();

    let request_line = request.lines().next().unwrap_or_default().to_string();
    let params = parse_query_params(&request_line);

    let body = "<html><body style=\"font-family:sans-serif;text-align:center;padding-top:80px\"><h3>Login successful. You can close this window.</h3></body></html>";
    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        body.len(),
        body
    );
    socket
        .write_all(response.as_bytes())
        .await
        .map_err(|e| format!("Failed to respond to OAuth callback: {e}"))?;

    let session_token = params.get("sessionToken").cloned().unwrap_or_default();
    if session_token.is_empty() {
        return Err("OAuth callback did not include a session token".to_string());
    }

    let user = params.get("user").cloned().unwrap_or_default();
    Ok(serde_json::json!({ "sessionToken": session_token, "user": user }))
}
```

- [ ] **Step 3: Register the command in the invoke handler**

Add `start_oauth,` to the `tauri::generate_handler![...]` list (around line 865-876), e.g. after `check_distributor_health`:

```rust
            check_distributor_health,
            start_oauth
```

- [ ] **Step 4: Verify**

Run: `cargo test` in `desktop/src-tauri`
Expected: PASS (existing tests compile and pass).

- [ ] **Step 5: Commit**

```bash
git add desktop/src-tauri/src/lib.rs
git commit -m "feat(desktop): add start_oauth loopback listener command"
```

---

## Task 15: Desktop App providers + launch sync

**Files:**

- Modify: `desktop/src/App.tsx`

- [ ] **Step 1: Add imports**

```ts
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRef } from "react";
import { useAuth } from "./hooks/use-auth";
import { trpc, createTRPCClient } from "./lib/trpc";
import { setupSync, type SyncSetup } from "../../lib/sync";
```

- [ ] **Step 2: Wire providers + sync inside `App`**

Replace the `export default function App() {` opening and the `return (` block so the whole component becomes:

```tsx
export default function App() {
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() => createTRPCClient());
  const { isAuthenticated } = useAuth();
  const isAuthenticatedRef = useRef(isAuthenticated);
  isAuthenticatedRef.current = isAuthenticated;
  const syncRef = useRef<SyncSetup | null>(null);

  useEffect(() => {
    syncRef.current = setupSync({
      storage,
      isSignedIn: () => isAuthenticatedRef.current,
      pull: (since) => trpcClient.query("sync.pull", { since }),
      push: (items) => trpcClient.mutate("sync.push", { items }),
    });
  }, [trpcClient]);

  useEffect(() => {
    if (isAuthenticated) syncRef.current?.syncNow();
  }, [isAuthenticated]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const settings = await storage.getSettings();
      if (cancelled) return;
      if (settings.checkInterval === "manual") return;
      const intervalMinutes = settings.checkInterval === "hourly" ? 60 : 1440;
      await startPricePoller(intervalMinutes);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const unlisten = onPricesChecked(async () => {
      try {
        const settings = await storage.getSettings();
        const frequency = settings.digestFrequency ?? "off";
        if (frequency === "off") return;
        const prevDigest = await storage.getPriceDigestSnapshot();
        const nextDigest = await maybeSendDigest(
          prevDigest,
          await storage.getWatchlist(),
          settings,
          await storage.getAlerts(),
          async (title, body) => {
            const { sendDesktopNotification } = await import("./notifications");
            await sendDesktopNotification(title, body);
          },
        );
        if (nextDigest) await storage.savePriceDigestSnapshot(nextDigest);
      } catch {
        // digest failures are non-fatal
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <KeyboardShortcuts
            searchModalOpen={searchModalOpen}
            setSearchModalOpen={setSearchModalOpen}
          />
          <SearchModal
            open={searchModalOpen}
            onClose={() => setSearchModalOpen(false)}
          />
          <div className="flex h-screen bg-background-light dark:bg-background-dark text-gray-900 dark:text-gray-100">
            <Sidebar />
            <main className="flex-1 overflow-auto">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/watchlist" element={<Watchlist />} />
                <Route path="/product/:id" element={<ProductDetail />} />
                <Route path="/compare/:id" element={<Compare />} />
                <Route path="/alerts" element={<Alerts />} />
                <Route path="/search" element={<Search />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/health" element={<Health />} />
                <Route path="/restock-watches" element={<RestockWatches />} />
                <Route
                  path="/distributor-analysis"
                  element={<DistributorAnalysis />}
                />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
```

- [ ] **Step 3: Verify**

Run: `pnpm check:desktop` and `pnpm --filter desktop test`
Expected: both PASS.

- [ ] **Step 4: Commit**

```bash
git add desktop/src/App.tsx
git commit -m "feat(desktop): wire trpc/react-query providers and launch sync"
```

---

## Task 16: Desktop Settings — Account section + sync status

**Files:**

- Modify: `desktop/src/pages/Settings.tsx`
- Modify: `desktop/tests/pages.test.tsx`

- [ ] **Step 1: Add imports to `desktop/src/pages/Settings.tsx`**

Add `UserCircle` to the lucide-react import, and add:

```ts
import { useAuth, buildLoginUrl } from "../hooks/use-auth";
```

- [ ] **Step 2: Add auth + sync-status state inside `Settings`**

After the existing state declarations (e.g. after `const [importExportMessage, setImportExportMessage] = useState<string | null>(null);`), add:

```tsx
const { user, isAuthenticated, login, logout } = useAuth();
const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

useEffect(() => {
  let cancelled = false;
  const refresh = async () => {
    const meta = await storage.getSyncMeta();
    if (!cancelled) setLastSyncedAt(meta.lastSyncedAt || null);
  };
  refresh();
  const interval = setInterval(refresh, 30000);
  return () => {
    cancelled = true;
    clearInterval(interval);
  };
}, []);

const syncStatus = !isAuthenticated
  ? "Sign in to sync across devices"
  : !lastSyncedAt
    ? "Not synced yet"
    : (() => {
        const minutes = Math.floor((Date.now() - lastSyncedAt) / 60000);
        if (minutes < 1) return "Synced just now";
        if (minutes < 60) return `Last synced ${minutes}m ago`;
        return `Last synced ${Math.floor(minutes / 60)}h ago`;
      })();

const handleSignIn = async () => {
  await login(buildLoginUrl());
};
```

- [ ] **Step 3: Add the Account section JSX**

Insert this block immediately after the `<h1 className="text-2xl font-bold">Settings</h1>` heading and before the Distributor Health button:

```tsx
<div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
  <div className="flex items-center gap-3 mb-4">
    <UserCircle className="w-5 h-5 text-brand-600 dark:text-brand-400" />
    <h2 className="text-lg font-semibold">Account</h2>
  </div>
  {isAuthenticated && user ? (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{user.name ?? "Signed in"}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {user.email ?? user.openId}
        </p>
        <p className="text-xs text-gray-400 mt-1">{syncStatus}</p>
      </div>
      <button
        onClick={logout}
        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
      >
        Sign out
      </button>
    </div>
  ) : (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">Sign in to sync</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{syncStatus}</p>
      </div>
      <button
        onClick={handleSignIn}
        className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium"
      >
        Sign in
      </button>
    </div>
  )}
</div>
```

- [ ] **Step 4: Update the desktop Settings test mock**

In `desktop/tests/pages.test.tsx`, add `getSyncMeta` to the `mockStorage` object (line ~34):

```ts
  getSyncMeta: vi.fn().mockResolvedValue({ lastSyncedAt: 0, items: {} }),
```

- [ ] **Step 5: Verify**

Run: `pnpm check:desktop` and `pnpm --filter desktop test`
Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add desktop/src/pages/Settings.tsx desktop/tests/pages.test.tsx
git commit -m "feat(desktop): add account section and sync status to settings"
```

---

## Task 17: Final verification + checkpoint commit

**Files:**

- Whole repo

- [ ] **Step 1: Run all verification gates**

```bash
pnpm check
pnpm lint
pnpm test
pnpm check:desktop
pnpm --filter desktop test
```

And in `desktop/src-tauri`: `cargo test`

Expected: all PASS.

- [ ] **Step 2: Update `todo.md`**

Mark the Phase 26 "Backend Sync" entry as complete (append a line noting the sync router, shared engine, mobile + desktop wiring, and desktop OAuth loopback).

- [ ] **Step 3: Checkpoint commit**

```bash
git add -A
git commit -m "Checkpoint: vX.Y: Backend sync (tRPC sync router, shared sync engine, mobile+desktop wiring, desktop OAuth loopback). TypeScript: 0 errors."
```

Use the next version number per the repo's existing checkpoint history.

---

## Self-Review Notes (from planning)

- **Spec coverage:** Every spec section maps to a task: schema (T1), server helpers (T2), sync router (T3), shared types (T4), storage sync_meta + onChange (T5), sync engine (T6/T7), mobile launch sync (T8), mobile settings (T9), desktop deps (T10), api-base (T11), desktop auth (T12), desktop trpc (T13), desktop OAuth command (T14), desktop providers (T15), desktop settings (T16). Out-of-scope items (scraping, price-history sync, realtime push, conflict UI, OAuth refresh) are untouched.
- **Placeholder scan:** No TBD/TODO/placeholder steps; every code step contains full code.
- **Type consistency:** `Collection`, `SyncItem`, `SyncMeta` defined once in `lib/types.ts` and reused by server (`server/sync-db.ts`, `server/routers.ts`) and client (`lib/sync.ts`). Storage method names (`getSyncMeta`, `saveSyncMeta`, `setItemSyncMeta`, `markItemDeleted`, `clearItemSyncMeta`, `setOnChange`, `setChangeSuppressed`) match between `lib/storage.ts` and `lib/sync.ts`. Sync timestamps are epoch-ms numbers end to end.
- **Server tests:** The spec marked server tests optional; they are included because the `createCaller` infra exists (`tests/auth.logout.test.ts`) and the no-DB path is testable without a live database.
- **Desktop typecheck:** Verified during planning that the desktop tsconfig typechecks `import type { AppRouter } from "../../server/routers"` (transitive server imports resolve via default `@types` inclusion + `skipLibCheck`).
