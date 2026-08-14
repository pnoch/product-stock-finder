# Sync Hardening Design

> **Date:** 2026-08-13
> **Phase:** v3.16
> **Status:** Approved

## Goal

Harden and verify the existing account-based cross-device sync. Cross-device sync is already fully implemented end-to-end (server LWW tables + tombstones, `lib/sync.ts` engine, OAuth auth, Settings sign-in). This phase adds the deferred review items: server input guards, a router-boundary regression test for the Phase 32 `lastKnownStatus` fix, sync-engine edge-case tests, persisted sync-status for error surfacing, and a "Sync now" button in Settings.

## Components

### 1. Server input guards — `server/routers.ts`

Add `.max(128)` to the `deviceId` input of `notifications.uploadConfig` (currently `z.string().min(1)` at line 128) and `notifications.pull` (line 165), matching the existing guard on `notifications.registerPushToken`.

### 2. Router-boundary regression tests — `tests/notifications-router.test.ts`

- **`lastKnownStatus` passthrough:** call `uploadConfig` with `stockWatches: [{ id: "w1", productId: "p1", distributorId: "d1", lastKnownStatus: "back_order" }]`; assert `upsertDeviceConfig` is called with that stock watch including `lastKnownStatus: "back_order"`. This pins the Phase 32 fix (`068e22c`) at the router boundary.
- **Guard rejection:** call `uploadConfig` with a 129-character `deviceId`; expect a validation rejection.

### 3. Sync-engine edge-case tests — `tests/sync-engine.test.ts`

Add tests that pin existing engine guarantees (behavior should already hold; no production changes expected in this section):

- **Single-flight:** two concurrent `syncNow()` calls → `pull` and `push` each invoked exactly once (module-level `inFlight` guard).
- **Pull failure:** local dirty changes retained and the sync cursor is not advanced.
- **Resurrection:** an item deleted (tombstone recorded) and re-added before sync is pushed as a live update, not a tombstone.
- **LWW tie:** a pulled item whose `updatedAt` equals the local meta `updatedAt` does not overwrite local state.
- **Tombstone propagation:** a locally-deleted item pushes a tombstone that the remote applies.

Mobile and desktop share this module, so one test file covers both.

### 4. Persisted sync status — `lib/types.ts`, `lib/sync.ts`

Extend `SyncMeta` with two optional fields:

```ts
export interface SyncMeta {
  lastSyncedAt: number;
  lastSyncOkAt?: number; // epoch ms of last successful sync
  lastSyncError?: string | null; // message of last failed sync; null/absent after success
  items: Record<
    string,
    Record<string, { updatedAt: number; deleted: boolean }>
  >;
}
```

Restructure `doSync` so the status write happens exactly once per run:

- **Success:** the final cursor write also sets `lastSyncError: null` and `lastSyncOkAt: now`.
- **Pull failure:** before the early return, persist `lastSyncError: "Pull failed: …"` (cursor untouched, `lastSyncOkAt` preserved).
- **Push failure:** before the early return, persist `lastSyncError: "Push failed: …"` (dirty items retained in meta; cursor untouched).

Desktop gets the same behavior automatically (shared `lib/sync.ts`).

### 5. Settings UI — `lib/sync.ts`, `app/_layout.tsx`, `app/(tabs)/settings.tsx`

- **Sync trigger handle:** add module-level `registerSyncSetup(setup: SyncSetup | null)` / `getSyncSetup(): SyncSetup | null` to `lib/sync.ts`. `app/_layout.tsx` registers the `setupSync` result inside its existing `setupSync` effect.
- **Status label helper:** add a pure, exported `formatSyncStatus(meta: SyncMeta, isAuthenticated: boolean, now: number): { label: string; tone: "success" | "error" | "muted" }` to `lib/sync.ts`. Behavior:
  - Not signed in → `"Sign in to sync across devices"`, tone `muted`.
  - Signed in + `lastSyncError` → `"Sync failed — {lastSyncError}"`, tone `error`.
  - Signed in, no error, no success timestamp → `"Not synced yet"`, tone `muted`.
  - Signed in, no error, with a success timestamp → existing relative label (`"Synced just now"` / `"Last synced Xm ago"` / `"Last synced Xh ago"`), tone `success` when `now - successAt < 5 minutes`, else tone `muted`.

  The "success timestamp" is `lastSyncOkAt ?? lastSyncedAt` (lastSyncOkAt is the explicit last-successful-sync marker written by `doSync`; lastSyncedAt is the fallback for pre-existing meta).

- **Settings screen:** the existing 30s `getSyncMeta()` poll captures `lastSyncError`/`lastSyncOkAt`; the Sync status row uses `formatSyncStatus` for label + tone (error tone in `colors.error`). Add a "Sync now" button in the Sync status row (authenticated only) calling `getSyncSetup()?.syncNow()`, placed next to the existing "Sign out" button.

### 6. Testing summary

- `tests/notifications-router.test.ts`: +2 tests (lastKnownStatus passthrough, deviceId guard).
- `tests/sync-engine.test.ts`: +5 engine tests (single-flight, pull-failure, resurrection, LWW tie, tombstone) and +3 status assertions (doSync writes `lastSyncError` on pull failure, on push failure, and `lastSyncOkAt` + null error on success).
- `tests/sync-status.test.ts` (new): `formatSyncStatus` unit tests (signed-out, error, not-synced, just-now, stale, recent).
- Settings UI itself has no component-test infra; verified via `pnpm check` + `pnpm lint`.

## Error Handling

- Status writes go through the existing `saveSyncMeta` (best-effort, enqueue-serialized); a failing status write must not corrupt the cursor or item meta.
- `doSync` must not advance `lastSyncedAt` when pull or push fails (existing behavior — preserved).
- The "Sync now" button is a no-op when signed out or when no setup is registered.

## Non-Goals

- No change to the sync protocol, LWW semantics, or the collections synced.
- No OAuth/auth changes.
- No notification-history sync (local-only by design).
- No new sync-status React context — the module singleton suffices.
