# "While You Were Away" Diff — Design Spec

**Date:** 2026-10-06
**Status:** Draft for review

## Goal

On opening the app, show what changed on the watchlist since the user last looked —
price drops/rises, restocks, and stock-outs — so the monitoring promise lands even
when a notification was missed or disabled.

## Problem

The app surfaces changes as one-off notifications (missable) and an opt-in digest.
There is no **"here's what happened since you last looked"** on Home. A returning
user sees the current state, not the *change* — and for a monitoring product, the
change *is* the product. If notifications were off or missed, the app looks static.

## Scope

**In scope:** a `lastSeenAt` timestamp, a pure `computeAwaySummary`, a dismissible
Home card, the wiring, and tests.

**Out of scope:** a full activity timeline (the notification center exists);
desktop parity (mobile-first).

## Architecture

### 1. Record `lastSeenAt` — `lib/storage/`

A single per-device timestamp, written on Home focus. Add `LAST_SEEN_AT` to
`STORAGE_KEYS` and `getLastSeenAt()`/`setLastSeenAt(ts)` to
`createBackgroundTaskStorage` (mirroring `getLastBackgroundRun`), wiped by
`clearAllData`.

### 2. Pure diff — `lib/away-summary.ts` (new)

```ts
export interface AwayItem {
  productId: string;
  name: string;
  /** For price changes: percent (negative = drop). */
  pct?: number;
  price?: number;
  currency?: string;
  distributorId?: string;
}

export interface AwaySummary {
  priceDrops: AwayItem[];
  priceRises: AwayItem[];
  restocks: AwayItem[];
  stockOuts: AwayItem[];
  since: number;
}

export function computeAwaySummary(input: {
  watchlist: Product[];
  since: number;
  now: number;
  displayCurrency: string;
  minDropPct?: number; // default 3
}): AwaySummary | null;
```

Derivation, all from existing data (`priceHistory`, `getBestPrice`,
`bestPricePoints`):

- **priceDrops / priceRises:** for each product, take the best price *at or before*
  `since` (the latest `bestPricePoints` point with `t <= since`) and the current
  best price; compute `pct`; bucket as drop (`pct <= -minDropPct`) or rise
  (`pct >= minDropPct`). Skip products with no point at/before `since` (no basis).
- **restocks:** a listing whose `priceHistory` has an in-stock point dated after
  `since` and no in-stock point at/before `since` (i.e. it became available).
- **stockOuts:** a listing with an in-stock point at/before `since` and no in-stock
  point after (i.e. it went away).
- Returns `null` when every bucket is empty (no "no changes" card).

### 3. Home card — `components/home/away-summary-card.tsx` (new)

A dismissible card at the top of Home (above `AvailableSection`):

> **While you were away** · 3 price drops · 1 back in stock · 1 now out of stock
> [top 3 items: name + change] · "See all"

- Each item taps → `/product/[id]`.
- "See all" expands to the full list (local state).
- A close (`xmark`) sets a per-session dismissed state.
- Rendered only when `computeAwaySummary` is non-null.
- Uses `useColors()`, `IconSymbol`, and the app's card styling.

### 4. Wiring — `app/(tabs)/index.tsx`

- On mount (and Home focus), read `lastSeenAt`; if non-null, compute the summary
  over `[lastSeenAt, now]` and store it in state; then `setLastSeenAt(now)`.
- If `lastSeenAt` is null (first visit), skip the card and just set it.
- Render `<AwaySummaryCard summary={...} onDismiss={...} />` above
  `<AvailableSection />` when the summary is non-null and not dismissed.

## Data Flow

1. Home opens → read `lastSeenAt`.
2. `computeAwaySummary` diffs the watchlist over `[lastSeenAt, now]`.
3. The card renders; `setLastSeenAt(now)` so the next visit diffs from here.

## Error Handling

- First visit (`lastSeenAt` null) → no card.
- No changes → `null` → no card.
- A product with no history at/before `since` → skipped (no false "no change").
- Storage read failure → treat as first visit (no card).

## Testing

- `tests/away-summary.test.ts` — a price drop beyond the threshold; a rise; a
  restock; a stock-out; nothing changed → null; a product with no pre-`since`
  history → skipped; the `minDropPct` boundary.
- `tests/last-seen-storage.test.ts` — round-trip; wiped by `clearAllData`.
- `tests/away-summary-card.test.tsx` — renders the counts and items; calls
  `onDismiss`; renders nothing when `summary` is null.
- Existing tests stay green.

## Success Criteria

- Opening the app after changes shows a "While you were away" card with the right
  counts and tappable items.
- No card on first visit or when nothing changed.
- `pnpm verify` stays green.

## Risks

- **False "no change"** → a product with no pre-`since` history is skipped, not
  reported as unchanged.
- **Noise** → `minDropPct` (default 3%) filters trivial moves.
- **Double-counting the digest** → this is the on-open diff; the digest is
  scheduled/emailed and independent.
