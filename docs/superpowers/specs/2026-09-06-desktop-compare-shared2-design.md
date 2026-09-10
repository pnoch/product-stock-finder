# Desktop Compare + Shared Upgrades 2 — Design

Date: 2026-09-06. Scope: compare header actions, trend sort,
chart image, shared rows/export (approved).

## Problem

1. Desktop Compare has no Back/Refresh in-header; not-found has
   no CTA; no chart image export; no trend sort.
2. Shared rows show one listing; no per-product history export;
   created/last-shared info missing.

## Approach

Mirror mobile logic with desktop UI (buttons/download instead of
native share). No new dependencies, no server changes.

## Compare header + not-found

- `desktop/src/pages/Compare.tsx` header: Back button (→
  `/watchlist`, predictable) + Refresh button (re-runs
  `loadCompare` with its loading state — read signature first)
  beside Share.
- Not-found `EmptyState`: `action={{ label: "Back to watchlist",
  to: "/watchlist" }}` (prop exists; error-state Retry already
  covers transient failure).

## Chart image + trend sort

- "Save image" button beside Share: `toPng` on the chart
  container ref → `compare-{id}.png` download + toast
  (`html-to-image` installed; Stats precedent).
- `sortBy` gains `"trend"`: biggest-drop-first mirrored from
  mobile (`app/compare/[id].tsx:251-261` — read first).
  Current default unchanged (no behavior change for existing
  users).

## Shared rows + history export

- `desktop/src/pages/SharedWatchlist.tsx`: up to 5 listings per
  product with "+N more" overflow line (distributor name + price
  + stock badge each, reusing row markup).
- Per-product "Export history" button:
  `productHistoryToCsv(product)` (`lib/csv.ts`) →
  `{productId}-history.csv` download + toast.
- Meta line: created + last-shared + expiry labels from share
  data (read field names first — `createdAt`/`expiresAt` known,
  confirm the shared/last-shared field).

## Testing

- Source-guard tests: header buttons, not-found action, image
  export, trend sort, rows/export/labels.
- Verification: `pnpm check` (0 errors), `pnpm lint` (no new
  warnings), `pnpm test` (full suite green), desktop `pnpm build`.

## Non-goals

- Image-clipboard (download only), mobile changes.
