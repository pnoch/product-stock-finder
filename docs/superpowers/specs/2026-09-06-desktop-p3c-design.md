# Desktop P3c: Not-Found Actions + Stats Share/Export — Design

Date: 2026-09-06. Scope: P3c polish — ProductDetail dead end, Stats
share with PNG export (approved: option 2).

## Problem

1. Desktop ProductDetail not-found shows Back only — a dead end when
   the product exists but failed to load. Mobile offers Try Again +
   Go back.
2. Desktop Stats has no share/export. Mobile shares stats as image
   with text fallback.

## Approach

Try Again re-runs the page load. Stats export uses `html-to-image`
(`toPng`, MIT, dependency-free, Chromium/Tauri-safe) with the same
image→text fallback order as mobile.

## Not-found actions

- `desktop/src/pages/ProductDetail.tsx`: add "Try Again" button
  beside Back in the not-found block, calling the page's existing
  product reload (read the load function/effect first), keeping Back
  as secondary. Mirrors mobile's `EmptyStateView` try-again/go-back
  pair.

## Stats share/export

- New dependency: `html-to-image` in `desktop/package.json` (pinned;
  `pnpm add` with workdir `desktop/`).
- `desktop/src/pages/Stats.tsx`: header Share button (copy icon,
  `aria-label="Share stats"`). Flow mirrors mobile's fallback order:
  capture the summary card node (ref on the summary container —
  read the render first, pick the top summary card block) via
  `toPng(node)` → trigger download
  (`stats-watchlist.png`, anchor + object URL) → toast "Stats image
  saved". On capture failure, fall back to text: clipboard copy of
  `buildWatchlistShareText({ watchlist: products, displayCurrency,
  days: 30 })` (same helper mobile's text path uses, already proven
  desktop-safe) with textarea fallback + toasts — identical shape to
  the P2 Watchlist share handler.
- No ClipboardItem image-copy (support varies); download is
  deterministic everywhere desktop runs.

## Testing

- Source-guard tests: Try Again wired to reload; Stats share uses
  `toPng` with text fallback via `buildWatchlistShareText`.
- Verification: `pnpm check` (0 errors), `pnpm lint` (no new
  warnings), `pnpm test` (full suite green), desktop `pnpm build`
  (validates the new dependency bundles).

## Non-goals

- Image-copy-to-clipboard, other export formats.
- Mobile/server changes; password reset and onboarding stay deferred.
