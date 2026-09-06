# Desktop P2: Watchlist Actions + Filters — Design

Date: 2026-09-06. Scope: sub-project P2 — Share, Check-Now, filters,
empty CTA on desktop Watchlist (approved).

## Problem

Desktop Watchlist has Refresh only. Missing vs mobile: Share-watchlist,
Check-Now price-drop scan, In-stock-only toggle, Min/Max price-range
inputs (sort, status pills, region/tag filters, search already exist),
and the empty state has no CTA (dead end for new users).

## Approach

Clipboard share (no Tauri share API; Web Share is mobile-only in
practice). Check-Now reuses the `checkPriceDropsNow` pipeline with a
build-verified fallback to the lightweight `refreshViaServer` helper.
Filters persist to settings like mobile. Group-by headers deferred.

## Header actions

- `desktop/src/pages/Watchlist.tsx` header: add Share button (copy
  icon) and Check-Now button (activity icon) beside Refresh.
- Share: build text with `buildWatchlistShareText` from
  `../../../lib/watchlist-share` (chain verified desktop-safe: types +
  `@shared/currency` + `watchlist-stats` → live currency + shared
  distributors, no expo/RN imports), copy via
  `navigator.clipboard.writeText` with a textarea/`execCommand`
  fallback, toast "Copied to clipboard".
- Check-Now: `checking` + `{current,total}` progress state mirroring
  mobile (`checkingRef` guard, progress label); run
  `checkPriceDropsNow(onProgress)`, then reload watchlist state.
  Buttons disabled while `refreshing || checking` or watchlist empty.
- If `expo-notifications` (top-level in
  `lib/background-tasks/price-check.ts`) breaks the desktop vite
  bundle, fall back to running `fetchServerPricesForWatchlist` +
  counts toast (same helper the Refresh path uses).

## Filters (persisted)

- Add In-stock-only toggle + Min/Max price inputs to the filter row.
- Apply inside the existing single-pass `filtered` memo: in-stock
  uses best in-stock price presence; price range compares best price
  via `getBestPrice` (same helper the sort uses).
- Persist to settings (`watchlistInStockOnly`,
  `watchlistPriceRange`) via desktop storage `saveSettings`, loaded on
  mount — same keys mobile uses.

## Empty CTA

- `EmptyState` on the empty watchlist gains an action button linking
  to `/search` ("Add products"), matching mobile's Add-Product →
  `/search`. If `EmptyState` takes no action prop, extend it with an
  optional `action: { label, to }` prop (desktop-only addition, no
  mobile impact).

## Testing

- Source-guard tests: Share/Check-Now buttons present, filter states
  persisted (settings keys), empty-state CTA links `/search`.
- Verification: `pnpm check` (0 errors), `pnpm lint` (no new
  warnings), `pnpm test` (full suite green), desktop `pnpm build`.

## Non-goals

- Group-by headers (deferred; sort row already covers ordering).
- Native share sheet, digest email changes.
- Mobile code untouched.
