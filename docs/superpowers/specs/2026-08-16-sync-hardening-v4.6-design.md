# Sync Hardening (v4.6) — Design

**Date:** 2026-08-16
**Status:** Approved design (pending implementation plan)

## 1. Overview

Verify and harden the existing cross-device sync engine. The sync engine already exists and is fully wired:

- **Client:** `lib/sync.ts` — single-flight `syncNow`, 2s debounced `setupSync`, last-write-wins pull/merge/push with tombstones, dirty tracking, per-item sync metadata. Syncs `watchlist`, `alerts`, `reminders` (incl. stock watches), and `settings`. 16 passing tests.
- **Server:** `sync.pull`/`sync.push` protected tRPC router (`server/routers.ts`) backed by `server/sync-db.ts` (`listChangedItems`, `upsertSyncItem`, `purgeOldTombstones`) over Drizzle/MySQL. Only the no-DB fallback path is tested.
- **Wiring:** `app/_layout.tsx` runs launch sync + auth-change sync + onChange→dirty→schedule. Settings shows sync status via `formatSyncStatus`.

This phase hardens five areas, all decisions locked with the user:

1. **Server-authoritative timestamps** (push-response stamping) — eliminate clock-skew data loss in LWW conflict resolution.
2. **Capped price-history sync** — sync the last 30 days of `priceHistory` per listing across devices.
3. **Offline retry/backoff** — exponential backoff timer after failed sync + retry on app foreground.
4. **Server DB test coverage** — real MySQL integration tests for the sync-db SQL layer.
5. **End-to-end integration test** — storage → `syncNow` → real tRPC router → DB → back.

DB-backed tests run behind `RUN_DB_TESTS=1` against a dedicated `stock_tracker_test` database in the existing MySQL container (port 3307). Plain `pnpm test` stays green without the container.

## 2. Server-Authoritative Timestamps (Push-Response Stamping)

**Problem:** LWW conflict resolution compares client `updatedAt` values. A device whose clock is fast always wins; a slow clock always loses. Both silently corrupt the other device's edits.

**Approach (chosen):** push-response stamping. The server is the single source of truth for item timestamps.

### Server (`server/routers.ts` `sync.push`)

- After `upsertSyncItem(ctx.user.id, item)` succeeds for an item, stamp the stored row's `updatedAtMs` with the server's `Date.now()` (overriding the client-supplied value).
- Change the push response from `{ accepted: number }` to:

```ts
{
  accepted: number;
  stamped: Array<{ collection: Collection; id: string; updatedAt: number }>;
}
```

- `stamped` contains one entry per accepted item with the server-assigned `updatedAt`.
- Items that fail `upsertSyncItem` are not included in `stamped` (client keeps their local meta so they retry next sync).

### Client (`lib/sync.ts` `doSync`)

- Change the `SyncNowOptions.push` signature from `(items) => Promise<{ accepted: number }>` to `(items) => Promise<{ accepted: number; stamped: Array<{ collection: Collection; id: string; updatedAt: number }> }>`.
- After a successful push, for each entry in `stamped`, write the server `updatedAt` into the sync meta via `setItemSyncMeta(collection, id, updatedAt)` — instead of the client's local `now`.
- The dirty-tracking cursor (`lastSyncedAt`) continues to advance to `max(pulled.lastSyncedAt, now)` as today; only per-item meta uses the stamped values.
- Pull is unchanged (items already carry server timestamps).

**Effect:** both sides of every LWW comparison use server time. Clock skew can no longer cause silent data loss.

## 3. Capped Price-History Sync

**Problem:** `serializeItem` strips `priceHistory` from listings, so a fresh device starts with no chart history even though other devices have it.

**Approach (chosen):** sync a capped 30-day window of `priceHistory`.

### Serialization (`lib/sync.ts` `serializeItem`)

- Add a shared const `PRICE_HISTORY_SYNC_DAYS = 30` (in `shared/const.ts` so both client and server can reference it).
- When serializing a watchlist listing, include `priceHistory` filtered to points within the last `PRICE_HISTORY_SYNC_DAYS` days (cutoff computed against `Date.now()`). Points older than the cutoff are dropped at serialize time, bounding payload size.

### Apply/merge (`lib/sync.ts` `applyLocalItem`, watchlist branch)

- When a synced listing arrives with `priceHistory`, merge it into the local listing's existing history using `mergePriceHistory(localHistory, incomingHistory, PRICE_HISTORY_SYNC_DAYS)` (dedupe by day, keep the later point, 30-day window).
- Local history that is newer/fuller is preserved; incoming fills gaps. This is the same merge the live-price layer already uses.

**Trade-off:** a fresh device starts with the last 30 days of history, not the full 90-day window. Full history still accumulates locally over time via scraping. Accepted by the user.

## 4. Offline Retry/Backoff

**Problem:** a failed push keeps dirty items locally but only retries on the next local change or launch. A device left offline for a while doesn't recover on its own.

**Approach (chosen):** exponential backoff timer + foreground retry.

### Backoff scheduler (`lib/sync.ts` `setupSync`)

- Track retry state in module scope (alongside the existing `inFlight` lock and `syncSetupRef`).
- On a failed push or pull, schedule a retry with exponential backoff: 30s → 1m → 2m → 5m, capped at 5m.
- Reset to 30s on any successful sync.
- Retries respect `isSignedIn()` and the single-flight `inFlight` lock.
- Backoff state is in-memory only — a failed push already keeps dirty items locally, so an app restart naturally retries on launch sync.

### Foreground retry (`app/_layout.tsx`)

- Add an `AppState` listener (native) / window-focus listener (web) that, when the app becomes active and the last sync failed, triggers `getSyncSetup()?.syncNow()`.
- Reuses the existing `registerSyncSetup`/`getSyncSetup` accessor — no new plumbing.

## 5. Server DB Test Coverage + End-to-End Integration Test

### Test DB setup

- Create a dedicated `stock_tracker_test` database in the running MySQL container (port 3307).
- Add `scripts/setup-test-db.sh`: creates the DB and runs the drizzle migrations against it.
- Tests read the test connection string from `TEST_DATABASE_URL` (env, never committed). Falls back to `DATABASE_URL` if `TEST_DATABASE_URL` is unset and `RUN_DB_TESTS=1` is set.

### Gating

- DB-backed tests are gated behind `RUN_DB_TESTS=1` using `describe.skipIf(!process.env.RUN_DB_TESTS)`.
- `pnpm test` skips them (green without the container). `RUN_DB_TESTS=1 pnpm test` runs them.

### Server sync-db integration tests (`tests/sync-db.test.ts`)

Real drizzle against the test DB, covering:

- `listChangedItems`: since-cursor filtering, tombstone rows returned, per-user isolation (user A's changes never leak to user B).
- `upsertSyncItem`: insert, update (newer wins), tombstone write, server-stamped timestamp applied.
- `purgeOldTombstones`: old tombstones removed, recent ones kept.

### End-to-end sync test (`tests/sync-e2e.test.ts`)

Real storage → `syncNow` → real tRPC router (authenticated caller) → sync-db → back. Verifies:

- First sync pushes local watchlist/alerts/settings to the server.
- A second device pulls them and materializes the same data.
- An edit on device B pushes back and lands on device A.
- A deletion on one device tombstones and propagates to the other.
- Capped price history round-trips (serialized with the 30-day window, merged into local history on apply).

### Client engine tests (`tests/sync-engine.test.ts`)

Updated for new behaviors:

- Stamped timestamps from push response are applied to sync meta.
- Serialized payload includes capped price history.
- Backoff scheduling on failure; reset on success.

## 6. Testing Strategy

- **Gates:** `pnpm check` (0 TS errors), `pnpm lint` (clean), `pnpm test` (all non-DB tests green), `RUN_DB_TESTS=1 pnpm test` (DB + e2e tests green).
- **No `.env` committed.** `TEST_DATABASE_URL` is provided at test time.
- **Test DB lifecycle:** `scripts/setup-test-db.sh` is idempotent (creates DB if missing, runs migrations).

## 7. Out of Scope

- Syncing full (uncapped) price history.
- Lamport/HLC clocks.
- Multi-user collaboration semantics beyond LWW (e.g., per-field merge).
- Changing the sync collections (watchlist/alerts/reminders/settings stay as-is).