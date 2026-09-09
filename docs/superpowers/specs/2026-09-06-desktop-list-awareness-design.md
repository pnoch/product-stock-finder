# Desktop List Awareness — Design

Date: 2026-09-06. Scope: offline banner, insight badges, tab
counts (approved; first of the product-gaps split).

## Problem

1. Offline desktop edits look silently unsynced — no queued-edits
   indicator (mobile has one).
2. Desktop cards show price + stock only — no buy-signal badges
   (mobile shows all-time-low / drop-streak).
3. Desktop Alerts tabs show no counts (mobile shows per-tab
   counts).

## Approach

Mirror mobile logic/copy with desktop UI. No new data layers.

## Offline banner

- `desktop/src/pages/Watchlist.tsx`: `useConnection()` status
  (`desktop/src/hooks/use-connection.ts`; QueryClientProvider
  present in App shell) + `countQueuedEdits(await
  storage.getSyncMeta())` (from `lib/sync.ts`, already used for
  badge logic elsewhere) refreshed on mount and window focus.
- Banner above the table when offline AND count > 0: "Offline —
  N edits queued / Will sync when back online", warning styling,
  `role="alert"`. Mobile copy.

## Insight badges

- `computeProductInsights` memo over the watchlist
  (`lib/product-insights.ts`, verified desktop-safe) mapping
  product id → `{ atAllTimeLow, dropStreak }`.
- Product name cell gains chips when `atAllTimeLow ||
  dropStreak >= 2` (mobile thresholds): "All-time low" emerald,
  "▼ Dropping ×N" red (mobile copy). No new column (colSpan
  math intact).

## Tab counts

- `desktop/src/pages/Alerts.tsx`: "Alerts (N)" / "Reminders (M)"
  from existing state arrays (+ existing Notifications unread).
  No sidebar badge (no count infra there — explicitly out).

## Testing

- Source-guard tests: banner, badges, counts.
- Verification: `pnpm check` (0 errors), `pnpm lint` (no new
  warnings), `pnpm test` (full suite green), desktop `pnpm build`.

## Non-goals

- Sidebar badges, mobile changes.
