# Availability Intelligence — Design Spec

**Date:** 2026-10-06
**Status:** Draft for review

## Goal

Surface the scarcity signal the app already records: how hard a product is to
get, when it was last available, and how often it restocks. This is the
capability that makes the product a *scarcity radar* rather than a price tracker.

## Problem

`PricePoint.stockStatus` is captured on every scrape, synced, and stored — but no
screen derives anything from it. The app knows a part is hard to get and never
says so. A user cannot answer "how hard is this to find?", "when was it last
available?", or "how often does it restock?".

## Scope

**In scope:** a pure `lib/availability.ts` derivation, an "Availability" card on
product detail, a scarcity badge on watchlist cards, and tests.

**Out of scope:** per-distributor availability (product-level only for now);
restock *prediction* (we show observed cadence, not a forecast); any server
change (the data is already client-side in `priceHistory`).

## Architecture

### 1. `lib/availability.ts` (new) — pure derivation

Mirrors `lib/price-average.ts`: same `(listings, now, windowDays)` shape, same
null-when-insufficient contract.

```ts
export type Scarcity = "rare" | "occasional" | "common";

export interface Availability {
  /** Fraction of observed days in stock, 0..1. */
  inStockRate: number;
  /** Epoch ms of the most recent in-stock point, or null. */
  lastInStockAt: number | null;
  /** Longest consecutive run of non-in-stock days. */
  longestOutageDays: number;
  /** Median days between an outage and the next in-stock, or null. */
  typicalRestockDays: number | null;
  /** Distinct days observed in the window (confidence). */
  sampleDays: number;
  scarcity: Scarcity;
}

export function computeAvailability(
  listings: DistributorListing[],
  now?: number,
  windowDays?: number,
): Availability | null;
```

**Product-level** — pool every listing's `priceHistory` (the scarcity signal is
"how hard is this to get *anywhere*", matching the radar thesis).

**Day bucketing** — collapse points to distinct UTC days (`date.slice(0,10)`); a
day counts as in-stock if **any** listing had an in-stock point that day. This
avoids one distributor's frequent polling dominating the rate.

**Derivation:**
- `inStockRate = inStockDays / sampleDays`.
- `lastInStockAt` = the most recent in-stock day's timestamp.
- `longestOutageDays` = the longest consecutive run of non-in-stock days.
- `typicalRestockDays` = the median gap (in days) between a non-in-stock day
  followed by an in-stock day; null if no such transition.
- `scarcity`: `inStockRate < 0.15` → `"rare"`; `< 0.5` → `"occasional"`; else
  `"common"`.

**Confidence gate:** return `null` when `sampleDays < 7` (a 2-day-old product
shows nothing rather than a confident lie).

### 2. Product detail — "Availability" card

`components/product/availability-card.tsx`, mirroring `PriceVsAvgCard` (same
surface/border/padding, `useColors()`, an accessibility label):

> **Rare** · In stock 12% of the time · Last seen 8 days ago · Typically
> restocks ~every 21 days

Each clause is omitted when its value is unavailable (`lastInStockAt` null,
`typicalRestockDays` null). Rendered in `app/product/[id].tsx` next to
`PriceVsAvgCard` when `computeAvailability(listings)` is non-null.

### 3. Watchlist — scarcity badge

`components/watchlist/product-card.tsx` gains a small badge
("Rare" / "Occasional" / "Usually available") derived from the same
`computeAvailability`, so the watchlist reads as a scarcity board. Omitted when
`computeAvailability` returns null.

## Data Flow

1. `priceHistory` is already populated (device scrape + server backfill).
2. Product detail / watchlist call `computeAvailability(listings)`.
3. The card/badge renders the derived signals; nothing is stored.

## Error Handling

- `computeAvailability` returns `null` below 7 sample days or with no history.
- Non-finite dates are skipped (mirrors `price-average`).
- A product with no in-stock day ever → `inStockRate 0`, `lastInStockAt null`,
  `scarcity "rare"` (still meaningful).

## Testing

- `tests/availability.test.ts`:
  - null below the 7-day threshold; non-null at 7.
  - `inStockRate` across a known day sequence.
  - `lastInStockAt` = most recent in-stock day.
  - `longestOutageDays` for a known gap.
  - `typicalRestockDays` = median of known gaps; null with no transition.
  - scarcity thresholds at the boundaries (0.15, 0.5).
  - day-bucketing: multiple points in one day count once; any in-stock point
    marks the day in-stock.
  - non-finite dates skipped.
- A source-guard test that the card/badge render only when non-null (mirroring
  the `price-vs-avg` guard style).

## Success Criteria

- A product with ≥7 days of history shows an Availability card with the scarcity
  label, in-stock rate, last-seen, and cadence.
- The watchlist shows a scarcity badge.
- Products with too little history show nothing (no false confidence).
- `pnpm verify` stays green.

## Risks

- **Sparse history** → the 7-day gate; the card omits unavailable clauses.
- **FX skew** → availability is currency-independent (counts days, not prices),
  so it avoids the `price-average` FX caveat entirely.
- **Over-claiming a forecast** → we show observed cadence ("typically restocks
  ~every 21 days"), never a predicted date.
