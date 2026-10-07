# Alert Integrity (Anomaly Guard) — Design Spec

**Date:** 2026-10-06
**Status:** Draft for review

## Goal

Stop a misparsed price from firing a false alert. The product's core promise is
"get told the second it restocks or drops" — a false alert breaks that promise,
and it is the #1 churn driver for a monitoring product.

## Problem

The alert fires purely on `bestPrice <= targetPrice`, guarded only by
`isPlausiblePrice` (`> 0 && <= 1e7`). A SKU, shipping figure, or accessory price
misread as the product price passes plausibility and fires a false
**"CRS804 dropped to $326!"**. There is no comparison against the product's own
history. This affects **both** the client price-check and the server's
`buildEvents` (which also evaluates price alerts).

## Scope

**In scope:** a pure `checkPriceAnomaly`, wiring it into the client price-check
and the server `buildEvents`, a shared `median` helper, a suppressed-alert
history entry, and tests.

**Out of scope:** restock-transition changes (the existing `lastKnownStatus`
transition logic already guards those); any UI beyond a history row.

## Architecture

### 1. Shared `median` — `lib/stats.ts` (new)

Extract the `median` currently private in `lib/availability.ts` into
`lib/stats.ts` and import it from both (removes the duplication).

```ts
export function median(values: number[]): number;
```

### 2. `lib/alert-integrity.ts` (new) — pure

```ts
export interface PriceAnomaly {
  suspicious: boolean;
  reason?: "far_below_history" | "far_above_history";
  median: number;
  ratio: number; // price / median
}

export function checkPriceAnomaly(
  price: number,
  history: number[],
  opts?: { lowRatio?: number; highRatio?: number; minPoints?: number },
): PriceAnomaly;
```

- `history` = recent in-stock prices, converted to the alert currency.
- Compute `median(history)`; `ratio = price / median`.
- **Suspicious** when `ratio < lowRatio` (default `0.3`) → `"far_below_history"`,
  or `ratio > highRatio` (default `5`) → `"far_above_history"`.
- **Never suspicious** when `history.length < minPoints` (default `3`), when
  `median <= 0`, or when `price` is non-finite — a genuinely new low must fire on
  thin data.
- Returns `{ suspicious: false, median, ratio }` otherwise.

The defaults are deliberately extreme so a real sale is never suppressed; only
gross misparses are caught.

### 3. Client wiring — `lib/background-tasks/price-check.ts`

Before firing a price alert, build `history` from
`mergedPoints(product.listings, alert.currency).map((p) => p.v)` (already
imported elsewhere) and call `checkPriceAnomaly(bestPrice, history)`. If
`suspicious`:

- **Do not fire, do not deactivate** the alert (leave it armed — a transient
  misparse must not kill a real alert).
- Record a `suspicious_price` entry in notification history (so the suppression
  is observable, not silent).
- `track("alert_suppressed", { reason })`.
- `continue` to the next alert.

### 4. Server wiring — `server/notifications/build-events.ts`

The server evaluates price alerts too. Add a pooled-history read and the same
guard:

- New `server/price-history.ts` helper `getPooledHistory(distributorIds, modelNumber)`
  → `PricePoint[]` (concatenate `getHistory` per distributor).
- In the `alerts` loop, after computing `bestPrice`, read the pooled history for
  the alert's `distributorIds`, convert each point to `alert.currency`, and call
  `checkPriceAnomaly`. If `suspicious`, `continue` (no event).
- The server does not deactivate alerts (the client owns that), so suppression
  simply skips the event.

### 5. Surfacing — Alerts tab history

Extend `NotificationHistoryEntry.type` in `lib/types.ts` with
`"suspicious_price"`. `app/(tabs)/alerts.tsx`'s price-drop history renders a
`suspicious_price` entry as a muted, informational row ("Suppressed a suspicious
price for X — likely a misparse"). No new screen.

## Data Flow

1. A scrape yields a misparsed price.
2. Client/server computes the product's recent in-stock price band.
3. `checkPriceAnomaly` flags the price as far below the band.
4. The alert is not fired, stays armed, and a `suspicious_price` history row is
   recorded.

## Error Handling

- No history / < 3 points → not suspicious (fire as today).
- `mergedPoints`/`getPooledHistory` failure → treat as no history (fire as today,
  never block a real alert on a guard error).
- The guard never throws; a bad value returns `suspicious: false`.

## Testing

- `tests/alert-integrity.test.ts` — below-band → suspicious; above-band →
  suspicious; within band → not; `< 3` points → not; non-finite price → not;
  median `<= 0` → not; custom thresholds.
- `tests/price-check-anomaly.test.ts` — a misparsed price does **not** fire and
  the alert stays active; a real drop fires; the suppressed history entry is
  recorded.
- `tests/build-events-anomaly.test.ts` — the server skips a suspicious price
  (inject a `getPrice` + pooled history).
- `tests/stats.test.ts` — `median` (odd/even/empty).
- Existing alert/price-check/build-events tests stay green.

## Success Criteria

- A price far outside the product's recent band does not fire an alert (client
  and server), and the alert stays armed.
- A genuine drop still fires.
- The suppression is recorded in history.
- `pnpm verify` stays green.

## Risks

- **Suppressing a real drop** → the thresholds are extreme (0.3×/5×) and require
  ≥3 history points; a real sale is never suppressed.
- **Extra history reads on the server** → bounded to the alert's distributors per
  tick; the pooled read is small.
- **Threshold tuning** → the defaults are conservative; a future setting can
  expose them.
