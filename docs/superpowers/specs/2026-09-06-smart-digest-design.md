# Smart Digest: Best-Time-to-Buy Ranking — Design

Date: 2026-09-06. Scope: ranked hot deals inside both digest
cards (approved; second of smart-insights split).

## Problem

Digest cards report what changed, never what to do. The deal
engine already scores every product — surfacing its top ranks
where users review changes closes the loop.

## Approach

Pure ranking helper + sections in both digest cards with
identical strings. No server changes.

## Ranking helper

- `lib/deal-score.ts`: `rankDeals(products, currency, limit =
  3): { productId, name, score, band }[]` — scores all via
  `computeDealScore`, drops nulls, sorts desc, takes top N.
  Pure + unit-tested (order, null exclusion, limit, ties,
  empty → []).

## Mobile digest card

- `components/stats/digest-card.tsx`: "Best time to buy" section
  (after summary, before change lists) with top-3 rows: name +
  score + band chip. Rows pressable → `router.push` product
  detail (digest rows are currently plain Views — this section
  introduces navigation; existing rows stay as-is).

## Desktop digest card

- `desktop/src/pages/Stats.tsx` digest section: same strings,
  rows as `Link` to `/product/{id}`.

## Testing

- Unit tests for `rankDeals`; guards (section both platforms).
- Verification: `pnpm check` (0 errors), `pnpm lint` (no new
  warnings), `pnpm test` (full suite green), desktop `pnpm build`.

## Non-goals

- Push/notification triggers, digest email content, forecast
  copy ("best time" is present-tense ranking, never prediction).
- Server changes.
