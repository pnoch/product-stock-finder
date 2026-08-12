# Full-Catalog Warming Design Spec

**Date:** 2026-08-12
**Phase:** 29 — Full-Catalog Warming
**Status:** Approved (brainstorming)

## Overview

Add a background rotation that warms the server's price cache and history for the **entire product catalog** — every `(distributor, model)` pair — so `prices.get` returns fresh snapshots (and history) for any product a client might request, not just products that have already been requested. The rotation runs continuously, warming a small bounded number of pairs per tick, and composes with the existing near-expiry warmer.

This builds directly on Phase 27 (server-side price scraping) and Phase 28 (server-side price history): the rotation reuses the same `refreshSingleFlight` path, so warmed pairs populate both the `price_cache` snapshot and the `price_history` series.

## Goals

- `prices.get` returns a fresh snapshot for any catalog product without waiting for an on-demand scrape.
- Price history accumulates for the whole catalog automatically, so a new device gets history for any product immediately.
- Polite to distributor sites: no bursts, respects each parser's `rateLimitMs`.
- Composes cleanly with the existing near-expiry warmer (no double-scraping).

## Non-Goals (out of scope this phase)

- A curated product→distributor mapping — the rotation warms the full cross product (all 17 products × all 26 distributors).
- Persisting rotation state — the least-recently-fetched approach needs no cursor/table and resumes naturally across restarts.
- Warming faster than the fixed cadence — no env-var tuning; the cadence is fixed and gentle.
- Changes to the client apps — this is server-only.

## Architecture

**Approach (chosen):** Continuous rotation, least-recently-fetched selection, additive to the existing warmer.

```
server/prices.ts (warmer tick, every 5 min)
   │
   ├─► refreshNearExpiry(now)          (existing — on-demand-requested products)
   │
   └─► warmCatalogRotation(now)        (new — full-catalog rotation)
          │
          ├─► buildCatalogPairs()       (17 products × 26 distributors, minus missing parsers)
          ├─► getFetchedAtMap()         (from price_cache: distId:model → fetchedAt, never = 0)
          ├─► pick N least-recently-fetched pairs
          └─► refreshSingleFlight(pair)  (shared single-flight — no double-scrape)
```

## Components

### `server/catalog-warmer.ts` (new)

Pure, testable rotation helpers. **Does not import from `server/prices.ts`** (avoids a circular dependency — `server/prices.ts` imports this module). Exports:

- `buildCatalogPairs()` — returns the full cross product of `PRODUCT_CATALOG` model numbers × `DISTRIBUTORS` ids, as `Array<{ distributorId, modelNumber }>`, **excluding** pairs whose distributor has no parser (`getParserByDistributorId` returns undefined). Imports `PRODUCT_CATALOG` from `lib/catalog.ts` and `DISTRIBUTORS` from `lib/distributors.ts`.
- `pickPairsToWarm(pairs, fetchedAtMap, count)` — given the pair list and a `Map<string, number>` of `distId:model → fetchedAt` (missing = 0), returns the `count` pairs with the oldest `fetchedAt` (never-fetched first). Deterministic tie-break (stable order).

### `server/prices.ts` (modify)

- Add `CATALOG_WARM_PER_TICK = 3`.
- Add `warmCatalogRotation(now, count)` — orchestrates: calls `buildCatalogPairs()`, reads the fetched-at map via `getAllFetchedAt()`, calls `pickPairsToWarm(...)`, and warms each pair via `refreshSingleFlight`. Returns the number warmed. Lives here (not in `catalog-warmer.ts`) so it can call `refreshSingleFlight` directly without a circular import.
- In the warmer tick (`setInterval`), after `refreshNearExpiry(now)` and `purgeOldHistory(now)`, call `void warmCatalogRotation(Date.now(), CATALOG_WARM_PER_TICK)`.
- `refreshSingleFlight` stays private to `server/prices.ts` — `warmCatalogRotation` (in the same file) calls it directly. Its single-flight semantics are unchanged (a pair being warmed by the rotation and requested on-demand share the same in-flight promise, so no double-scrape).

### `server/price-cache.ts` (modify)

- Add `getAllFetchedAt()` — returns `Array<{ distributorId, modelNumber, fetchedAt }>` for all rows (DB) or all entries (memory Map). Used by the rotation to build the fetched-at map. (Memory fallback: iterate the `memoryCache` Map.)

## Data Flow

1. **Boot:** `server/prices.ts` imports `server/catalog-warmer.ts`; the warmer `setInterval` starts (guarded by `NODE_ENV === "test"`).
2. **Each tick (5 min):** near-expiry warmer refreshes on-demand-requested products; catalog rotation warms the 3 least-recently-fetched pairs.
3. **Warm a pair:** `refreshSingleFlight` → `refreshPrice` → scrape → `setCachedPrice` (snapshot) + `recordHistoryPoint` (history).
4. **Next tick:** the just-warmed pairs now have a recent `fetchedAt`, so the rotation moves on to the next-oldest pairs. Never-fetched pairs always sort first, so the catalog populates in order of need.
5. **Restart:** no persisted state — never-fetched pairs (fetchedAt 0) sort first again, so rotation resumes sensibly.

## Error Handling

- A failed scrape in the rotation is swallowed by `refreshPrice` (logs a warning, returns null) — the pair stays "oldest" and is retried on a later tick. No crash, no retry storm.
- A pair with no parser is excluded at `buildCatalogPairs` time (never warmed).
- The rotation runs inside the same `setInterval` tick as the near-expiry warmer; each pass is fire-and-forget (`void`), so a throw in one doesn't stop the other.

## Config

- `CATALOG_WARM_PER_TICK = 3` in `server/prices.ts`. Reuses `WARMER_INTERVAL_MS` (5 min). No env vars.

## Testing

- **Server (`tests/catalog-warmer.test.ts`):**
  - `buildCatalogPairs` returns the full cross product (17 × 26 minus missing parsers) and excludes pairs with no parser.
  - `pickPairsToWarm` picks never-fetched pairs first, then oldest `fetchedAt`, and respects `count`.
- **Server (`tests/prices.test.ts` update):** `warmCatalogRotation` warms exactly `count` pairs and calls `refreshSingleFlight` for each; composes with near-expiry without double-scraping (shared single-flight).
- Existing `tests/warmer.test.ts` stays green (rotation is additive).

## Out of Scope

- Curated product→distributor mapping.
- Persisted rotation state.
- Client app changes.
- Cadence tuning via env vars.