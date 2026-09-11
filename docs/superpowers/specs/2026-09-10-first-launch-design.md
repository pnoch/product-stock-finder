# First-Launch Bundle — Design Spec (2026-09-10)

Six verified gaps that make a fresh desktop install feel empty and idle. Mirror mobile logic verbatim; desktop stack for rendering. Open import-compatibility questions resolve in planning, not implementation.

## §A — App launch sequence

`desktop/src/App.tsx` mount effect: seed the same 7 ids (`freshenSampleListings` + MikroTik backfill, skip-when-present); start the price poller when `checkInterval !== "manual"` (Settings keeps managing later changes); warm FX via `loadFxRates`/`maybeRefreshFxRates`. All best-effort with dev logs. Tests: seed/skip, poller start/skip, FX attempt.

## §B — Discovery ordering

Empty-query search shows top-10 by `inStock × 10 + listings` (`previewStockScore`, `PREVIEW_LIMIT = 10`, shared helper if SearchModal shares the path); Home Recent Activity collapses to freshest-listing-per-product then top-5. Tests: order + limit + distinct products.

## §C — Restock CTA target

Empty state → `/search` ("Browse Products", verbatim mobile). Cheapest effective test.

## Non-goals

- Catalog changes; seed-set changes; poller scheduling changes; mobile changes.
