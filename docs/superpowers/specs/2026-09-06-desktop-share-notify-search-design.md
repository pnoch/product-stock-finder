# Desktop Share + Notifications + Search Tags — Design

Date: 2026-09-06. Scope: compare share, product image share,
notification open/read, search tag matches (approved).

## Problem

1. Desktop Compare has no share; ProductDetail shares text only.
2. Desktop notification items are dead-ends (no open, no
   single-read).
3. Desktop Search tag filter matches pre-add staging only, with
   empty counts — filtering by a tracked tag yields nothing.

## Approach

Mirror mobile with desktop idioms (clipboard/download instead of
share sheets). Server event pull explicitly out (substantial
upload/reconcile/schedule pipeline — own spec).

## Compare share

- `desktop/src/pages/Compare.tsx` header Share button:
  `buildShareText({ product, listings, displayCurrency, limit: 5 })`
  (`lib/price-share.ts`, verified desktop-safe) + deep link
  `${origin}/#/compare/${id}` → clipboard + toast (same pattern as
  ProductDetail's existing share). No image (no shareable compare
  card component).

## Product image share

- ProductDetail: "Save image" button beside text share — PNG
  download of the detail header card via `toPng` (`html-to-image`
  already installed; Stats precedent). Existing text share
  untouched.

## Notification open + single read

- Desktop Alerts notifications tab: items with `productId` become
  links (`/product/{id}`; `health` type with `distributorId` →
  `/health/{distributorId}`); clicking an unread item calls
  `storage.markNotificationRead(id)` (full createStorage API
  present) and updates local state. Mark-all-read stays.

## Search tag matches

- Desktop Search: mirror mobile (`app/search.tsx:278-302`) —
  compute watchlist id set via `filterWatchlist` on selected tags,
  filter catalog results to matches (untracked items always pass),
  "showing watchlist matches only" banner when filtered, real
  counts via `countTagMatches` (replacing `counts={{}}`).

## Testing

- Source-guard tests: share buttons, notification links +
  single-read, tag-match filtering + counts.
- Verification: `pnpm check` (0 errors), `pnpm lint` (no new
  warnings), `pnpm test` (full suite green), desktop `pnpm build`.

## Non-goals

- Server event pull/sync, image share on Compare, mobile changes.
