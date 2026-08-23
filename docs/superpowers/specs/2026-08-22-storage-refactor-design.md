# Storage Refactor — Design Spec

**Date:** 2026-08-22
**Goal:** Break `lib/storage.ts` (844 lines, 55 methods, 13 sections) into a `lib/storage/` directory of domain modules, preserving the public API byte-for-byte.

## Current State

`lib/storage.ts` is a single `createStorage(adapter, opts?)` factory. All sections live inside one closure sharing:

- `adapter: StorageAdapter`
- `KEYS` map (11 AsyncStorage keys)
- Change notification: `onChange`, `suppressChange`, `notify()`
- Per-key write serialization: `writeQueues`, `enqueue()`
- JSON-tolerant list reader: `readList<T>()`

Public API: flat object of 55 methods returned by `createStorage`; `defaultStorage` instance re-exported as ~55 named exports; `Storage` type via `ReturnType`.

## Target Architecture

```
lib/storage/
  index.ts          createStorage composition, Storage type, defaultStorage,
                    named re-exports (~90 lines)
  adapter.ts        StorageAdapter interface + DISTRIBUTOR_BREAKER_KEY
  context.ts        StorageContext interface + createContext factory
  watchlist.ts      getWatchlist, saveWatchlist, addToWatchlist,
                    removeFromWatchlist, updateProductListings,
                    refreshWatchlistPrices
  alerts.ts         getAlerts, saveAlerts, addAlert, removeAlert, toggleAlert,
                    rearmAlert, deactivateAlert
  settings.ts       DEFAULT_SETTINGS, getSettings, saveSettings + tag CRUD
                    (getTagDefinitions, saveTagDefinitions, setProductTags,
                    addTagsToProducts, createTag, renameTag, setTagColor,
                    deleteTag)
  reminders.ts      back-order reminders (get/save/add/remove) + stock watches
                    (get/save/add/remove/updateStockWatchStatus)
  digest-fx.ts      getPriceDigestSnapshot, savePriceDigestSnapshot, getFxRates,
                    saveFxRates
  sync-meta.ts      getSyncMeta, saveSyncMeta, setItemSyncMeta,
                    markItemDeleted, clearItemSyncMeta
  notifications.ts  displayed event ids, notification history
                    (get/record/markRead/markAllRead/unreadCount), pending
                    health events (get/save/clear)
```

## Shared Context

```typescript
// lib/storage/context.ts
export interface StorageContext {
  adapter: StorageAdapter;
  KEYS: Record<string, string>;
  notify(collection: Collection, itemId: string): void;
  enqueue<T>(key: string, fn: () => Promise<T>): Promise<T>;
  readList<T>(key: string): Promise<T[]>;
}
```

Each domain module exports a single factory:

```typescript
export function createWatchlistStorage(ctx: StorageContext) {
  return { /* its methods */ };
}
```

`index.ts` composes them via object spread inside `createStorage`, plus `setOnChange`, `setChangeSuppressed`, `clearAllData` defined inline (they span all domains).

## Public API Invariants

1. Same 55 method names on the object returned by `createStorage`.
2. `export type Storage = ReturnType<typeof createStorage>` unchanged.
3. `defaultStorage` + all named exports unchanged — consumers importing `{ addToWatchlist } from "@/lib/storage"` keep working.
4. `@/lib/storage` resolves to `lib/storage/index.ts` — no consumer import changes.

## Behavior Invariants

- Per-key write serialization (`enqueue`) shared across all domains via context.
- Change notifications fire through shared `notify`; suppression flag honored.
- `readList` returns `[]` on missing/malformed JSON.
- `clearAllData` removes all 17 keys (11 current + legacy keys + breaker key).
- `DEFAULT_SETTINGS` values unchanged.

## Testing

Existing storage tests (`tests/storage*.test.ts`) exercise `createStorage` and named exports — they must pass unchanged. No new tests required; this is a structural extraction. Full suite run after each task.

## Extraction Order (one commit each)

1. Scaffold: `adapter.ts`, `context.ts`, extract watchlist → `index.ts` starts composing
2. Alerts
3. Settings + tags
4. Reminders + stock watches
5. Digest + FX
6. Sync meta
7. Notifications (displayed ids, history, health events) + final cleanup, todo.md, push

**Key metrics:**
- `lib/storage.ts`: 844 lines → directory of 10 focused files (largest ~130 lines)
- Public API: unchanged (0 consumer edits expected)
