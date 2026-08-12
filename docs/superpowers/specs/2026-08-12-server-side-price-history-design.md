# Server-Side Price History Design Spec

**Date:** 2026-08-12
**Phase:** 28 — Server-Side Price History
**Status:** Approved (brainstorming)

## Overview

Add server-side price history so the shared server becomes the source of truth for price history, not just current snapshots. The server records a history point on every successful scrape (1 point per UTC day, 90-day retention), returns the full history series alongside the current snapshot from `prices.get`, and accepts uploaded local history from clients as a backfill. Mobile and desktop both merge server history into their local listings, so a new device gets full 90-day history immediately and existing devices keep a superset of their local history.

This builds directly on Phase 27 (server-side price scraping): the same `prices.get` flow now also carries history, and the existing warmer tick also handles retention purging.

## Goals

- Server is the source of truth for price history: new devices get full 90-day history without waiting for local scraping to accumulate it.
- History survives app reinstall / data loss.
- Existing local history is backfilled to the server so the server has history even for products it hasn't scraped yet.
- History retention matches the app's existing 90-day window.
- Both mobile and desktop participate (merge + backfill).

## Non-Goals (out of scope this phase)

- History retention longer than 90 days (matches the app's `PRICE_HISTORY_DAYS = 90`).
- Recording history only on price change — every scrape records a point (1/day dedup), matching local `appendPricePoint` behavior.
- Server-side history for products the server has never scraped and no client has uploaded — history only exists once recorded or uploaded.
- Changes to the chart UI itself — charts already render `listing.priceHistory`; this phase just makes that data richer.
- Multi-server cache coordination — assumes a single Express server instance.

## Architecture

**Approach A (chosen):** Extend the existing `prices.get` endpoint to also return history; record history on every successful scrape; add a public `prices.uploadHistory` mutation for backfill.

```
Client (mobile/desktop)
   │  prices.get(distributorId, modelNumber)   → { snapshot, history }
   │  prices.uploadHistory(distributorId, modelNumber, points)   (backfill)
   ▼
server/routers.ts ──► server/prices.ts
                        │
                        ├─► cache lookup (price_cache)
                        ├─► refreshPrice: scrape → snapshot + record history point
                        └─► warmer tick: refreshNearExpiry + purgeOldHistory
```

## Data Model

### `price_history` table (new)

Keyed by `(distributorId, modelNumber, date)` where `date` is the UTC day (`YYYY-MM-DD`). One row per distributor/model/day.

| Column | Type | Notes |
| --- | --- | --- |
| `distributorId` | varchar(64) | PK part |
| `modelNumber` | varchar(128) | PK part |
| `date` | varchar(10) | PK part — UTC day `YYYY-MM-DD` |
| `price` | double | not null |
| `currency` | varchar(8) | not null |
| `stockStatus` | varchar(16) | not null |
| `fetchedAt` | bigint | not null — epoch ms, used for dedup/merge |

Composite primary key on `(distributorId, modelNumber, date)`.

> **Deviation from a naive design:** `double` (not `decimal`) for `price`, matching the `price_cache` table and the `PriceSnapshot`/`PricePoint` types. Drizzle MySQL `decimal` maps to `string`; `double` keeps the row type aligned with `PricePoint`.

## Server Components

### `server/price-history.ts` (new)

History storage + merge helpers, mirroring the cache backend pattern in `server/price-cache.ts` (DB table with in-memory Map fallback when no `DATABASE_URL`).

- `recordHistoryPoint(distributorId, modelNumber, snapshot)` — upserts one row for the snapshot's UTC day. `fetchedAt` from the snapshot. Used by `refreshPrice` after each successful scrape.
- `getHistory(distributorId, modelNumber)` — returns `PricePoint[]` sorted by `date` ascending (90-day window enforced by purge).
- `mergeHistory(distributorId, modelNumber, points)` — upserts each supplied point (1/day dedup; when a day already exists, the row with the newest `fetchedAt` wins). `fetchedAt` for uploaded points is derived from `Date.parse(point.date)` since `PricePoint` carries an ISO `date` and no `fetchedAt`. Used by `prices.uploadHistory`.
- `purgeOldHistory(now)` — deletes rows older than 90 days. Called from the warmer tick.
- `clearHistoryForTests()` — clears the in-memory Map.

In-memory fallback: a `Map<string, PricePoint[]>` keyed by `distributorId:modelNumber`, used when `getDb()` returns null (no `DATABASE_URL`), so tests and server-less runs still work.

### `server/prices.ts` (modify)

- `refreshPrice` — after a successful scrape + `setCachedPrice`, also call `recordHistoryPoint(distributorId, modelNumber, snapshot)`.
- `getPrice` — return type changes to `{ snapshot: PriceSnapshot | null, history: PricePoint[] }`. On a cache hit, `history` is fetched via `getHistory`. On a miss/stale, the background refresh still runs; the returned history reflects whatever exists (possibly empty).
- `refreshNearExpiry` — unchanged (still refreshes near-expiry entries).
- Warmer tick — additionally calls `purgeOldHistory(Date.now())`.

### `server/routers.ts` (modify)

- `prices.get` — returns `{ snapshot, history }` (the new `getPrice` shape). Input unchanged.
- `prices.uploadHistory` (new, public mutation) — input `{ distributorId, modelNumber, points: PricePoint[] }`; calls `mergeHistory`. Returns `{ accepted: number }`.

## Mobile Components

### `lib/server-prices.ts` (modify)

- `fetchServerPrice(distributorId, modelNumber)` — return type changes to `{ snapshot: PriceSnapshot, history: PricePoint[] } | null`. Timeout/error behavior unchanged (4s `Promise.race`, null on failure).
- `uploadServerHistory(distributorId, modelNumber, points)` (new) — fire-and-forget call to `prices.uploadHistory`; swallows errors.

### `lib/background-price-check.ts` (modify)

- `refreshListing` — when the server responds, merge the returned `history` into `listing.priceHistory` (union by day, newest ISO `date` wins) before building the updated listing. Local scrape path unchanged.
- Piggyback backfill — when the server responds but its history is empty or shorter than the local `priceHistory`, fire `uploadServerHistory` with the local points (fire-and-forget).

### `lib/history-sync.ts` (new)

- `backfillLocalHistory()` — iterates the watchlist, and for each listing with non-empty local `priceHistory`, calls `uploadServerHistory`. Returns a count of uploaded listings. Called once at launch from `app/_layout.tsx` (next to the existing launch sync), guarded so it doesn't block startup.

### `lib/types.ts` (modify)

- Add a shared `PricePoint`-based helper type if needed for the `{ snapshot, history }` return shape (e.g. `ServerPriceResult`). `PricePoint` already exists.

## Desktop Components (Rust)

### `desktop/src-tauri/src/lib.rs` (modify)

- `fetch_server_price` — parse the new `{ snapshot, history }` response shape. Return the snapshot as today plus the history array.
- `check_all_prices` — thread server history through to the caller: add an optional `history: Option<Vec<PricePoint>>` field to `ScrapeJobResult` (or a parallel `Vec` returned alongside), populated when `fetch_server_price` succeeds.
- `update_listing_price` — accept the server history and merge it into the listing's `priceHistory` (union by day, newest ISO `date` wins) using the existing `append_price_point_with_retention`-style logic. `run_full_price_check` passes the history through from each `ScrapeJobResult`.
- `backfill_local_history` (new command) — uploads local `priceHistory` for each watched listing to `prices.uploadHistory`. Called from `start_price_poller` when `api_base_url` is non-empty.

## Data Flow

1. **Scrape records history:** server scrapes a product (via `prices.get` miss or warmer) → `refreshPrice` → `recordHistoryPoint` upserts today's row.
2. **Client refresh:** mobile/desktop calls `prices.get` → gets `{ snapshot, history }` → merges history into local listing.
3. **Backfill (launch):** app launches → `backfillLocalHistory()` uploads local history for all watched listings → server merges (dedup by day, newest wins).
4. **Backfill (piggyback):** during refresh, if server history is empty/shorter than local, upload local points.
5. **Retention:** warmer tick purges rows older than 90 days.

## Error Handling

- Server unreachable / timeout: `fetchServerPrice` returns null → local scrape path runs (unchanged behavior).
- `uploadServerHistory` / backfill failures: swallowed (fire-and-forget); history simply isn't uploaded this run, retried next refresh/launch.
- No `DATABASE_URL`: history lives in the in-memory Map fallback; survives only for the server process lifetime.
- Merge conflicts (same day, different timestamps): newest wins — on the server compare `fetchedAt` (derived from `Date.parse(point.date)` for uploads), on the client compare the ISO `date` string directly.

## Testing

- **Server (`tests/price-history.test.ts`):** record dedup (two scrapes same day → one row), getHistory ordering, mergeHistory dedup/newest-wins, purgeOldHistory retention.
- **Server (`tests/prices.test.ts` update):** `getPrice` returns `{ snapshot, history }`; `refreshPrice` records a history point.
- **Router (`tests/prices-router.test.ts` update):** `prices.get` returns `{ snapshot, history }`; `prices.uploadHistory` calls mergeHistory and returns accepted count.
- **Mobile (`tests/server-prices.test.ts` update):** `fetchServerPrice` returns `{ snapshot, history }`; `uploadServerHistory` swallows errors.
- **Mobile (`tests/server-first-scrape.test.ts` update):** `refreshListing` merges server history into the listing; piggyback backfill fires when server history is shorter.
- **Mobile (`tests/history-sync.test.ts` new):** `backfillLocalHistory` uploads local history for watched listings.
- **Desktop:** cargo tests for history merge in `update_listing_price` and `backfill_local_history`.

## Out of Scope

- Chart UI changes (charts already consume `listing.priceHistory`).
- History retention > 90 days.
- Recording history only on price change.
- Multi-server coordination.