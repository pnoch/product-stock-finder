# Scheduled Price Digest Design Spec

**Date:** 2026-08-11
**Status:** Approved
**Scope:** Add a daily/weekly push notification digest summarizing watchlist changes — price moves, stock status changes, alert-target hits, and a watchlist summary header — on both mobile and desktop. Also wire the previously-dead desktop price poller to settings so the digest (and background checking) actually run on desktop.

## Overview

The app already scrapes prices on a schedule and fires instant price-drop / restock notifications. What's missing is a periodic _summary_: "since your last digest, 3 prices dropped, CRS326 came back in stock, and your watchlist is worth $X." This feature adds that digest using a snapshot-based diff — store a compact per-product state after each digest, then diff the current watchlist against it on a due check.

The digest is **opportunistic**: mobile background tasks (`expo-background-task`) only guarantee a `minimumInterval`, not exact wall-clock delivery, so the digest fires during the next background or foreground price check once the configured interval (daily/weekly) has elapsed since the last digest. This works even in manual mode — it fires on app launch if overdue.

## Architecture

### 1. Shared digest module — `lib/price-digest.ts` (new, pure + testable)

```
type DigestProductState = {
  productId: string;
  name: string;
  bestPrice: number | null;    // best in-stock price converted to display currency
  stockStatus: StockStatus;    // aggregate stock status for the product
};

type DigestSnapshot = {
  lastDigestAt: string;        // ISO timestamp of the previous digest
  products: DigestProductState[];
};

type DigestResult = {
  summary: { totalValue: number; inStock: number; backOrder: number; outOfStock: number; unknown: number };
  priceChanges: { productId: string; name: string; from: number; to: number; percent: number }[];
  stockChanges: { productId: string; name: string; from: StockStatus; to: StockStatus }[];
  alertTargetsHit: { productId: string; name: string; price: number; currency: string }[];
};

computeDigest(previous: DigestSnapshot | null, watchlist: Product[], settings: AppSettings, alerts: PriceAlert[]): DigestResult
formatDigestNotification(result: DigestResult): { title: string; body: string }
maybeSendDigest(previous: DigestSnapshot | null, watchlist: Product[], settings: AppSettings, alerts: PriceAlert[]): Promise<DigestSnapshot | null>
```

- **Diffing** (`computeDigest`): compare each current product's best price + stock status against the snapshot entry:
  - best price changed → `priceChanges` entry with `%` change
  - stock status transitioned → `stockChanges` entry
  - alerts with `triggeredAt >= previous.lastDigestAt` (and `isActive === false`) → `alertTargetsHit`
- **Summary header**: total watchlist value (sum of converted best prices) + in-stock/back-order/out-of-stock/unknown counts. Reuses `getBestPrice` and `formatPrice` from `lib/currency.ts`.
- **Gating** (`maybeSendDigest`): if `settings.digestFrequency === "off"` → `null`. If `previous` is `null` or `now - previous.lastDigestAt >= interval` (daily = 24h, weekly = 7d) → compute, format, and send via `sendPriceDigestNotification`, then return the new snapshot (built from the current watchlist). Otherwise `null`. `maybeSendDigest` never throws — it catches and returns `null` on any notification failure.
- **Signature**: `maybeSendDigest(previous, watchlist, settings, alerts, send = sendPriceDigestNotification, now = new Date().toISOString())` — `send` and `now` are injectable so tests can stub the notification and control time deterministically.
- The caller persists the returned snapshot (single write point, idempotent; concurrent checks can't double-fire because only the first sees an overdue window).

### 2. Storage — `lib/storage.ts`

New AsyncStorage key `price_digest_snapshot` with:

- `getPriceDigestSnapshot(): Promise<DigestSnapshot | null>`
- `savePriceDigestSnapshot(snapshot: DigestSnapshot): Promise<void>`

Works identically on desktop because `desktop/src/storage.ts` already reuses `createStorage(localStorageAdapter)`. Add to `clearAllData` legacy-key cleanup.

### 3. Settings — `lib/types.ts` + both settings screens

`AppSettings.digestFrequency: "off" | "daily" | "weekly"` (default `"off"`).

- **Mobile** `app/(tabs)/settings.tsx`: add a "Price Digest" section under Notifications with an off/daily/weekly segmented control (matching the existing Check Interval UI pattern).
- **Desktop** `desktop/src/pages/Settings.tsx`: same segmented control.

### 4. Mobile trigger — `lib/background-price-check.ts`

At the end of both the background task (`PRICE_CHECK_TASK`) and foreground `checkPriceDropsNow` — after the scrape loop, `checkRestocks`, and alert checks — call:

```ts
const prevDigest = await getPriceDigestSnapshot();
const next = await maybeSendDigest(
  prevDigest,
  refreshedWatchlist,
  settings,
  alerts,
);
if (next) await savePriceDigestSnapshot(next);
```

Uses the already-fetched `settings`, `alerts`, and `refreshedWatchlist`. Guarded so it's a no-op when `digestFrequency === "off"`.

### 5. Notifications — `lib/notifications.ts`

Add `sendPriceDigestNotification(title, body)` — same pattern as the existing helpers: guard `Platform.OS === "web"`, request permissions, `scheduleNotificationAsync` with `trigger: null` (immediate). Also add a `digest` Android notification channel in `setupAndroidNotificationChannel`.

### 6. Desktop trigger + poller wiring

**Wire the poller (pre-existing gap):**

- `desktop/src/App.tsx`: on mount, read settings via `storage.getSettings()` and call `startPricePoller(intervalMinutes)` where hourly=60, daily=1440, manual=don't start.
- `desktop/src/pages/Settings.tsx`: when `checkInterval` changes, `stopPricePoller()` then `startPricePoller()` with the new interval (or just stop for manual).

**Digest:**

- `desktop/src/App.tsx` (or a `usePriceDigest` hook): subscribe to the existing `prices-checked` event (`onPricesChecked` in `desktop/src/background.ts`). On each event, run the shared `maybeSendDigest` against localStorage data and send via `sendDesktopNotification`. Desktop and mobile share the exact same digest engine in `lib/price-digest.ts`.

## Data Flow

1. **Mobile** — a scheduled check (background or foreground) scrapes prices → updates listings/history → checks restocks → checks alerts → calls `maybeSendDigest`. If due, it sends the digest notification and persists the new snapshot.
2. **Desktop** — poller fires `run_full_price_check` → emits `prices-checked` → the frontend listener runs `maybeSendDigest` → sends a desktop notification and persists the new snapshot.

## Error Handling

- Notification permission denied / web platform → digest silently skipped, no crash, snapshot unchanged (will retry next check).
- `maybeSendDigest` wraps sending in try/catch and returns `null` on failure.
- No watchlist / empty watchlist → digest still computes a summary (all-zero counts) but `formatDigestNotification` falls back to a "no changes" body; if there's truly nothing to report it can still send the summary header.
- Overdue by many intervals (e.g., app closed for a week) → only one digest fires, with the full accumulated diff.

## Testing

### `tests/price-digest.test.ts` (vitest)

- `computeDigest`:
  - detects a best-price change with correct `%`
  - detects a stock-status transition
  - detects alert-target hits within the window (`triggeredAt >= lastDigestAt`), excludes older ones
  - returns empty changes when nothing changed (but still a summary)
  - handles `previous === null` (all "new" — no changes reported, snapshot built)
  - summary counts (in-stock/back-order/out-of-stock) correct
- `formatDigestNotification`:
  - title includes frequency context (e.g. "Daily" / "Weekly")
  - body includes summary header and change lines
  - empty result → "no changes" body
- `maybeSendDigest`:
  - `digestFrequency === "off"` → returns `null`, no notification
  - not due (within interval) → `null`
  - due → sends notification, returns a snapshot with `lastDigestAt = now`
  - notification failure → returns `null` (no crash)

## Files

**Modified:**

- `lib/storage.ts` — `price_digest_snapshot` key + get/set helpers, `clearAllData`
- `lib/types.ts` — `AppSettings.digestFrequency`
- `lib/background-price-check.ts` — digest call at end of both check paths
- `lib/notifications.ts` — `sendPriceDigestNotification`, Android `digest` channel
- `app/(tabs)/settings.tsx` — digest frequency control
- `desktop/src/pages/Settings.tsx` — digest frequency control + poller restart on checkInterval change
- `desktop/src/App.tsx` — start poller on load; digest listener on `prices-checked`

**New:**

- `lib/price-digest.ts` — shared digest engine (computeDigest / formatDigestNotification / maybeSendDigest)
- `tests/price-digest.test.ts` — vitest unit tests
