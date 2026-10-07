# Availability Intelligence — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Derive and surface the scarcity signal already recorded in `priceHistory` — in-stock rate, last seen, restock cadence — as a product-detail card and a watchlist badge.

**Architecture:** A pure `lib/availability.ts` pools every listing's history, day-buckets it, and returns `Availability | null` (null below 7 sample days). A card and a badge render it; nothing is stored.

**Tech Stack:** TypeScript, React Native / Expo, vitest.

**Spec:** `docs/superpowers/specs/2026-10-06-availability-intelligence-design.md`

---

## File Structure

- Create `lib/availability.ts` — `computeAvailability`.
- Create `components/product/availability-card.tsx` — the card.
- Create `components/watchlist/scarcity-badge.tsx` — the badge.
- Modify `app/product/[id].tsx` — render the card.
- Modify `components/watchlist/product-card.tsx` — render the badge.
- Tests: `tests/availability.test.ts`, `tests/availability-card.test.tsx`.

---

### Task 1: `computeAvailability`

**Files:** Create `lib/availability.ts`; Test `tests/availability.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/availability.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { computeAvailability } from "../lib/availability";
import type { DistributorListing } from "../lib/types";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-03-01T12:00:00.000Z");

// Build a listing whose history has one point per day for `days`, in stock on
// the given day indices (0 = oldest).
function listing(days: number, inStockDays: number[]): DistributorListing {
  return {
    distributorId: "d1",
    productId: "p1",
    price: 100,
    currency: "USD",
    stockStatus: "in_stock",
    url: "",
    lastChecked: new Date(NOW).toISOString(),
    priceHistory: Array.from({ length: days }, (_, i) => ({
      date: new Date(NOW - (days - 1 - i) * DAY).toISOString(),
      price: 100,
      currency: "USD",
      stockStatus: inStockDays.includes(i) ? "in_stock" : "out_of_stock",
    })),
  } as DistributorListing;
}

describe("computeAvailability", () => {
  it("returns null below 7 sample days", () => {
    expect(computeAvailability([listing(6, [5])], NOW)).toBeNull();
  });

  it("returns a result at 7 sample days", () => {
    expect(computeAvailability([listing(7, [6])], NOW)).not.toBeNull();
  });

  it("computes inStockRate over distinct days", () => {
    // 10 days, in stock on 2 of them -> 0.2
    const a = computeAvailability([listing(10, [0, 9])], NOW)!;
    expect(a.sampleDays).toBe(10);
    expect(a.inStockRate).toBeCloseTo(0.2, 5);
  });

  it("reports the most recent in-stock day", () => {
    const a = computeAvailability([listing(10, [0, 5])], NOW)!;
    // day index 5 of 10 -> 4 days before NOW
    expect(a.lastInStockAt).toBe(NOW - 4 * DAY);
  });

  it("computes the longest outage", () => {
    // in stock day 0, then 8 days out, then in stock day 9 -> outage 8
    const a = computeAvailability([listing(10, [0, 9])], NOW)!;
    expect(a.longestOutageDays).toBe(8);
  });

  it("computes the median restock gap", () => {
    // in stock on 0, 3, 9 -> gaps 3 and 6 -> median 4.5
    const a = computeAvailability([listing(10, [0, 3, 9])], NOW)!;
    expect(a.typicalRestockDays).toBeCloseTo(4.5, 5);
  });

  it("returns null cadence when there is no transition", () => {
    const a = computeAvailability([listing(10, [0, 1, 2])], NOW)!;
    expect(a.typicalRestockDays).toBeNull();
  });

  it("classifies scarcity at the boundaries", () => {
    // 10 days: 1 in stock -> 0.1 -> rare
    expect(computeAvailability([listing(10, [9])], NOW)!.scarcity).toBe("rare");
    // 10 days: 2 in stock -> 0.2 -> occasional
    expect(computeAvailability([listing(10, [0, 9])], NOW)!.scarcity).toBe("occasional");
    // 10 days: 5 in stock -> 0.5 -> common
    expect(computeAvailability([listing(10, [5, 6, 7, 8, 9])], NOW)!.scarcity).toBe("common");
  });

  it("buckets multiple points in one day once, any in-stock marks the day", () => {
    const l = listing(10, []);
    // Two points on the last day; one in stock.
    l.priceHistory.push(
      { date: new Date(NOW).toISOString(), price: 1, currency: "USD", stockStatus: "out_of_stock" },
      { date: new Date(NOW).toISOString(), price: 1, currency: "USD", stockStatus: "in_stock" },
    );
    const a = computeAvailability([l], NOW)!;
    expect(a.sampleDays).toBe(10);
    expect(a.inStockRate).toBeCloseTo(0.1, 5);
  });

  it("skips non-finite dates", () => {
    const l = listing(10, [9]);
    l.priceHistory.push({ date: "not-a-date", price: 1, currency: "USD", stockStatus: "in_stock" });
    const a = computeAvailability([l], NOW)!;
    expect(a.sampleDays).toBe(10);
  });

  it("pools across listings", () => {
    const a = computeAvailability([listing(10, [0]), listing(10, [9])], NOW)!;
    expect(a.sampleDays).toBe(10);
    expect(a.inStockRate).toBeCloseTo(0.2, 5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/availability.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `lib/availability.ts`:

```ts
import type { DistributorListing } from "./types";

export type Scarcity = "rare" | "occasional" | "common";

export interface Availability {
  /** Fraction of observed days in stock, 0..1. */
  inStockRate: number;
  /** Epoch ms of the most recent in-stock day, or null. */
  lastInStockAt: number | null;
  /** Longest consecutive run of non-in-stock days. */
  longestOutageDays: number;
  /** Median days between an outage and the next in-stock, or null. */
  typicalRestockDays: number | null;
  /** Distinct days observed in the window (confidence). */
  sampleDays: number;
  scarcity: Scarcity;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_SAMPLE_DAYS = 7;

function dayKey(date: string): string {
  return date.slice(0, 10);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

/**
 * Scarcity signal derived from price history. Product-level: every listing's
 * history is pooled, because "how hard is this to get anywhere" is the question.
 * Returns null below the sample threshold so a young product shows nothing
 * rather than a confident lie.
 */
export function computeAvailability(
  listings: DistributorListing[],
  now = Date.now(),
  windowDays = 90,
): Availability | null {
  const cutoff = now - windowDays * DAY_MS;
  // day key -> in stock that day (any listing)
  const byDay = new Map<string, boolean>();
  for (const listing of listings) {
    for (const point of listing.priceHistory ?? []) {
      const t = Date.parse(point.date);
      if (!Number.isFinite(t) || t < cutoff) continue;
      const key = dayKey(point.date);
      const inStock = point.stockStatus === "in_stock";
      byDay.set(key, (byDay.get(key) ?? false) || inStock);
    }
  }
  const sampleDays = byDay.size;
  if (sampleDays < MIN_SAMPLE_DAYS) return null;

  // Ascending day order for run/gap analysis.
  const days = [...byDay.entries()]
    .map(([key, inStock]) => ({ t: Date.parse(`${key}T00:00:00.000Z`), inStock }))
    .sort((a, b) => a.t - b.t);

  const inStockDays = days.filter((d) => d.inStock).length;
  const inStockRate = inStockDays / sampleDays;

  const lastInStock = [...days].reverse().find((d) => d.inStock);
  const lastInStockAt = lastInStock ? lastInStock.t : null;

  // Longest consecutive non-in-stock run.
  let longestOutageDays = 0;
  let run = 0;
  for (const d of days) {
    if (d.inStock) {
      run = 0;
    } else {
      run += 1;
      if (run > longestOutageDays) longestOutageDays = run;
    }
  }

  // Gaps between successive in-stock days that had an outage between them
  // (a run of consecutive in-stock days is one availability window, not a
  // restock). Median of those gaps is the observed restock cadence.
  const inStockDayIndices = days
    .map((d, i) => (d.inStock ? i : -1))
    .filter((i) => i >= 0);
  const gaps: number[] = [];
  for (let i = 1; i < inStockDayIndices.length; i++) {
    const gap = inStockDayIndices[i]! - inStockDayIndices[i - 1]!;
    if (gap > 1) gaps.push(gap);
  }
  const typicalRestockDays = gaps.length > 0 ? median(gaps) : null;

  const scarcity: Scarcity =
    inStockRate < 0.15 ? "rare" : inStockRate < 0.5 ? "occasional" : "common";

  return {
    inStockRate,
    lastInStockAt,
    longestOutageDays,
    typicalRestockDays,
    sampleDays,
    scarcity,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/availability.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/availability.ts tests/availability.test.ts
git commit -m "feat(availability): derive scarcity from price history"
```

---

### Task 2: Availability card

**Files:** Create `components/product/availability-card.tsx`; Test `tests/availability-card.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/availability-card.test.tsx` (mirror the jsdom harness in `tests/country-picker.test.tsx`):

```tsx
// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";

vi.mock("react-native", async () => {
  const React = await import("react");
  return {
    View: ({ children, ...r }: any) => React.createElement("div", r, children),
    Text: ({ children, ...r }: any) => React.createElement("span", r, children),
  };
});
vi.mock("@/hooks/use-colors", () => ({
  useColors: () => ({ surface: "#fff", foreground: "#111", muted: "#888", border: "#ddd", success: "#0a0", warning: "#fa0", error: "#f00" }),
}));

import { AvailabilityCard } from "../components/product/availability-card";

afterEach(cleanup);

describe("AvailabilityCard", () => {
  it("renders the scarcity label and rate", () => {
    render(
      <AvailabilityCard
        data={{ inStockRate: 0.12, lastInStockAt: Date.now() - 8 * 86400000, longestOutageDays: 30, typicalRestockDays: 21, sampleDays: 90, scarcity: "rare" }}
      />,
    );
    expect(screen.getByText(/Rare/i)).toBeTruthy();
    expect(screen.getByText(/12%/)).toBeTruthy();
  });

  it("omits the cadence clause when there is none", () => {
    render(
      <AvailabilityCard
        data={{ inStockRate: 0.5, lastInStockAt: null, longestOutageDays: 0, typicalRestockDays: null, sampleDays: 10, scarcity: "common" }}
      />,
    );
    expect(screen.queryByText(/restocks/i)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/availability-card.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `components/product/availability-card.tsx`, mirroring `components/product/price-vs-avg-card.tsx` (surface/border/padding, `useColors()`, an accessibility label). Props:

```ts
export function AvailabilityCard({ data }: { data: Availability }): JSX.Element;
```

Render:
- A scarcity label: `rare` → "Rare", `occasional` → "Occasional", `common` → "Usually available", colored (`rare` → `colors.error`, `occasional` → `colors.warning`, `common` → `colors.success`).
- `In stock ${Math.round(data.inStockRate * 100)}% of the time`.
- When `lastInStockAt` is non-null: `Last seen ${relativeDays(lastInStockAt)}` (a small local helper: `"today"` / `"${n} days ago"`).
- When `typicalRestockDays` is non-null: `Typically restocks ~every ${Math.round(typicalRestockDays)} days`.

The accessibility label joins the same clauses.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/availability-card.test.tsx && pnpm check`
Expected: PASS (2 tests); 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add components/product/availability-card.tsx tests/availability-card.test.tsx
git commit -m "feat(availability): product-detail availability card"
```

---

### Task 3: Scarcity badge + wire both surfaces

**Files:** Create `components/watchlist/scarcity-badge.tsx`; Modify `app/product/[id].tsx`, `components/watchlist/product-card.tsx`

- [ ] **Step 1: Implement the badge**

Create `components/watchlist/scarcity-badge.tsx`:

```ts
export function ScarcityBadge({ scarcity }: { scarcity: Scarcity }): JSX.Element;
```

A small pill: `rare` → "Rare" (`colors.error`), `occasional` → "Occasional" (`colors.warning`), `common` → "Usually available" (`colors.success`). Same styling family as `components/stock-badge.tsx`.

- [ ] **Step 2: Wire the product detail card**

In `app/product/[id].tsx`, compute `const availability = useMemo(() => computeAvailability(listings), [listings]);` and render `{availability && <AvailabilityCard data={availability} />}` next to the `PriceVsAvgCard` (line ~678). Import `computeAvailability` from `@/lib/availability` and `AvailabilityCard` from `@/components/product/availability-card`.

- [ ] **Step 3: Wire the watchlist badge**

In `components/watchlist/product-card.tsx`, compute `const availability = useMemo(() => computeAvailability(product.listings ?? []), [product.listings]);` and render `{availability && <ScarcityBadge scarcity={availability.scarcity} />}` near the `StockBadge` (line ~367). Import `computeAvailability` and `ScarcityBadge`.

- [ ] **Step 4: Verify it compiles**

Run: `pnpm check`
Expected: 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add components/watchlist/scarcity-badge.tsx app/product/\[id\].tsx components/watchlist/product-card.tsx
git commit -m "feat(availability): scarcity badge + wire card and badge"
```

---

### Task 4: Full verification + docs

**Files:** `todo.md`

- [ ] **Step 1: Run the full gate**

Run: `pnpm verify`
Expected: exit 0.

- [ ] **Step 2: Document**

Add a `todo.md` phase entry (next number 1126): the availability derivation, the card, the badge, and the note that per-distributor availability and restock prediction are deferred.

- [ ] **Step 3: Commit**

```bash
git add todo.md
git commit -m "docs: availability intelligence (Phase 1126)"
```

---

## Self-Review

- **Spec coverage:** derivation (Task 1), card (Task 2), badge + wiring (Task 3), verify + docs (Task 4). Per-distributor availability and prediction are out of scope per the spec.
- **Placeholders:** none — the derivation, the card props, and the tests are given verbatim.
- **Type consistency:** `Scarcity = "rare" | "occasional" | "common"`; `Availability { inStockRate, lastInStockAt, longestOutageDays, typicalRestockDays, sampleDays, scarcity }`; `computeAvailability(listings, now?, windowDays?)`; `AvailabilityCard({ data })`; `ScarcityBadge({ scarcity })` — used consistently.
- **Thresholds:** `MIN_SAMPLE_DAYS = 7`; scarcity boundaries 0.15 / 0.5 — pinned by tests.
