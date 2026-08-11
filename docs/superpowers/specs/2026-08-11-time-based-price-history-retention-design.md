# Time-Based Price History Retention Design Spec

**Date:** 2026-08-11
**Status:** Approved
**Scope:** Replace the point-count history cap on mobile with time-based retention (keep ~90 days of one-point-per-day history), and give the desktop Rust scraper the same bounded retention (it currently has no cap).

## Overview

Real scrapes already append a `PricePoint` to every listing's `priceHistory`. But retention is wrong:

- **Mobile** (`lib/background-price-check.ts`) caps history at `MAX_PRICE_HISTORY = 90` **points**. With hourly scraping that's only ~4 days of data, so the 90-day charts collapse to a short window. The cap is also a point-count, not time-based.
- **Desktop** (`desktop/src-tauri/src/lib.rs` `update_listing_price`) appends a point with **no cap at all** — unbounded growth.
- Neither deduplicates: repeated scrapes of an unchanged price produce flat noise points.

This feature makes retention time-based: at most **one price point per UTC day** (the latest scrape of that day), keeping a rolling **90-day window**. This bounds every listing's history to ≤90 points, keeps charts at their intended 90-day view, and removes per-scrape noise.

## Architecture

### Mobile: `lib/price-history.ts` (new pure helper)

```
appendPricePoint(
  history: PricePoint[],
  point: PricePoint,
  maxDays?: number,          // default 90
  now?: string,              // injectable clock for tests
): PricePoint[]
```

Logic:
1. If a point's UTC day (`point.date.slice(0, 10)`) matches an existing point's UTC day → **replace** that point in place (keeps the latest scrape, including `stockStatus`).
2. Else → append (history stays chronological).
3. Filter out points whose `date` is older than `now` minus `maxDays` days.

The helper is pure (no AsyncStorage, no Notifications), so it's trivially unit-testable.

### Mobile integration: `lib/background-price-check.ts`

Both scrape paths (background task ~line 103 and foreground `checkPriceDropsNow` ~line 286) currently build the new listing with:

```ts
priceHistory: [...listing.priceHistory, newPricePoint].slice(-MAX_PRICE_HISTORY)
```

Replace both with:

```ts
priceHistory: appendPricePoint(listing.priceHistory, newPricePoint, PRICE_HISTORY_DAYS)
```

Rename `MAX_PRICE_HISTORY = 90` → `PRICE_HISTORY_DAYS = 90`.

### Desktop: `desktop/src-tauri/src/lib.rs`

In `update_listing_price` (~line 572), replace the unconditional `arr.push(point)` with the same semantics:

1. Compute the new point's UTC day string from `current_iso_timestamp()`.
2. If the last history point's day matches, replace it; else push.
3. Compute the cutoff date (90 days ago) and retain only points whose date string is `>=` the cutoff.

Add a small `iso_date_from_secs(secs) -> String` helper (the file already hand-rolls ISO timestamps; no chrono dependency) to compute the cutoff day string. Note: history is maintained in chronological order, so a date-string comparison against the oldest retained point is sufficient.

## Data Flow

1. **Mobile** — every scrape (background task or foreground check) produces `newPricePoint` with `date = new Date().toISOString()`. It is passed through `appendPricePoint`, which replaces the same-day point or appends a new day, then prunes the window. The trimmed `priceHistory` is saved via the existing `updateProductListings`.
2. **Desktop** — the Rust `check_all_prices` flow calls `update_listing_price` per successful scrape, which applies the same replace/prune logic before writing `watchlist_products.json`.

## Error Handling

- **History shorter than 2 points** — existing chart "not enough data" behavior unchanged.
- **Point older than window** — cannot occur from normal appends (scrapes always use `now`), but the prune step handles it defensively.
- **Desktop cutoff computation** — falls back to keeping all points if the cutoff date can't be computed (keeps current behavior rather than dropping data).

## Testing

### Mobile (`tests/price-history.test.ts`)

- `appendPricePoint` with a same-day point replaces the existing day's point
- A same-day replacement preserves the latest `stockStatus`
- A new-day point appends and keeps chronological order
- Points older than `maxDays` are pruned
- A point exactly `maxDays` old is kept (inclusive boundary)
- Empty history returns a single-point history
- Custom `maxDays` and injected `now` work (deterministic tests)

### Desktop (`desktop/src-tauri/src/...` unit test)

- Mirror the same cases against the Rust retention logic (same-day replace, prune window)

## Files

**Modified:**
- `lib/background-price-check.ts` — use `appendPricePoint`, rename constant to `PRICE_HISTORY_DAYS`
- `desktop/src-tauri/src/lib.rs` — bounded retention in `update_listing_price`, `iso_date_from_secs` helper

**New:**
- `lib/price-history.ts` — `appendPricePoint` pure helper
- `tests/price-history.test.ts` — vitest unit tests
