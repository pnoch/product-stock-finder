# Desktop Search + Polish Bundle — Design

Date: 2026-09-06. Scope: CSV export, search flow, manual
prefill, rate row, health fallback, restock copy (approved).

## Problem

1. No CSV export in desktop Settings (mobile data section has
   it via `watchlistToCsv`).
2. Desktop search Add ends in a toast; manual-add ignores the
   query just typed.
3. "Rate the App" links to the Play Store (dead end on
   desktop); Health web failure is silent; restock copy says
   "tap".

## Approach

Mirror existing desktop patterns (backup download handlers,
`useNavigate`, toasts). No new dependencies, no server changes.

## CSV export

- Settings Data Management: "Export CSV" button —
  `watchlistToCsv(watchlist, displayCurrency)` (`lib/csv.ts`,
  pure) → `.csv` download (Tauri save dialog + Blob fallback,
  mirroring the backup handlers in the same file).

## Search flow

- `handleAdd` success: `navigate("/watchlist")` after toast
  (`useNavigate` already in file). Pending-tags staging
  untouched.
- Manual Add open: prefill `manualModel` (only) from current
  `query`.

## Dead-end fixes

- Settings: hide the "Rate the App" row on desktop (no valid
  destination; Support + Privacy stay).
- Health: outer catch sets error state + banner with Retry
  (`runTest`), replacing silent `console.error`.
- RestockWatches empty text: "tap" → click/select wording (read
  exact string first; CTA already exists).

## Testing

- Source-guard tests: CSV button, navigate call, prefill, row
  hidden, error banner, copy.
- Verification: `pnpm check` (0 errors), `pnpm lint` (no new
  warnings), `pnpm test` (full suite green), desktop `pnpm build`.

## Non-goals

- Store listing, mobile changes.
