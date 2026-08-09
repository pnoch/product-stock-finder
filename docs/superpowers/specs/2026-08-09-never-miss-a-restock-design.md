# Never Miss a Restock Design Spec

**Date:** 2026-08-09
**Status:** Approved
**Scope:** Add global background restock monitoring and a dedicated Restock Watches management screen to both mobile (Expo) and desktop (Tauri) apps.

## Overview

Currently, back-in-stock watches only poll when a product's detail screen is focused. If the user is on another screen or the app is closed, restocks are missed. This feature adds restock checking to the existing background price-check task so all watches are monitored globally, plus a dedicated Restock Watches screen to view and manage active watches.

## Architecture

### Shared Module: `lib/restock.ts`

A platform-agnostic module consumed by the background task and both Restock Watches screens.

**Function:**
```typescript
export async function checkRestocks(): Promise<void>
```

**Behavior:**
- Loads all back-in-stock watches via `getStockWatches()`
- Loads the watchlist via `getWatchlist()` to get current listing statuses
- Loads settings via `getSettings()` to check `stockAlerts` toggle
- For each watch, finds the matching listing by `productId` + `distributorId`
- If a watched distributor's listing is now `in_stock` (and `lastKnownStatus` was not `in_stock`):
  - If `settings.stockAlerts` is enabled and `Platform.OS !== "web"`, fires a stock notification via `scheduleStockAlert()`
  - Removes the watch via `removeStockWatch()` (mutex-protected)
- Else if the status changed to a different non-in-stock status, updates the cached `lastKnownStatus` via `updateStockWatchStatus()`
- Watch with no matching listing → skipped
- Empty watches → returns early

### Background Integration

- Call `checkRestocks()` from the existing background price-check task (`PRICE_CHECK_TASK`), after the price-drop check
- Call it from the foreground `checkPriceDropsNow()` too
- This makes restock monitoring global — it runs even when the app is closed (background task) or on another screen (foreground)

### Restock Watches Screen

**Mobile:** `app/restock-watches.tsx` (Expo Router route)
**Desktop:** `desktop/src/pages/RestockWatches.tsx` (React Router route)

Both screens:
- List all active back-in-stock watches: product name, distributor name, current status, last-checked
- Remove button per watch (calls `removeStockWatch`)
- Empty state when no watches
- Accessible from the Alerts tab

**Navigation:**
- Mobile: add a "Restock Watches" entry in the Alerts tab that routes to `/restock-watches`
- Desktop: add a `/restock-watches` route and a link from the Alerts page

## Data Flow

1. **Background task** — after the price-drop check, call `checkRestocks()`:
   - Load watches + watchlist + settings
   - For each watch, compare current listing status to `lastKnownStatus`
   - If `in_stock` (and previously not): fire notification (if enabled), remove watch
   - Else if status changed: update cached `lastKnownStatus`
2. **Restock Watches screen** — on mount, load all watches + current statuses. Remove button deletes a watch.
3. **Product detail** — the existing focus-based polling stays as a fast path; the background task is the safety net.

## Error Handling

- Watch with no matching listing → skip (can't determine status)
- `settings.stockAlerts` disabled → skip notifications (but still update cached status)
- Web platform → skip notifications, still update status
- Remove watch failure → ignored (watch stays)
- Empty watches → `checkRestocks()` returns early

## Testing

- Unit tests for `checkRestocks`:
  - Fires notification + removes watch when listing is `in_stock`
  - Updates cached status when status changes to non-in-stock
  - Skips when no matching listing
  - Respects `stockAlerts` toggle
  - No-op with empty watches
- Component tests for the Restock Watches screen (renders watches, remove works)

## Files

**New:**
- `lib/restock.ts` — shared restock module
- `tests/restock.test.ts` — unit tests
- `app/restock-watches.tsx` — mobile screen
- `desktop/src/pages/RestockWatches.tsx` — desktop screen

**Modified:**
- `lib/background-price-check.ts` — call `checkRestocks()` in background task + foreground
- `app/(tabs)/alerts.tsx` — add navigation entry to Restock Watches
- `desktop/src/App.tsx` — add `/restock-watches` route
- `desktop/src/pages/Alerts.tsx` — add link to Restock Watches
