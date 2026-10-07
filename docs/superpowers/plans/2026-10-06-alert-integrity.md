# Alert Integrity (Anomaly Guard) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop a misparsed price from firing a false alert, on both the client and the server, without ever suppressing a genuine drop.

**Architecture:** A pure `checkPriceAnomaly` compares the triggering price to the product's recent in-stock price band (median). The client price-check and the server `buildEvents` call it before firing; a suspicious price is skipped, the alert stays armed, and a `suspicious_price` history row is recorded.

**Tech Stack:** TypeScript, React Native / Expo, Drizzle, vitest.

**Spec:** `docs/superpowers/specs/2026-10-06-alert-integrity-design.md`

---

## File Structure

- Create `lib/stats.ts` — shared `median`.
- Create `lib/alert-integrity.ts` — `checkPriceAnomaly`.
- Modify `lib/availability.ts` — use the shared `median`.
- Modify `lib/background-tasks/price-check.ts` — client guard.
- Modify `server/price-history.ts` — `getPooledHistory`.
- Modify `server/notifications/build-events.ts` — server guard.
- Modify `lib/types.ts` — `suspicious_price` history type.
- Modify `app/(tabs)/alerts.tsx` — the suppressed row.
- Tests: `tests/stats.test.ts`, `tests/alert-integrity.test.ts`, `tests/price-check-anomaly.test.ts`, `tests/build-events-anomaly.test.ts`.

---

### Task 1: Shared `median` + `checkPriceAnomaly`

**Files:** Create `lib/stats.ts`, `lib/alert-integrity.ts`; Modify `lib/availability.ts`; Tests `tests/stats.test.ts`, `tests/alert-integrity.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/stats.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { median } from "../lib/stats";

describe("median", () => {
  it("handles odd and even counts", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
  it("returns 0 for an empty list", () => {
    expect(median([])).toBe(0);
  });
});
```

Create `tests/alert-integrity.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { checkPriceAnomaly } from "../lib/alert-integrity";

describe("checkPriceAnomaly", () => {
  it("flags a price far below the history median", () => {
    const r = checkPriceAnomaly(30, [100, 100, 100, 100]);
    expect(r.suspicious).toBe(true);
    expect(r.reason).toBe("far_below_history");
  });

  it("flags a price far above the history median", () => {
    const r = checkPriceAnomaly(600, [100, 100, 100]);
    expect(r.suspicious).toBe(true);
    expect(r.reason).toBe("far_above_history");
  });

  it("does not flag a price within the band", () => {
    const r = checkPriceAnomaly(80, [100, 100, 100]);
    expect(r.suspicious).toBe(false);
  });

  it("never flags with fewer than 3 history points", () => {
    expect(checkPriceAnomaly(1, [100, 100]).suspicious).toBe(false);
    expect(checkPriceAnomaly(1, []).suspicious).toBe(false);
  });

  it("never flags a non-finite price or a non-positive median", () => {
    expect(checkPriceAnomaly(Number.NaN, [100, 100, 100]).suspicious).toBe(false);
    expect(checkPriceAnomaly(1, [0, 0, 0]).suspicious).toBe(false);
  });

  it("honors custom thresholds", () => {
    expect(checkPriceAnomaly(40, [100, 100, 100], { lowRatio: 0.5 }).suspicious).toBe(true);
    expect(checkPriceAnomaly(40, [100, 100, 100], { lowRatio: 0.3 }).suspicious).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run tests/stats.test.ts tests/alert-integrity.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

Create `lib/stats.ts`:

```ts
/** Median of a numeric list; 0 for an empty list. */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}
```

Create `lib/alert-integrity.ts`:

```ts
import { median } from "./stats";

export interface PriceAnomaly {
  suspicious: boolean;
  reason?: "far_below_history" | "far_above_history";
  median: number;
  ratio: number;
}

/**
 * Flag a price that is far outside the product's own recent in-stock band — a
 * likely misparse (a SKU, shipping figure, or accessory price read as the
 * product price). Deliberately extreme defaults so a genuine sale is never
 * suppressed; requires >= 3 history points so a real new low still fires on
 * thin data.
 */
export function checkPriceAnomaly(
  price: number,
  history: number[],
  opts: { lowRatio?: number; highRatio?: number; minPoints?: number } = {},
): PriceAnomaly {
  const lowRatio = opts.lowRatio ?? 0.3;
  const highRatio = opts.highRatio ?? 5;
  const minPoints = opts.minPoints ?? 3;
  const med = median(history);
  if (!Number.isFinite(price) || med <= 0 || history.length < minPoints) {
    return { suspicious: false, median: med, ratio: med > 0 ? price / med : 0 };
  }
  const ratio = price / med;
  if (ratio < lowRatio) return { suspicious: true, reason: "far_below_history", median: med, ratio };
  if (ratio > highRatio) return { suspicious: true, reason: "far_above_history", median: med, ratio };
  return { suspicious: false, median: med, ratio };
}
```

In `lib/availability.ts`, delete the private `median` and import it: `import { median } from "./stats";`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/stats.test.ts tests/alert-integrity.test.ts tests/availability.test.ts && pnpm check`
Expected: PASS; 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add lib/stats.ts lib/alert-integrity.ts lib/availability.ts tests/stats.test.ts tests/alert-integrity.test.ts
git commit -m "feat(alerts): price-anomaly guard + shared median"
```

---

### Task 2: Client price-check guard

**Files:** Modify `lib/background-tasks/price-check.ts`, `lib/types.ts`; Test `tests/price-check-anomaly.test.ts`

- [ ] **Step 1: Extend the history type**

In `lib/types.ts`, add `"suspicious_price"` to `NotificationHistoryEntry.type`:

```ts
  type: "price_drop" | "price_rise" | "restock" | "reminder" | "health" | "digest" | "suspicious_price";
```

- [ ] **Step 2: Write the failing test**

Create `tests/price-check-anomaly.test.ts` (mirror the existing `tests/price-check.test.ts` harness — read it first; it mocks storage, notifications, and `react-native`):

```ts
import { describe, expect, it, vi } from "vitest";
// …reuse the mocks from tests/price-check.test.ts…

// A product whose history is ~$100 but whose current best price is $3 (a
// misparse) must NOT fire; a genuine $80 drop must fire.
```

Fill in the test so it:
1. Seeds a watchlist product with `priceHistory` of several in-stock points around 100 (in the alert currency) and a current listing at 3.
2. Runs `checkPriceDropsNow` (or the exported entry point the existing test uses).
3. Asserts `deactivateAlert` was NOT called and no notification scheduled, and a `suspicious_price` history entry was recorded.
4. A second case with a current price of 80 asserts the alert DOES fire.

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm exec vitest run tests/price-check-anomaly.test.ts`
Expected: FAIL — the guard does not exist (the misparse fires).

- [ ] **Step 4: Implement**

In `lib/background-tasks/price-check.ts`, import `checkPriceAnomaly` from `@/lib/alert-integrity` and `mergedPoints` from `@/lib/product-insights`. After `bestPrice` is computed and before the `triggered` check, insert:

```ts
    const history = mergedPoints(product.listings, alert.currency).map((p) => p.v);
    const anomaly = checkPriceAnomaly(bestPrice, history);
    if (anomaly.suspicious) {
      // A likely misparse: do NOT fire, do NOT deactivate — leave the alert
      // armed so a transient bad scrape doesn't kill a real alert. Record it so
      // the suppression is observable.
      try {
        const { recordNotificationEvent } = await import("../storage");
        await recordNotificationEvent({
          id: `local-suspicious-${alert.id}-${Date.now()}`,
          type: "suspicious_price",
          title: "Suspicious price ignored",
          body: `${product.name} showed ${formatPrice(bestPrice, alert.currency)} — far from its usual price. Alert kept armed.`,
          alertId: alert.id,
          productId: alert.productId,
          triggeredPrice: bestPrice,
          currency: alert.currency,
          createdAt: Date.now(),
        });
      } catch {
        // history recording never breaks the check
      }
      track("alert_suppressed", { reason: anomaly.reason });
      continue;
    }
```

(Import `track` from `@/lib/telemetry` if not already imported.)

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec vitest run tests/price-check-anomaly.test.ts tests/price-check.test.ts && pnpm check`
Expected: PASS; 0 type errors.

- [ ] **Step 6: Commit**

```bash
git add lib/background-tasks/price-check.ts lib/types.ts tests/price-check-anomaly.test.ts
git commit -m "feat(alerts): suppress misparsed prices in the client price-check"
```

---

### Task 3: Server guard

**Files:** Modify `server/price-history.ts`, `server/notifications/build-events.ts`; Test `tests/build-events-anomaly.test.ts`

- [ ] **Step 1: Add `getPooledHistory`**

In `server/price-history.ts`:

```ts
/** Concatenate the per-distributor history for a model (for anomaly checks). */
export async function getPooledHistory(
  distributorIds: string[],
  modelNumber: string,
): Promise<PricePoint[]> {
  const out: PricePoint[] = [];
  for (const id of distributorIds) {
    out.push(...(await getHistory(id, modelNumber)));
  }
  return out;
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/build-events-anomaly.test.ts` (mirror `tests/build-events.test.ts` — read it; `buildEvents(config, now, getPrice)` is injectable):

```ts
import { describe, expect, it } from "vitest";
import { buildEvents } from "../server/notifications/build-events";

// getPrice returns a $3 price for the model; the pooled history is ~$100.
// Expect no price_drop event.
```

Fill in: inject a `getPrice` returning `{ price: 3, currency: "USD", stockStatus: "in_stock", ... }`, mock `getPooledHistory` (via `vi.mock("../server/price-history", ...)`) to return points around 100, build a config with one drop alert targeting 50, and assert no `price_drop` event. A second case with a $40 price asserts the event fires.

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm exec vitest run tests/build-events-anomaly.test.ts`
Expected: FAIL — the server fires the misparse.

- [ ] **Step 4: Implement**

In `server/notifications/build-events.ts`, import `checkPriceAnomaly` from `../../lib/alert-integrity` and `getPooledHistory` from `../price-history`. After `bestPrice` is computed and before the `isRise` check, insert:

```ts
    const historyPoints = await getPooledHistory(distributorIds, modelNumber);
    const history = historyPoints
      .map((p) => convertPrice(p.price, p.currency, alert.currency))
      .filter((v): v is number => v !== null);
    if (checkPriceAnomaly(bestPrice, history).suspicious) {
      continue; // likely a misparse; skip the event (the client owns deactivation)
    }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec vitest run tests/build-events-anomaly.test.ts tests/build-events.test.ts && pnpm check`
Expected: PASS; 0 type errors.

- [ ] **Step 6: Commit**

```bash
git add server/price-history.ts server/notifications/build-events.ts tests/build-events-anomaly.test.ts
git commit -m "feat(alerts): suppress misparsed prices on the server"
```

---

### Task 4: History row + full verification + docs

**Files:** Modify `app/(tabs)/alerts.tsx`; `todo.md`

- [ ] **Step 1: Render the suppressed row**

In `app/(tabs)/alerts.tsx`, in the price-drop history list, render a `suspicious_price` entry as a muted informational row (title "Suspicious price ignored", the body already set by the client). Match the existing history-row styling; use `colors.muted`. If the list filters by type, include `suspicious_price`.

- [ ] **Step 2: Verify it compiles**

Run: `pnpm check`
Expected: 0 type errors.

- [ ] **Step 3: Run the full gate**

Run: `pnpm verify`
Expected: exit 0.

- [ ] **Step 4: Document**

Add a `todo.md` phase entry (next number 1129): the anomaly guard (client + server), the shared `median`, the `suspicious_price` history row, and the conservative thresholds.

- [ ] **Step 5: Commit**

```bash
git add app/\(tabs\)/alerts.tsx todo.md
git commit -m "feat(alerts): suppressed-price history row + docs (Phase 1129)"
```

---

## Self-Review

- **Spec coverage:** shared median + guard (Task 1), client wiring (Task 2), server wiring (Task 3), history row + verify + docs (Task 4). Restock-transition changes are out of scope per the spec.
- **Placeholders:** none — the guard, the median, and the wiring are given verbatim; the two integration tests name the exact harness to mirror and the exact assertions.
- **Type consistency:** `median(values): number`; `checkPriceAnomaly(price, history, opts?) → PriceAnomaly { suspicious, reason?, median, ratio }`; `getPooledHistory(distributorIds, modelNumber): Promise<PricePoint[]>`; `NotificationHistoryEntry.type` includes `"suspicious_price"` — used consistently.
- **Conservative by construction:** defaults `0.3`/`5`, `minPoints 3`; non-finite/zero-median/thin-history all return `suspicious: false`.
