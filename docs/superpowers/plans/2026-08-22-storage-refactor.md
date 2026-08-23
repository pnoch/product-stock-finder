# Storage Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Break `lib/storage.ts` (844 lines, 54 methods, 13 sections) into a `lib/storage/` directory of domain modules while preserving the public API byte-for-byte.

**Architecture:** Convert `lib/storage.ts` → `lib/storage/index.ts` (git mv preserves history). A shared `StorageContext` carries closure state (adapter, keys, change notification, write serialization). Each domain module exports a factory receiving the context; `index.ts` composes them via object spread.

**Tech Stack:** TypeScript strict, AsyncStorage, vitest.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `lib/storage/adapter.ts` | `StorageAdapter` interface + `DISTRIBUTOR_BREAKER_KEY` |
| `lib/storage/context.ts` | `STORAGE_KEYS`, `StorageContext`, `createContext()` |
| `lib/storage/watchlist.ts` | Watchlist CRUD |
| `lib/storage/alerts.ts` | Price alert CRUD |
| `lib/storage/settings.ts` | Settings + tag definitions + product-tag mutations |
| `lib/storage/reminders.ts` | Back-order reminders + stock watches |
| `lib/storage/digest-fx.ts` | Digest snapshot + FX rates |
| `lib/storage/sync-meta.ts` | Sync meta CRUD |
| `lib/storage/notifications.ts` | Displayed event ids, notification history, pending health events |
| `lib/storage/index.ts` | `createStorage` composition, `clearAllData`, `Storage` type, `defaultStorage`, named exports |

**Method count invariant:** the composed object exposes exactly these 54 methods: getWatchlist, saveWatchlist, addToWatchlist, removeFromWatchlist, updateProductListings, refreshWatchlistPrices, getAlerts, saveAlerts, addAlert, removeAlert, toggleAlert, rearmAlert, deactivateAlert, getSettings, saveSettings, getTagDefinitions, saveTagDefinitions, setProductTags, addTagsToProducts, createTag, renameTag, setTagColor, deleteTag, getBackOrderReminders, saveBackOrderReminders, addBackOrderReminder, removeBackOrderReminder, getStockWatches, saveStockWatches, addStockWatch, removeStockWatch, updateStockWatchStatus, getPriceDigestSnapshot, savePriceDigestSnapshot, getFxRates, saveFxRates, getSyncMeta, saveSyncMeta, setItemSyncMeta, markItemDeleted, clearItemSyncMeta, getDisplayedEventIds, recordDisplayedEventId, getNotificationHistory, recordNotificationEvent, markNotificationRead, markAllNotificationsRead, getUnreadNotificationCount, getPendingHealthEvents, savePendingHealthEvents, clearPendingHealthEvents, setOnChange, setChangeSuppressed, clearAllData.

---

## Task 1: Scaffold directory + context + watchlist

**Files:**
- Rename: `lib/storage.ts` → `lib/storage/index.ts` (git mv)
- Create: `lib/storage/adapter.ts`
- Create: `lib/storage/context.ts`
- Create: `lib/storage/watchlist.ts`
- Modify: `lib/storage/index.ts`

- [ ] **Step 1: Convert file to directory**

```bash
mkdir -p lib/storage && git mv lib/storage.ts lib/storage/index.ts
```

- [ ] **Step 2: Create `lib/storage/adapter.ts`**

```typescript
export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  multiRemove(keys: string[]): Promise<void>;
}

export const DISTRIBUTOR_BREAKER_KEY = "distributor_breaker";
```

- [ ] **Step 3: Create `lib/storage/context.ts`**

```typescript
import type { Collection } from "../types";
import type { StorageAdapter } from "./adapter";

export const STORAGE_KEYS = {
  WATCHLIST: "watchlist_products",
  ALERTS: "price_alerts",
  SETTINGS: "app_settings",
  REMINDERS: "back_order_reminders",
  STOCK_WATCHES: "back_in_stock_watches",
  DIGEST_SNAPSHOT: "price_digest_snapshot",
  SYNC_META: "sync_meta",
  DISPLAYED_EVENT_IDS: "displayed_notification_event_ids",
  NOTIFICATION_HISTORY: "notification_history",
  FX_RATES: "fx_rates",
  PENDING_HEALTH_EVENTS: "pending_health_events",
};

export interface StorageContext {
  readonly adapter: StorageAdapter;
  readonly KEYS: typeof STORAGE_KEYS;
  notify(collection: Collection, itemId: string): void;
  setOnChange(
    fn: ((collection: Collection, itemId: string) => void) | null,
  ): void;
  setChangeSuppressed(flag: boolean): void;
  enqueue<T>(key: string, fn: () => Promise<T>): Promise<T>;
  readList<T>(key: string): Promise<T[]>;
}

export function createContext(adapter: StorageAdapter): StorageContext {
  let onChange: ((collection: Collection, itemId: string) => void) | null =
    null;
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

  // Serializes read-modify-write operations per key to prevent lost updates
  // when concurrent batches (e.g. background price checks) mutate the same list.
  const writeQueues = new Map<string, Promise<unknown>>();

  function enqueue<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = writeQueues.get(key) ?? Promise.resolve();
    const next = prev.then(fn, fn);
    writeQueues.set(
      key,
      next.catch(() => {}),
    );
    return next;
  }

  async function readList<T>(key: string): Promise<T[]> {
    try {
      const raw = await adapter.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return {
    adapter,
    KEYS: STORAGE_KEYS,
    notify,
    setOnChange,
    setChangeSuppressed,
    enqueue,
    readList,
  };
}
```

- [ ] **Step 4: Create `lib/storage/watchlist.ts`**

Copy the watchlist section verbatim from `index.ts` (functions `getWatchlist`, `saveWatchlist`, `addToWatchlist`, `removeFromWatchlist`, `updateProductListings`, `refreshWatchlistPrices`) into this factory:

```typescript
import type { Product, DistributorListing } from "../types";
import type { StorageContext } from "./context";

export function createWatchlistStorage(ctx: StorageContext) {
  const { adapter, KEYS, notify, enqueue, readList } = ctx;

  async function getWatchlist(): Promise<Product[]> {
    return readList<Product>(KEYS.WATCHLIST);
  }

  async function saveWatchlist(products: Product[]): Promise<void> {
    await adapter.setItem(KEYS.WATCHLIST, JSON.stringify(products));
  }

  async function addToWatchlist(product: Product): Promise<void> {
    await enqueue(KEYS.WATCHLIST, async () => {
      const list = await getWatchlist();
      const exists = list.find((p) => p.id === product.id);
      if (!exists) {
        list.unshift({
          ...product,
          isWatched: true,
          addedAt: new Date().toISOString(),
        });
        await saveWatchlist(list);
        notify("watchlist", product.id);
      }
    });
  }

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

  async function updateProductListings(
    productId: string,
    listings: DistributorListing[],
  ): Promise<void> {
    await enqueue(KEYS.WATCHLIST, async () => {
      const list = await getWatchlist();
      const now = new Date().toISOString();
      const updated = list.map((p) =>
        p.id === productId ? { ...p, listings, lastRefreshed: now } : p,
      );
      await saveWatchlist(updated);
      notify("watchlist", productId);
    });
  }

  async function refreshWatchlistPrices(): Promise<void> {
    const list = await getWatchlist();
    const now = new Date().toISOString();
    const updated = list.map((p) => ({ ...p, lastRefreshed: now }));
    await saveWatchlist(updated);
    for (const p of updated) notify("watchlist", p.id);
  }

  return {
    getWatchlist,
    saveWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    updateProductListings,
    refreshWatchlistPrices,
  };
}
```

- [ ] **Step 5: Rewrite `lib/storage/index.ts` header + composition**

Replace the top of `index.ts` (imports through the watchlist section) so the file becomes:

```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppSettings } from "../types";
import type { Collection, SyncMeta } from "../types";
import type { DigestSnapshot } from "../price-digest";
import type { TagDefinition } from "../types";
import {
  StorageAdapter,
  DISTRIBUTOR_BREAKER_KEY,
} from "./adapter";
import { createContext, STORAGE_KEYS } from "./context";
import { createWatchlistStorage } from "./watchlist";

export { StorageAdapter, DISTRIBUTOR_BREAKER_KEY };

const DEFAULT_SETTINGS: AppSettings = { /* KEEP EXISTING VALUES — see below */ };
```

Keep the existing `DEFAULT_SETTINGS` literal exactly as-is (theme "auto", displayCurrency "USD", checkInterval "manual", notificationsEnabled true, stockAlerts true, priceAlerts true, healthAlerts true, shippingRegion "Asia-Pacific", webNotificationsEnabled false, watchlistSort "recent", watchlistGroup "off").

Delete from `index.ts`: the old `StorageAdapter` interface block, `DISTRIBUTOR_BREAKER_KEY` const, `KEYS` map, `onChange`/`suppressChange`/`notify`/`setOnChange`/`setChangeSuppressed` closures, `writeQueues`/`enqueue`, `readList`, and the entire watchlist section.

Rewrite `createStorage` to:

```typescript
export function createStorage(
  adapter: StorageAdapter,
  opts?: { onChange?: (collection: Collection, itemId: string) => void },
) {
  const ctx = createContext(adapter);
  ctx.setOnChange(opts?.onChange ?? null);

  return {
    ...createWatchlistStorage(ctx),
    // remaining sections stay inline here until extracted in Tasks 2–7
    setOnChange: ctx.setOnChange,
    setChangeSuppressed: ctx.setChangeSuppressed,
    clearAllData,
  };
}
```

`clearAllData` stays in `index.ts` but switches to `ctx.adapter` and `STORAGE_KEYS`:

```typescript
  async function clearAllData(): Promise<void> {
    await ctx.adapter.multiRemove([
      STORAGE_KEYS.WATCHLIST,
      STORAGE_KEYS.ALERTS,
      STORAGE_KEYS.SETTINGS,
      STORAGE_KEYS.REMINDERS,
      STORAGE_KEYS.STOCK_WATCHES,
      STORAGE_KEYS.SYNC_META,
      STORAGE_KEYS.DISPLAYED_EVENT_IDS,
      STORAGE_KEYS.NOTIFICATION_HISTORY,
      STORAGE_KEYS.FX_RATES,
      STORAGE_KEYS.PENDING_HEALTH_EVENTS,
      "recently_viewed",
      "distributor_watches",
      "triggered_alert_history",
      "product_notes",
      "has_seen_onboarding",
      "price_digest_snapshot",
      DISTRIBUTOR_BREAKER_KEY,
    ]);
  }
```

Keep `export type Storage = ReturnType<typeof createStorage>;`, `defaultStorage`, and the named-exports destructuring exactly as before.

- [ ] **Step 6: Verify**

Run: `pnpm check` — 0 errors.
Run: `pnpm test` — all pass (existing storage tests exercise createStorage + named exports).

- [ ] **Step 7: Commit**

```bash
git add lib/storage && git commit -m "refactor: scaffold lib/storage directory, extract watchlist"
```

---

## Task 2: Extract alerts

**Files:**
- Create: `lib/storage/alerts.ts`
- Modify: `lib/storage/index.ts`

- [ ] **Step 1: Create `lib/storage/alerts.ts`**

Move the alerts section verbatim into this factory:

```typescript
import type { PriceAlert } from "../types";
import type { StorageContext } from "./context";

export function createAlertsStorage(ctx: StorageContext) {
  const { adapter, KEYS, notify, enqueue, readList } = ctx;

  async function getAlerts(): Promise<PriceAlert[]> {
    return readList<PriceAlert>(KEYS.ALERTS);
  }

  async function saveAlerts(alerts: PriceAlert[]): Promise<void> {
    await adapter.setItem(KEYS.ALERTS, JSON.stringify(alerts));
  }

  async function addAlert(alert: PriceAlert): Promise<void> {
    await enqueue(KEYS.ALERTS, async () => {
      const alerts = await getAlerts();
      alerts.unshift(alert);
      await saveAlerts(alerts);
      notify("alerts", alert.id);
    });
  }

  async function removeAlert(alertId: string): Promise<void> {
    await enqueue(KEYS.ALERTS, async () => {
      const alerts = await getAlerts();
      await saveAlerts(alerts.filter((a) => a.id !== alertId));
      notify("alerts", alertId);
    });
  }

  async function toggleAlert(alertId: string): Promise<void> {
    await enqueue(KEYS.ALERTS, async () => {
      const alerts = await getAlerts();
      const updated = alerts.map((a) =>
        a.id === alertId ? { ...a, isActive: !a.isActive } : a,
      );
      await saveAlerts(updated);
      notify("alerts", alertId);
    });
  }

  async function rearmAlert(alertId: string): Promise<void> {
    await enqueue(KEYS.ALERTS, async () => {
      const alerts = await getAlerts();
      const updated = alerts.map((a) =>
        a.id === alertId
          ? {
              ...a,
              isActive: true,
              triggeredAt: undefined,
              triggeredPrice: undefined,
            }
          : a,
      );
      await saveAlerts(updated);
      notify("alerts", alertId);
    });
  }

  async function deactivateAlert(
    alertId: string,
    triggeredPrice: number,
  ): Promise<void> {
    await enqueue(KEYS.ALERTS, async () => {
      const alerts = await getAlerts();
      const updated = alerts.map((a) =>
        a.id === alertId
          ? {
              ...a,
              isActive: false,
              triggeredAt: new Date().toISOString(),
              triggeredPrice,
            }
          : a,
      );
      await saveAlerts(updated);
      notify("alerts", alertId);
    });
  }

  return {
    getAlerts,
    saveAlerts,
    addAlert,
    removeAlert,
    toggleAlert,
    rearmAlert,
    deactivateAlert,
  };
}
```

- [ ] **Step 2: Update `lib/storage/index.ts`**

Delete the alerts section. Add import `createAlertsStorage` and spread `...createAlertsStorage(ctx),` right after `...createWatchlistStorage(ctx),`.

- [ ] **Step 3: Verify**

Run: `pnpm check` — 0 errors. Run: `pnpm test` — all pass.

- [ ] **Step 4: Commit**

```bash
git add lib/storage && git commit -m "refactor: extract alerts storage"
```

---

## Task 3: Extract settings + tags

**Files:**
- Create: `lib/storage/settings.ts`
- Modify: `lib/storage/index.ts`

Note: tag product-mutations (`setProductTags`, `addTagsToProducts`, `deleteTag`) touch the watchlist, so the settings factory receives a minimal watchlist-reader interface.

- [ ] **Step 1: Create `lib/storage/settings.ts`**

Move the settings + tags sections verbatim into this factory:

```typescript
import type { AppSettings, TagDefinition, Product } from "../types";
import { generateTagId } from "../tags";
import type { StorageContext } from "./context";
import type { createWatchlistStorage } from "./watchlist";

type WatchlistReader = Pick<
  ReturnType<typeof createWatchlistStorage>,
  "getWatchlist" | "saveWatchlist"
>;

const DEFAULT_SETTINGS: AppSettings = {
  theme: "auto",
  displayCurrency: "USD",
  checkInterval: "manual",
  notificationsEnabled: true,
  stockAlerts: true,
  priceAlerts: true,
  healthAlerts: true,
  shippingRegion: "Asia-Pacific",
  webNotificationsEnabled: false,
  watchlistSort: "recent",
  watchlistGroup: "off",
};

export function createSettingsStorage(
  ctx: StorageContext,
  watchlist: WatchlistReader,
) {
  const { adapter, KEYS, notify, enqueue } = ctx;
  const { getWatchlist, saveWatchlist } = watchlist;

  async function getSettings(): Promise<AppSettings> {
    try {
      const raw = await adapter.getItem(KEYS.SETTINGS);
      return raw
        ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
        : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  async function saveSettings(settings: AppSettings): Promise<void> {
    await adapter.setItem(KEYS.SETTINGS, JSON.stringify(settings));
    notify("settings", "settings");
  }

  async function getTagDefinitions(): Promise<Record<string, TagDefinition>> {
    const settings = await getSettings();
    return settings.tagDefinitions ?? {};
  }

  async function saveTagDefinitions(
    defs: Record<string, TagDefinition>,
  ): Promise<void> {
    const settings = await getSettings();
    await saveSettings({ ...settings, tagDefinitions: defs });
  }

  async function setProductTags(
    productId: string,
    tags: string[],
  ): Promise<void> {
    await enqueue(KEYS.WATCHLIST, async () => {
      const list = await getWatchlist();
      const updated = list.map((p) =>
        p.id === productId ? { ...p, tags } : p,
      );
      await saveWatchlist(updated);
      notify("watchlist", productId);
    });
  }

  async function addTagsToProducts(
    productIds: string[],
    tagIds: string[],
  ): Promise<void> {
    await enqueue(KEYS.WATCHLIST, async () => {
      const list = await getWatchlist();
      const idSet = new Set(productIds);
      const updated = list.map((p) =>
        idSet.has(p.id)
          ? { ...p, tags: Array.from(new Set([...(p.tags ?? []), ...tagIds])) }
          : p,
      );
      await saveWatchlist(updated);
      for (const id of productIds) notify("watchlist", id);
    });
  }

  async function createTag(
    name: string,
    color: string,
  ): Promise<TagDefinition> {
    const trimmed = name.trim();
    const defs = await getTagDefinitions();
    const duplicate = Object.values(defs).some(
      (d) => d.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (duplicate) throw new Error("A tag with that name already exists");
    const tag: TagDefinition = { id: generateTagId(), name: trimmed, color };
    await saveTagDefinitions({ ...defs, [tag.id]: tag });
    return tag;
  }

  async function renameTag(id: string, name: string): Promise<void> {
    const trimmed = name.trim();
    const defs = await getTagDefinitions();
    const existing = defs[id];
    if (!existing) return;
    const duplicate = Object.values(defs).some(
      (d) => d.id !== id && d.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (duplicate) throw new Error("A tag with that name already exists");
    await saveTagDefinitions({ ...defs, [id]: { ...existing, name: trimmed } });
  }

  async function setTagColor(id: string, color: string): Promise<void> {
    const defs = await getTagDefinitions();
    const existing = defs[id];
    if (!existing) return;
    await saveTagDefinitions({ ...defs, [id]: { ...existing, color } });
  }

  async function deleteTag(id: string): Promise<void> {
    const defs = await getTagDefinitions();
    if (!defs[id]) return;
    const rest: Record<string, TagDefinition> = {};
    for (const [key, value] of Object.entries(defs)) {
      if (key !== id) rest[key] = value;
    }
    await saveTagDefinitions(rest);
    await enqueue(KEYS.WATCHLIST, async () => {
      const list = await getWatchlist();
      const updated = list.map((p) =>
        p.tags?.includes(id)
          ? { ...p, tags: (p.tags ?? []).filter((t) => t !== id) }
          : p,
      );
      await saveWatchlist(updated);
      for (const p of updated) notify("watchlist", p.id);
    });
  }

  return {
    getSettings,
    saveSettings,
    getTagDefinitions,
    saveTagDefinitions,
    setProductTags,
    addTagsToProducts,
    createTag,
    renameTag,
    setTagColor,
    deleteTag,
  };
}
```

- [ ] **Step 2: Update `lib/storage/index.ts`**

Delete the settings + tags sections AND the module-level `DEFAULT_SETTINGS` (it moved to settings.ts; drop the now-unused `AppSettings` import if nothing else uses it). Add import and wire up:

```typescript
const watchlist = createWatchlistStorage(ctx);
return {
  ...watchlist,
  ...createAlertsStorage(ctx),
  ...createSettingsStorage(ctx, watchlist),
  // ...
};
```

- [ ] **Step 3: Verify**

Run: `pnpm check` — 0 errors. Run: `pnpm test` — all pass (tag tests cover createTag/renameTag/deleteTag behavior).

- [ ] **Step 4: Commit**

```bash
git add lib/storage && git commit -m "refactor: extract settings + tags storage"
```

---

## Task 4: Extract reminders + stock watches

**Files:**
- Create: `lib/storage/reminders.ts`
- Modify: `lib/storage/index.ts`

- [ ] **Step 1: Create `lib/storage/reminders.ts`**

Move both reminder sections verbatim into this factory:

```typescript
import type { BackOrderReminder } from "../types";
import type { StorageContext } from "./context";

export function createRemindersStorage(ctx: StorageContext) {
  const { adapter, KEYS, notify, enqueue, readList } = ctx;

  async function getBackOrderReminders(): Promise<BackOrderReminder[]> {
    return readList<BackOrderReminder>(KEYS.REMINDERS);
  }

  async function saveBackOrderReminders(
    reminders: BackOrderReminder[],
  ): Promise<void> {
    await adapter.setItem(KEYS.REMINDERS, JSON.stringify(reminders));
  }

  async function addBackOrderReminder(
    reminder: BackOrderReminder,
  ): Promise<void> {
    await enqueue(KEYS.REMINDERS, async () => {
      const reminders = await getBackOrderReminders();
      const existing = reminders.findIndex(
        (r) =>
          r.productId === reminder.productId &&
          r.distributorId === reminder.distributorId,
      );
      if (existing >= 0) {
        reminders[existing] = reminder;
      } else {
        reminders.unshift(reminder);
      }
      await saveBackOrderReminders(reminders);
      notify("reminders", reminder.id);
    });
  }

  async function removeBackOrderReminder(reminderId: string): Promise<void> {
    await enqueue(KEYS.REMINDERS, async () => {
      const reminders = await getBackOrderReminders();
      await saveBackOrderReminders(
        reminders.filter((r) => r.id !== reminderId),
      );
      notify("reminders", reminderId);
    });
  }

  async function getStockWatches(): Promise<BackOrderReminder[]> {
    return readList<BackOrderReminder>(KEYS.STOCK_WATCHES);
  }

  async function saveStockWatches(watches: BackOrderReminder[]): Promise<void> {
    await adapter.setItem(KEYS.STOCK_WATCHES, JSON.stringify(watches));
  }

  async function addStockWatch(watch: BackOrderReminder): Promise<void> {
    await enqueue(KEYS.STOCK_WATCHES, async () => {
      const watches = await getStockWatches();
      const existing = watches.findIndex(
        (w) =>
          w.productId === watch.productId &&
          w.distributorId === watch.distributorId,
      );
      if (existing >= 0) {
        watches[existing] = watch;
      } else {
        watches.unshift(watch);
      }
      await saveStockWatches(watches);
      notify("reminders", watch.id);
    });
  }

  async function removeStockWatch(watchId: string): Promise<void> {
    await enqueue(KEYS.STOCK_WATCHES, async () => {
      const watches = await getStockWatches();
      await saveStockWatches(watches.filter((w) => w.id !== watchId));
      notify("reminders", watchId);
    });
  }

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

  return {
    getBackOrderReminders,
    saveBackOrderReminders,
    addBackOrderReminder,
    removeBackOrderReminder,
    getStockWatches,
    saveStockWatches,
    addStockWatch,
    removeStockWatch,
    updateStockWatchStatus,
  };
}
```

- [ ] **Step 2: Update `lib/storage/index.ts`**

Delete both reminder sections. Add import; spread `...createRemindersStorage(ctx),` after settings.

- [ ] **Step 3: Verify**

Run: `pnpm check` — 0 errors. Run: `pnpm test` — all pass.

- [ ] **Step 4: Commit**

```bash
git add lib/storage && git commit -m "refactor: extract reminders + stock watches storage"
```

---

## Task 5: Extract digest snapshot + FX rates

**Files:**
- Create: `lib/storage/digest-fx.ts`
- Modify: `lib/storage/index.ts`

- [ ] **Step 1: Create `lib/storage/digest-fx.ts`**

Move both sections verbatim into this factory:

```typescript
import type { DigestSnapshot } from "../price-digest";
import type { StorageContext } from "./context";

export function createDigestFxStorage(ctx: StorageContext) {
  const { adapter, KEYS } = ctx;

  async function getPriceDigestSnapshot(): Promise<DigestSnapshot | null> {
    try {
      const raw = await adapter.getItem(KEYS.DIGEST_SNAPSHOT);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async function savePriceDigestSnapshot(
    snapshot: DigestSnapshot,
  ): Promise<void> {
    await adapter.setItem(KEYS.DIGEST_SNAPSHOT, JSON.stringify(snapshot));
  }

  async function getFxRates(): Promise<{
    rates: Record<string, number>;
    fetchedAt: number;
  } | null> {
    try {
      const raw = await adapter.getItem(KEYS.FX_RATES);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as {
        rates?: unknown;
        fetchedAt?: unknown;
      };
      if (!parsed || typeof parsed !== "object" || !parsed.rates) return null;
      const rates: Record<string, number> = {};
      for (const [code, value] of Object.entries(
        parsed.rates as Record<string, unknown>,
      )) {
        if (typeof value === "number" && Number.isFinite(value)) {
          rates[code] = value;
        }
      }
      if (Object.keys(rates).length === 0) return null;
      return {
        rates,
        fetchedAt: typeof parsed.fetchedAt === "number" ? parsed.fetchedAt : 0,
      };
    } catch {
      return null;
    }
  }

  async function saveFxRates(payload: {
    rates: Record<string, number>;
    fetchedAt: number;
  }): Promise<void> {
    await adapter.setItem(KEYS.FX_RATES, JSON.stringify(payload));
  }

  return {
    getPriceDigestSnapshot,
    savePriceDigestSnapshot,
    getFxRates,
    saveFxRates,
  };
}
```

- [ ] **Step 2: Update `lib/storage/index.ts`**

Delete both sections (drop unused `DigestSnapshot` import). Add import; spread `...createDigestFxStorage(ctx),`.

- [ ] **Step 3: Verify**

Run: `pnpm check` — 0 errors. Run: `pnpm test` — all pass (fx round-trip tests cover validation).

- [ ] **Step 4: Commit**

```bash
git add lib/storage && git commit -m "refactor: extract digest snapshot + fx rates storage"
```

---

## Task 6: Extract sync meta

**Files:**
- Create: `lib/storage/sync-meta.ts`
- Modify: `lib/storage/index.ts`

- [ ] **Step 1: Create `lib/storage/sync-meta.ts`**

Move the sync-meta section verbatim into this factory (keep `persistSyncMeta` and `updateItemMeta` private):

```typescript
import type { Collection, SyncMeta } from "../types";
import type { StorageContext } from "./context";

export function createSyncMetaStorage(ctx: StorageContext) {
  const { adapter, KEYS, enqueue } = ctx;

  async function getSyncMeta(): Promise<SyncMeta> {
    try {
      const raw = await adapter.getItem(KEYS.SYNC_META);
      if (!raw) return { lastSyncedAt: 0, items: {} };
      const parsed = JSON.parse(raw);
      return {
        lastSyncedAt:
          typeof parsed.lastSyncedAt === "number" ? parsed.lastSyncedAt : 0,
        lastSyncOkAt:
          typeof parsed.lastSyncOkAt === "number"
            ? parsed.lastSyncOkAt
            : undefined,
        lastSyncError:
          typeof parsed.lastSyncError === "string" ||
          parsed.lastSyncError === null
            ? parsed.lastSyncError
            : undefined,
        items: parsed.items ?? {},
      };
    } catch {
      return { lastSyncedAt: 0, items: {} };
    }
  }

  // Persists sync meta via read-modify-write. `saveSyncMeta` merges `items`
  // into the existing meta (lastSyncedAt is taken from the argument). The
  // merge is per collection, not per item: callers must pass the full
  // contents of any collection they touch, since its entry replaces that
  // collection wholesale. NOT enqueued — internal helpers call it while
  // already inside enqueue(KEYS.SYNC_META, ...); the public `saveSyncMeta`
  // wrapper below adds the queue for external callers.
  async function persistSyncMeta(meta: SyncMeta): Promise<void> {
    const existing = await getSyncMeta();
    await adapter.setItem(
      KEYS.SYNC_META,
      JSON.stringify({
        lastSyncedAt: meta.lastSyncedAt,
        lastSyncOkAt: meta.lastSyncOkAt ?? existing.lastSyncOkAt,
        lastSyncError:
          meta.lastSyncError !== undefined
            ? meta.lastSyncError
            : existing.lastSyncError,
        items: { ...existing.items, ...meta.items },
      }),
    );
  }

  // Serialized on the sync-meta write queue so it cannot race other queued
  // meta mutations (setItemSyncMeta/markItemDeleted/clearItemSyncMeta).
  async function saveSyncMeta(meta: SyncMeta): Promise<void> {
    await enqueue(KEYS.SYNC_META, async () => {
      await persistSyncMeta(meta);
    });
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
      await persistSyncMeta(meta);
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
        await persistSyncMeta(meta);
      }
    });
  }

  return {
    getSyncMeta,
    saveSyncMeta,
    setItemSyncMeta,
    markItemDeleted,
    clearItemSyncMeta,
  };
}
```

- [ ] **Step 2: Update `lib/storage/index.ts`**

Delete the sync-meta section (drop unused `SyncMeta`/`Collection` imports only if truly unused elsewhere in index.ts — `Collection` is still needed by the `opts` type). Add import; spread `...createSyncMetaStorage(ctx),`.

- [ ] **Step 3: Verify**

Run: `pnpm check` — 0 errors. Run: `pnpm test` — all pass (sync-engine tests exercise meta heavily).

- [ ] **Step 4: Commit**

```bash
git add lib/storage && git commit -m "refactor: extract sync meta storage"
```

---

## Task 7: Extract notifications + cleanup + push

**Files:**
- Create: `lib/storage/notifications.ts`
- Modify: `lib/storage/index.ts`
- Modify: `todo.md`

- [ ] **Step 1: Create `lib/storage/notifications.ts`**

Move the three notification sections verbatim into this factory:

```typescript
import type { NotificationHistoryEntry } from "../types";
import type { StorageContext } from "./context";

export type PendingHealthEvent = {
  distributorId: string;
  distributorName: string;
  status: "blocked" | "error";
  title: string;
  body: string;
  createdAt: number;
};

export function createNotificationsStorage(ctx: StorageContext) {
  const { adapter, KEYS, enqueue, readList } = ctx;

  async function getDisplayedEventIds(): Promise<string[]> {
    return readList<string>(KEYS.DISPLAYED_EVENT_IDS);
  }

  async function recordDisplayedEventId(id: string): Promise<void> {
    await enqueue(KEYS.DISPLAYED_EVENT_IDS, async () => {
      const ids = await getDisplayedEventIds();
      if (!ids.includes(id)) {
        ids.push(id);
        if (ids.length > 200) ids.splice(0, ids.length - 200);
        await adapter.setItem(KEYS.DISPLAYED_EVENT_IDS, JSON.stringify(ids));
      }
    });
  }

  async function getNotificationHistory(): Promise<NotificationHistoryEntry[]> {
    return readList<NotificationHistoryEntry>(KEYS.NOTIFICATION_HISTORY);
  }

  async function recordNotificationEvent(
    event: Omit<NotificationHistoryEntry, "read">,
  ): Promise<void> {
    await enqueue(KEYS.NOTIFICATION_HISTORY, async () => {
      const list = await getNotificationHistory();
      if (list.some((e) => e.id === event.id)) return;
      list.unshift({ ...event, read: false });
      if (list.length > 200) list.length = 200;
      await adapter.setItem(KEYS.NOTIFICATION_HISTORY, JSON.stringify(list));
    });
  }

  async function markNotificationRead(id: string): Promise<void> {
    await enqueue(KEYS.NOTIFICATION_HISTORY, async () => {
      const list = await getNotificationHistory();
      const entry = list.find((e) => e.id === id);
      if (entry && !entry.read) {
        entry.read = true;
        await adapter.setItem(KEYS.NOTIFICATION_HISTORY, JSON.stringify(list));
      }
    });
  }

  async function markAllNotificationsRead(): Promise<void> {
    await enqueue(KEYS.NOTIFICATION_HISTORY, async () => {
      const list = await getNotificationHistory();
      if (list.some((e) => !e.read)) {
        for (const e of list) e.read = true;
        await adapter.setItem(KEYS.NOTIFICATION_HISTORY, JSON.stringify(list));
      }
    });
  }

  async function getUnreadNotificationCount(): Promise<number> {
    const list = await getNotificationHistory();
    return list.filter((e) => !e.read).length;
  }

  async function getPendingHealthEvents(): Promise<PendingHealthEvent[]> {
    return readList<PendingHealthEvent>(KEYS.PENDING_HEALTH_EVENTS);
  }

  async function savePendingHealthEvents(
    events: PendingHealthEvent[],
  ): Promise<void> {
    await adapter.setItem(KEYS.PENDING_HEALTH_EVENTS, JSON.stringify(events));
  }

  async function clearPendingHealthEvents(): Promise<void> {
    await adapter.removeItem(KEYS.PENDING_HEALTH_EVENTS);
  }

  return {
    getDisplayedEventIds,
    recordDisplayedEventId,
    getNotificationHistory,
    recordNotificationEvent,
    markNotificationRead,
    markAllNotificationsRead,
    getUnreadNotificationCount,
    getPendingHealthEvents,
    savePendingHealthEvents,
    clearPendingHealthEvents,
  };
}
```

- [ ] **Step 2: Finalize `lib/storage/index.ts`**

Delete the three notification sections. The inline pending-health-events type is replaced by the exported `PendingHealthEvent` (structurally identical). Add import; spread `...createNotificationsStorage(ctx),`.

Final `index.ts` shape (~90 lines):

```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Collection } from "../types";
import { StorageAdapter, DISTRIBUTOR_BREAKER_KEY } from "./adapter";
import { createContext, STORAGE_KEYS } from "./context";
import { createWatchlistStorage } from "./watchlist";
import { createAlertsStorage } from "./alerts";
import { createSettingsStorage } from "./settings";
import { createRemindersStorage } from "./reminders";
import { createDigestFxStorage } from "./digest-fx";
import { createSyncMetaStorage } from "./sync-meta";
import { createNotificationsStorage } from "./notifications";

export { StorageAdapter, DISTRIBUTOR_BREAKER_KEY };

export function createStorage(
  adapter: StorageAdapter,
  opts?: { onChange?: (collection: Collection, itemId: string) => void },
) {
  const ctx = createContext(adapter);
  ctx.setOnChange(opts?.onChange ?? null);

  const watchlist = createWatchlistStorage(ctx);

  async function clearAllData(): Promise<void> {
    await ctx.adapter.multiRemove([
      STORAGE_KEYS.WATCHLIST,
      STORAGE_KEYS.ALERTS,
      STORAGE_KEYS.SETTINGS,
      STORAGE_KEYS.REMINDERS,
      STORAGE_KEYS.STOCK_WATCHES,
      STORAGE_KEYS.SYNC_META,
      STORAGE_KEYS.DISPLAYED_EVENT_IDS,
      STORAGE_KEYS.NOTIFICATION_HISTORY,
      STORAGE_KEYS.FX_RATES,
      STORAGE_KEYS.PENDING_HEALTH_EVENTS,
      "recently_viewed",
      "distributor_watches",
      "triggered_alert_history",
      "product_notes",
      "has_seen_onboarding",
      "price_digest_snapshot",
      DISTRIBUTOR_BREAKER_KEY,
    ]);
  }

  return {
    ...watchlist,
    ...createAlertsStorage(ctx),
    ...createSettingsStorage(ctx, watchlist),
    ...createRemindersStorage(ctx),
    ...createDigestFxStorage(ctx),
    ...createSyncMetaStorage(ctx),
    ...createNotificationsStorage(ctx),
    setOnChange: ctx.setOnChange,
    setChangeSuppressed: ctx.setChangeSuppressed,
    clearAllData,
  };
}

export type Storage = ReturnType<typeof createStorage>;

// ─── Default instance (mobile / AsyncStorage) ──────────────────────────────────
// Preserves backward-compatible named exports so existing imports work unchanged.

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
  getTagDefinitions,
  saveTagDefinitions,
  setProductTags,
  addTagsToProducts,
  createTag,
  renameTag,
  setTagColor,
  deleteTag,
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
  getFxRates,
  saveFxRates,
  getSyncMeta,
  saveSyncMeta,
  setItemSyncMeta,
  markItemDeleted,
  clearItemSyncMeta,
  getDisplayedEventIds,
  recordDisplayedEventId,
  getNotificationHistory,
  recordNotificationEvent,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadNotificationCount,
  getPendingHealthEvents,
  savePendingHealthEvents,
  clearPendingHealthEvents,
  setOnChange,
  setChangeSuppressed,
  clearAllData,
} = defaultStorage;
```

- [ ] **Step 3: Update `todo.md`**

Append Phase 75 section:

```markdown
## Phase 75: Storage Refactor (v5.23)

- [x] Scaffold lib/storage/ directory (adapter, context)
- [x] Extract watchlist storage
- [x] Extract alerts storage
- [x] Extract settings + tags storage
- [x] Extract reminders + stock watches storage
- [x] Extract digest snapshot + fx rates storage
- [x] Extract sync meta storage
- [x] Extract notifications storage (displayed ids, history, health events)
- [x] Public API unchanged (54 methods, named exports preserved)
```

- [ ] **Step 4: Verify**

Run: `pnpm check` — 0 errors.
Run: `pnpm lint` — clean.
Run: `pnpm test` — all pass.
Run: `wc -l lib/storage/*.ts` — largest file ~250 lines, index.ts ~120 lines.

- [ ] **Step 5: Commit and push**

```bash
git add lib/storage todo.md && git commit -m "refactor: extract notifications storage, finalize storage directory"
git push origin main
```

---

## Summary

| Metric | Before | After |
|--------|--------|-------|
| `lib/storage.ts` | 844 lines / 1 file | 10 focused files in `lib/storage/` |
| Public API | 54 methods + named exports | Identical |
| Consumer changes | — | 0 expected |
