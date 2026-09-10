# Deal Score Engine + Surfaces — Design

Date: 2026-09-06. Scope: deterministic deal scoring with detail,
watchlist, and badge surfaces (approved; first of smart-insights
split).

## Problem

Users can't tell "good deal" from "average" at a glance. True
price forecasting is unjustifiable on sparse history — so the
score is descriptive (where we are + where we're heading), never
predictive, with every point attributable.

## Approach

Weighted composite over shared pure helpers (range position,
trend, streak, volatility). Deterministic, offline, unit-tested
per component. No ML, no LLM, no server changes.

## Engine

- New `lib/deal-score.ts` (pure, shared):
```ts
computeDealScore(
  listings: DistributorListing[],
  currency: string,
): DealScore | null; // { score: 0–100, band: "hot"|"fair"|"wait", factors: { range, trend, streak, volatility } }
```
- Components (named constants, all documented):
  - range 50%: position of current best in 90-day min–max
    (at low → full, at high → zero, linear).
  - trend 30%: first→last move over trailing 30 days (falling →
    full, rising → zero, scaled).
  - streak 10%: active consecutive-drop streak (≥2 → full,
    scaled below).
  - volatility −10%: coefficient of variation penalty over 90
    days (stable → zero penalty).
- Bands: ≥75 hot ("Hot deal"), 40–74 fair ("Fair price"), <40
  wait ("Wait for a drop").
- Insufficient data (<3 points or <14 days span across merged
  history) → `null` — never a fake number. Single-currency
  conversion via existing helpers; unconvertible listings
  skipped (null if none convertible).

## Surfaces

- Detail card (mobile `product/[id]` + desktop ProductDetail):
  "Deal Score 82 — Hot deal" + factor breakdown lines (same
  strings both platforms).
- Watchlist sort: mobile sort enum + desktop `sortKey` column
  gain "deal" (descending score; nulls last on both).
- Badge: score ≥ 80 → "🔥 Hot deal" chip beside existing insight
  chips (mobile card + desktop name cell).

## Testing

- Unit tests per component + band boundaries + insufficient-data
  nulls + currency edge cases.
- Source guards (card, sort option, badge).
- Verification: `pnpm check` (0 errors), `pnpm lint` (no new
  warnings), `pnpm test` (full suite green), desktop `pnpm build`.

## Non-goals

- Forecasts, LLM prose, digest integration (later specs),
  alert-trigger changes, server changes.
