# Consistency Bundle — Design Spec (2026-09-10)

Seven verified mobile-parity gaps. Mirror logic and copy; desktop stack for rendering. New surface limited to two query params (`?inStock`, `?tab`) with safe fallbacks.

## §A — Stats movers + refresh

All drops/gainers as rows under "Top Drops"/"Top Gainers" (mobile `MoveRow` parity); manual Refresh (aria-label, reuses loader) + reload on route focus. Tests: multi-mover rows, refresh re-calls.

## §B — Rows, test alert, default range

`AlertRow` distributor → `` `${flag} ${name}` `` with id fallback (import already present); ProductDetail "Test Stock Alert" button via the page's existing test-notification path; Compare default `"all"` → `"3M"`.

## §C — Stat links + null-safe feed

Watchlist `?inStock=1` intake; Alerts `?tab=` intake (unknown → alerts); Home cards link with params. Activity rows null-safe (unknown status, added-at time). Tests: intake, links, null row.

## Non-goals

- New filters/tabs; row redesign; mobile changes.
