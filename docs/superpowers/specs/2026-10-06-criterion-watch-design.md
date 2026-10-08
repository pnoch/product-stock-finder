# Criterion Watch (Saved Search) — Design Spec

**Date:** 2026-10-06
**Status:** Draft for review

## Goal

Let a user watch a **need** — "any Networking Switch under $300 in stock" — not
just a specific product, so the app can surface a part they didn't know to search
for.

## Problem

Every watch is bound to a **specific product id**. But the CRS804 story started
with a *need* ("a 24-port MikroTik switch with SFP+, under $300, in stock"), not a
model number. The Available Now board already computes exactly that set, but there
is **no way to watch it** — it is a snapshot, not a standing query.

## Scope

**In scope:** a `CriterionWatch` model (device-local), a pure
`evaluateCriterionWatches`, client evaluation + notification, a "Watch this search"
button on the board, a Reminders-list entry, and tests.

**Out of scope:** server-side evaluation (a follow-up — the client path covers the
app-open case); a full query builder; desktop parity; cross-device sync.

## Architecture

### 1. Data model — `lib/types.ts` + `lib/storage/criterion-watches.ts` (new)

```ts
export interface CriterionWatch {
  id: string;
  category?: string;
  brand?: string;
  maxPrice?: number;
  currency: string;
  /** Product ids seen in stock at the last evaluation (dedup). */
  seenProductIds: string[];
  createdAt: string;
  isActive: boolean;
}
```

Stored **device-local** under a new key `CRITERION_WATCHES`, in a
`createCriterionWatchesStorage(ctx)` factory mirroring `createRemindersStorage`
(`getCriterionWatches`, `addCriterionWatch`, `removeCriterionWatch`,
`updateCriterionWatches`), serialized via `enqueue`, wiped by `clearAllData`.

### 2. Pure evaluation — `lib/criterion-watch.ts` (new)

```ts
import type { AvailableProduct, CriterionWatch } from "./types";

export interface CriterionMatch {
  watchId: string;
  productId: string;
  name: string;
  bestPrice: number;
  bestCurrency: string;
  storeCount: number;
}

export function matchesCriterion(
  product: AvailableProduct,
  watch: CriterionWatch,
): boolean;

export function evaluateCriterionWatches(input: {
  watches: CriterionWatch[];
  available: AvailableProduct[];
}): { matches: CriterionMatch[]; updated: CriterionWatch[] };
```

- `matchesCriterion`: `category` (if set) must equal; `brand` (if set) must equal;
  `maxPrice` (if set) must be `>= bestPrice`.
- `evaluateCriterionWatches`: for each **active** watch, filter `available` by
  `matchesCriterion`; a match is a product whose id is **not** in
  `seenProductIds` (newly appeared). Return the matches, and the watches with
  `seenProductIds` set to the current matching ids (so each product fires once).

### 3. Client evaluation — `lib/background-tasks/price-check.ts`

In `runPriceCheckCoreInner`, after `checkRestocks()`, evaluate criterion watches:

- Read `getCriterionWatches()`; skip when none.
- Build `available` from `fetchAvailable()` (server) or the watchlist fallback
  (standalone, reusing `localAlternatives`-style in-stock extraction).
- `evaluateCriterionWatches({ watches, available })`.
- For each match, fire a notification ("New match: {name} — {price} at {n}
  stores"), guarded by the same `notificationsEnabled`/permission checks as
  restock, and record a `criterion_match` history entry.
- Persist the `updated` watches (advancing `seenProductIds`) **only after** the
  notification attempt, so a failed send re-detects next cycle (mirroring the
  restock semantics).

### 4. Notification type — `lib/types.ts`

Add `"criterion_match"` to `NotificationHistoryEntry.type`; map its icon on mobile
+ desktop (the exhaustive maps).

### 5. Creation UI

- **Board** (`app/available.tsx`): a **"Watch this search"** button that creates a
  `CriterionWatch` from the current `category`/`brand`/`maxPrice`/`currency` and
  shows a toast. Disabled when no filter is set (an unfiltered watch would match
  everything).
- **Reminders list** (`app/(tabs)/alerts.tsx`): render criterion watches as rows
  ("Any {category}{ under $max}") with a remove action.

## Data Flow

1. The user filters the board and taps "Watch this search".
2. A `CriterionWatch` is stored (device-local).
3. On each price check, `evaluateCriterionWatches` diffs the current in-stock set
   against `seenProductIds`; new matches notify and advance the set.

## Error Handling

- No watches → skip (no query).
- `fetchAvailable` throws → skip this cycle (leave `seenProductIds` unchanged).
- Notification failure → do not advance `seenProductIds` (re-detect next cycle).
- An unfiltered watch (no category/brand/maxPrice) is rejected at creation.

## Testing

- `tests/criterion-watch.test.ts` — `matchesCriterion` (category/brand/maxPrice,
  each optional); `evaluateCriterionWatches` fires only for newly-appearing
  products; advances `seenProductIds`; a product already seen does not re-fire;
  inactive watches are skipped.
- `tests/criterion-watches-storage.test.ts` — CRUD round-trip; wiped by
  `clearAllData`.
- `tests/criterion-watch-notify.test.ts` — the price-check fires a notification
  per new match and records a `criterion_match` entry; a failed notify leaves
  `seenProductIds` unchanged.
- Existing tests stay green.

## Success Criteria

- A user can watch a filtered search; when a new matching product is in stock, they
  get one notification naming it.
- A product already matched does not re-notify.
- `pnpm verify` stays green.

## Risks

- **Notification noise** → dedup by `seenProductIds`; one notification per new
  product; the watch is user-created and removable.
- **Client-only coverage** → fires on app open / background task; server parity is
  a deferred follow-up (same as restock before its parity).
- **Over-broad match** → an unfiltered watch is rejected at creation.
