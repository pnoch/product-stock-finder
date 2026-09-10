# Deal Score Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deterministic deal scores with detail, sort, and badge surfaces on both platforms.

**Architecture:** Pure `lib/deal-score.ts` engine (own unit tests) + thin UI wiring: mobile via shared `sortWatchlist` + card/chips, desktop via own sort switch + card/chips. No server changes.

**Tech Stack:** TypeScript, vitest.

**Spec:** `docs/superpowers/specs/2026-09-06-deal-score-design.md`

---

### Task 1: Engine + unit tests

**Files:**
- Create: `lib/deal-score.ts`, `tests/deal-score.test.ts`

- [ ] **Step 1: Write the engine**

```ts
import type { DistributorListing } from "./types";

export type DealBand = "hot" | "fair" | "wait";

export interface DealScore {
  score: number; // 0–100 rounded
  band: "hot" | "fair" | "wait";
  factors: { range: number; trend: number; streak: number; volatility: number };
}

const RANGE_DAYS = 90;
const TREND_DAYS = 30;
const MIN_POINTS = 3;
const MIN_SPAN_DAYS = 14;
const HOT_CUTOFF = 75;
const FAIR_CUTOFF = 40;

interface Point {
  t: number;
  v: number;
}

function mergedPoints(listings: DistributorListing[], currency: string): Point[] {
  // Reuse pattern from computeProductInsights (lib/product-insights.ts:48-60):
  // group converted finite values by timestamp, average duplicates.
  // Read that file first and mirror the conversion import (convert from lib/currency? check what product-insights imports — mirror it).
  ...
}

function dropStreak(values: number[]): number {
  // Count trailing consecutive declines (each < previous). Read how product-insights computes dropStreak and mirror exactly (import it if exported and pure — check; else duplicate the 5 lines with a comment).
  ...
}

export function computeDealScore(listings: DistributorListing[], currency: string): DealScore | null {
  const points = mergedPoints(listings, currency);
  if (points.length < MIN_POINTS) return null;
  const spanDays = (points[points.length - 1].t - points[0].t) / 86400000;
  if (spanDays < MIN_SPAN_DAYS) return null;
  const window = points.filter((p) => p.t >= points[points.length - 1].t - RANGE_DAYS * 86400000);
  const values = window.map((p) => p.v);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const current = values[values.length - 1];
  const range = hi > lo ? ((hi - current) / (hi - lo)) * 50 : 25;
  const cutoff = points[points.length - 1].t - TREND_DAYS * 86400000;
  const recent = points.filter((p) => p.t >= cutoff).map((p) => p.v);
  const first = recent[0] ?? current;
  const move = first > 0 ? ((current - first) / first) * 100 : 0;
  const trend = move <= -5 ? 30 : move >= 5 ? 0 : 30 * (1 - (move + 5) / 10);
  const streak = dropStreak(values);
  const streakScore = Math.min(streak, 3) / 3;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
  const volatility = Math.min(cv / 0.3, 1) * 10;
  const score = Math.round(Math.max(0, Math.min(100, range + trend + streakScore * 10 - volatility)));
  return {
    score,
    band: score >= HOT_CUTOFF ? "hot" : score >= FAIR_CUTOFF ? "fair" : "wait",
    factors: {
      range: Math.round(range),
      trend: Math.round(trend),
      streak: Math.round(streakScore * 10),
      volatility: Math.round(volatility),
    },
  };
}
```
Fill `mergedPoints`/`dropStreak` by reading `lib/product-insights.ts:44-90` first (mirror conversion + streak logic; import shared pieces if exported). If product-insights exports a reusable streak helper, use it instead of duplicating (check first).

- [ ] **Step 2: Write unit tests**

`tests/deal-score.test.ts`: falling-to-low history → hot (≥75); rising-to-high → wait/low; flat mid-range → fair band; <3 points → null; <14-day span → null; single currency conversion (multi-currency fixture converts); unconvertible-only → null; volatility penalty (spiky vs smooth same endpoints — spiky scores lower); streak contribution (fresh drop scores higher than stale same-level). Each test constructs `DistributorListing[]` fixtures with explicit dates/prices (no mocks, no timers).

- [ ] **Step 3: Run tests**

Run: `pnpm vitest run tests/deal-score.test.ts 2>&1 | tail -3`
Expected: all pass. (`tsc` clean too — run `pnpm check`.)

- [ ] **Step 4: Commit**

```bash
git add lib/deal-score.ts tests/deal-score.test.ts
git commit -m "Feat: deterministic deal score engine with unit tests. TypeScript: 0 errors."
```

---

### Task 2: Mobile surfaces

**Files:**
- Modify: `lib/types.ts`, `lib/watchlist-org.ts`, `app/(tabs)/watchlist.tsx`, `components/watchlist/product-card.tsx`, `app/product/[id].tsx`
- Test: `tests/desktop-product-intel.test.ts` — NO, mobile guard: extend existing? Create `tests/deal-score-mobile.test.ts`? Source guards: assert sort option + card + badge strings.

Guard file: create `tests/deal-score-surfaces.test.ts`:
```ts
// mobile watchlist sort option + detail card + badge; desktop sortKey + card + badge
```
(write exact assertions in-task: `sortWatchlist` handles "deal"; `app/(tabs)/watchlist.tsx` contains deal option label; `app/product/[id].tsx` contains "Deal Score"; product-card contains "Hot deal"; desktop Watchlist contains `"deal"` sortKey + "Hot deal"; desktop ProductDetail contains "Deal Score". Verify each string absent first — split into per-surface `it` blocks so failures pinpoint.)

- [ ] **Step 1: Shared sort**

`lib/types.ts`: add `"deal"` to `WatchlistSort`. `lib/watchlist-org.ts` `sortWatchlist`: add case (needs scores — compute per product inside the comparator? Expensive but correct; better: precompute Map once before sort):
```tsx
    case "deal": {
      const scores = new Map(list.map((p) => [p.id, computeDealScore(p.listings ?? [], displayCurrency)?.score ?? null]));
      return copy.sort((a, b) => {
        const sa = scores.get(a.id);
        const sb = scores.get(b.id);
        if (sa === null && sb === null) return 0;
        if (sa === null) return 1;
        if (sb === null) return -1;
        return sb - sa;
      });
    }
```
Check existing `sortWatchlist` default case (unknown → return copy? read first; add deal explicitly).

- [ ] **Step 2: Mobile UI**

`app/(tabs)/watchlist.tsx`: add "deal" to the sort picker options (read picker markup first — labels like "Best deals"? use "Best deals"). Desktop NOT via this file.
`components/watchlist/product-card.tsx`: badge — read its insight chip block first (lines ~389-440); add `{dealScore != null && dealScore.band === "hot" && (<chip>🔥 Hot deal</chip>)}` matching chip classes. Wire `dealScore` prop from watchlist screen (compute per item? memo map like insightMap — read lines ~260 + 741 first; mirror the insightMap pattern with computeDealScore).
`app/product/[id].tsx`: detail card — read best-price block placement; render when `computeDealScore(...)` non-null: "Deal Score {score} — {Hot deal|Fair price|Wait for a drop}" + factor lines (Range/Trend/Streak/Volatility with values).

- [ ] **Step 3: Verify**

Run guard file (mobile asserts pass; desktop asserts fail — Tasks 3-4) + `pnpm check` clean.

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts lib/watchlist-org.ts "app/(tabs)/watchlist.tsx" components/watchlist/product-card.tsx "app/product/[id].tsx" tests/deal-score-surfaces.test.ts
git commit -m "Feat: deal score on mobile (sort, card, badge). TypeScript: 0 errors."
```

---

### Task 3: Desktop surfaces

**Files:**
- Modify: `desktop/src/pages/Watchlist.tsx`, `desktop/src/pages/ProductDetail.tsx`

- [ ] **Step 1: Sort + badge**

Watchlist.tsx: `SortKey` union + `"deal"` (read line 45 first); `sorted` switch — add case (score desc, nulls last regardless of sortAsc — read the null-handling pattern in the price case first and mirror):
```tsx
        case "deal": {
          const aScore = dealScores.get(a.id) ?? null;
          const bScore = dealScores.get(b.id) ?? null;
          if (aScore === null && bScore === null) cmp = 0;
          else if (aScore === null) return 1;
          else if (bScore === null) return -1;
          else cmp = bScore - aScore;
          break;
        }
```
with `const dealScores = useMemo(() => new Map(filtered.map((p) => [p.id, computeDealScore(p.listings ?? [], displayCurrency)?.score ?? null])), [filtered, displayCurrency]);` placed before `sorted` (check memo order/deps). Sort UI: add "Deal" option to the sort control (read markup — buttons or select; keep default unchanged). Name-cell chip (extract once per row to satisfy narrowing): `{(() => { const s = dealScores.get(product.id); return s != null && s >= 80 ? (<span className="...insight-chip classes...">🔥 Hot deal</span>) : null; })()}` matching insight-chip classes (no new column — colSpan intact).
Import computeDealScore from "../../../lib/deal-score" (mirror existing lib import specifiers in the file).

- [ ] **Step 2: Detail card**

ProductDetail.tsx: memo + card mirroring mobile strings (same "Deal Score {score} — {band copy}" + factor lines), placed after best-price block. Same strings as mobile (copy once — read mobile card from Task 2's implementation? Mobile card is inline in product/[id].tsx — instruct: use IDENTICAL strings on both).

- [ ] **Step 3: Verify**

Run: full surfaces guard file (all pass) + `pnpm check` (clean) + workdir `desktop/` `pnpm build` (exit 0).

- [ ] **Step 4: Commit**

```bash
git add desktop/src/pages/Watchlist.tsx desktop/src/pages/ProductDetail.tsx
git commit -m "Feat: deal score on desktop (sort, card, badge). TypeScript: 0 errors."
```

---

### Task 4: Full verification + push

**Files:** none (verification only)

- [ ] **Step 1: Lint + full suite**

`pnpm lint` (0 errors, no new warnings in touched files), `pnpm test` (all pass, 0 failures).

- [ ] **Step 2: Desktop build**

Workdir `desktop/`: `pnpm build` (exit 0).

- [ ] **Step 3: Push**

`git push origin main` (`main -> main`), `git status --short` empty.
