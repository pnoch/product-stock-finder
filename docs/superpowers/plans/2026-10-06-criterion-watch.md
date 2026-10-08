# Criterion Watch (Saved Search) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user watch a filtered search ("any Networking Switch under $300 in stock") and get notified when a new matching product appears.

**Architecture:** A device-local `CriterionWatch` model; a pure `evaluateCriterionWatches` diffing the in-stock set against `seenProductIds`; client evaluation in the price-check; a "Watch this search" button on the board; a Reminders-list entry.

**Tech Stack:** TypeScript, React Native / Expo, vitest.

**Spec:** `docs/superpowers/specs/2026-10-06-criterion-watch-design.md`

---

## File Structure

- Modify `lib/types.ts` — `CriterionWatch`; `criterion_match` history type.
- Modify `lib/storage/context.ts` — `CRITERION_WATCHES` key.
- Create `lib/storage/criterion-watches.ts` — the storage factory.
- Modify `lib/storage/index.ts` — wire the factory + wipe the key.
- Create `lib/criterion-watch.ts` — `matchesCriterion`, `evaluateCriterionWatches`.
- Modify `lib/background-tasks/price-check.ts` — evaluate + notify.
- Modify `components/notification-center.tsx`, `desktop/src/pages/Alerts.tsx` — icon maps.
- Modify `app/available.tsx` — "Watch this search" button.
- Modify `app/(tabs)/alerts.tsx` — Reminders-list entry.
- Tests: `tests/criterion-watch.test.ts`, `tests/criterion-watches-storage.test.ts`, `tests/criterion-watch-notify.test.ts`.

---

### Task 1: Model + storage

**Files:** Modify `lib/types.ts`, `lib/storage/context.ts`, `lib/storage/index.ts`; Create `lib/storage/criterion-watches.ts`; Test `tests/criterion-watches-storage.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/criterion-watches-storage.test.ts` (copy the AsyncStorage mock from `tests/last-seen-storage.test.ts`):

```ts
import { describe, expect, it, beforeEach, vi } from "vitest";

const store = new Map<string, string>();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (k: string) => store.get(k) ?? null,
    setItem: async (k: string, v: string) => { store.set(k, v); },
    removeItem: async (k: string) => { store.delete(k); },
    multiRemove: async (ks: string[]) => { ks.forEach((k) => store.delete(k)); },
  },
}));

import {
  getCriterionWatches,
  addCriterionWatch,
  removeCriterionWatch,
  updateCriterionWatches,
  clearAllData,
} from "../lib/storage";

beforeEach(() => store.clear());

describe("criterion watch storage", () => {
  it("round-trips add/get/remove", async () => {
    await addCriterionWatch({
      id: "w1", category: "Networking Switch", maxPrice: 300, currency: "USD",
      seenProductIds: [], createdAt: "2026-01-01T00:00:00.000Z", isActive: true,
    });
    expect((await getCriterionWatches()).map((w) => w.id)).toEqual(["w1"]);
    await removeCriterionWatch("w1");
    expect(await getCriterionWatches()).toEqual([]);
  });

  it("updateCriterionWatches applies a read-modify-write", async () => {
    await addCriterionWatch({
      id: "w1", category: "Storage", currency: "USD",
      seenProductIds: [], createdAt: "2026-01-01T00:00:00.000Z", isActive: true,
    });
    await updateCriterionWatches((ws) =>
      ws.map((w) => ({ ...w, seenProductIds: ["p1"] })),
    );
    expect((await getCriterionWatches())[0]!.seenProductIds).toEqual(["p1"]);
  });

  it("is wiped by clearAllData", async () => {
    await addCriterionWatch({
      id: "w1", currency: "USD", seenProductIds: [],
      createdAt: "2026-01-01T00:00:00.000Z", isActive: true,
    });
    await clearAllData();
    expect(await getCriterionWatches()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/criterion-watches-storage.test.ts`
Expected: FAIL — not exported.

- [ ] **Step 3: Implement**

In `lib/types.ts`, add:

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

and add `"criterion_match"` to `NotificationHistoryEntry.type`.

In `lib/storage/context.ts`, add to `STORAGE_KEYS`: `CRITERION_WATCHES: "criterion_watches",`

Create `lib/storage/criterion-watches.ts` (mirroring `createRemindersStorage`):

```ts
import type { CriterionWatch } from "../types";
import type { StorageContext } from "./context";

export function createCriterionWatchesStorage(ctx: StorageContext) {
  const { adapter, KEYS, enqueue, readList } = ctx;

  async function getCriterionWatches(): Promise<CriterionWatch[]> {
    return readList<CriterionWatch>(KEYS.CRITERION_WATCHES);
  }

  async function persistCriterionWatches(watches: CriterionWatch[]): Promise<void> {
    await adapter.setItem(KEYS.CRITERION_WATCHES, JSON.stringify(watches));
  }

  // Deliberately no notify(): criterion watches are device-local, not a synced
  // collection (like the per-distributor status map). `notify` takes a synced
  // `Collection` and would push them into sync.
  async function addCriterionWatch(watch: CriterionWatch): Promise<void> {
    await enqueue(KEYS.CRITERION_WATCHES, async () => {
      const watches = await getCriterionWatches();
      if (watches.some((w) => w.id === watch.id)) return;
      await persistCriterionWatches([...watches, watch]);
    });
  }

  async function removeCriterionWatch(id: string): Promise<void> {
    await enqueue(KEYS.CRITERION_WATCHES, async () => {
      const watches = await getCriterionWatches();
      await persistCriterionWatches(watches.filter((w) => w.id !== id));
    });
  }

  async function updateCriterionWatches(
    fn: (watches: CriterionWatch[]) => Promise<CriterionWatch[]> | CriterionWatch[],
  ): Promise<void> {
    await enqueue(KEYS.CRITERION_WATCHES, async () => {
      const watches = await getCriterionWatches();
      await persistCriterionWatches(await fn(watches));
    });
  }

  return {
    getCriterionWatches,
    addCriterionWatch,
    removeCriterionWatch,
    updateCriterionWatches,
  };
}
```

In `lib/storage/index.ts`: instantiate `const criterionWatchesStorage = createCriterionWatchesStorage(ctx);`, spread its methods into the returned object (beside `getStockWatches` etc.), and add `STORAGE_KEYS.CRITERION_WATCHES,` to `clearAllData`'s removal list.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/criterion-watches-storage.test.ts && pnpm check`
Expected: PASS (3 tests); 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts lib/storage/context.ts lib/storage/criterion-watches.ts lib/storage/index.ts tests/criterion-watches-storage.test.ts
git commit -m "feat(criterion): CriterionWatch model + device-local storage"
```

---

### Task 2: Pure evaluation

**Files:** Create `lib/criterion-watch.ts`; Test `tests/criterion-watch.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/criterion-watch.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { matchesCriterion, evaluateCriterionWatches } from "../lib/criterion-watch";
import type { AvailableProduct, CriterionWatch } from "../lib/types";

function avail(id: string, category: string, brand: string, price: number): AvailableProduct {
  return {
    id, name: id, brand, category, modelNumber: id,
    bestPrice: price, bestCurrency: "USD", bestDistributorId: "d1",
    storeCount: 2, fetchedAt: 1000,
  };
}

function watch(over: Partial<CriterionWatch> = {}): CriterionWatch {
  return {
    id: "w1", category: "Switch", maxPrice: 300, currency: "USD",
    seenProductIds: [], createdAt: "2026-01-01T00:00:00.000Z", isActive: true, ...over,
  };
}

describe("matchesCriterion", () => {
  it("matches on each optional field", () => {
    expect(matchesCriterion(avail("a", "Switch", "X", 100), watch())).toBe(true);
    expect(matchesCriterion(avail("a", "Router", "X", 100), watch())).toBe(false);
    expect(matchesCriterion(avail("a", "Switch", "X", 400), watch())).toBe(false);
    expect(matchesCriterion(avail("a", "Switch", "Y", 100), watch({ brand: "X" }))).toBe(false);
  });
});

describe("evaluateCriterionWatches", () => {
  it("fires only for newly-appearing products and advances seenProductIds", () => {
    const { matches, updated } = evaluateCriterionWatches({
      watches: [watch({ seenProductIds: ["a"] })],
      available: [avail("a", "Switch", "X", 100), avail("b", "Switch", "X", 200)],
    });
    expect(matches.map((m) => m.productId)).toEqual(["b"]);
    expect(updated[0]!.seenProductIds.sort()).toEqual(["a", "b"]);
  });

  it("does not re-fire for an already-seen product", () => {
    const { matches } = evaluateCriterionWatches({
      watches: [watch({ seenProductIds: ["a", "b"] })],
      available: [avail("a", "Switch", "X", 100), avail("b", "Switch", "X", 200)],
    });
    expect(matches).toEqual([]);
  });

  it("skips inactive watches", () => {
    const { matches } = evaluateCriterionWatches({
      watches: [watch({ isActive: false })],
      available: [avail("a", "Switch", "X", 100)],
    });
    expect(matches).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/criterion-watch.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `lib/criterion-watch.ts`:

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
): boolean {
  if (watch.category && product.category !== watch.category) return false;
  if (watch.brand && product.brand !== watch.brand) return false;
  if (watch.maxPrice != null && product.bestPrice > watch.maxPrice) return false;
  return true;
}

/**
 * Diff the current in-stock set against each watch's `seenProductIds`: a match is
 * a matching product not seen before. Returns the matches plus the watches with
 * `seenProductIds` advanced to the current matching set (so each product fires
 * once). The caller persists `updated` only after a successful notification.
 */
export function evaluateCriterionWatches(input: {
  watches: CriterionWatch[];
  available: AvailableProduct[];
}): { matches: CriterionMatch[]; updated: CriterionWatch[] } {
  const matches: CriterionMatch[] = [];
  const updated = input.watches.map((watch) => {
    if (!watch.isActive) return watch;
    const matching = input.available.filter((p) => matchesCriterion(p, watch));
    const seen = new Set(watch.seenProductIds);
    for (const p of matching) {
      if (seen.has(p.id)) continue;
      matches.push({
        watchId: watch.id,
        productId: p.id,
        name: p.name,
        bestPrice: p.bestPrice,
        bestCurrency: p.bestCurrency,
        storeCount: p.storeCount,
      });
    }
    return { ...watch, seenProductIds: matching.map((p) => p.id) };
  });
  return { matches, updated };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/criterion-watch.test.ts && pnpm check`
Expected: PASS (4 tests); 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add lib/criterion-watch.ts tests/criterion-watch.test.ts
git commit -m "feat(criterion): evaluateCriterionWatches"
```

---

### Task 3: Client evaluation + notification

**Files:** Modify `lib/background-tasks/price-check.ts`, `components/notification-center.tsx`, `desktop/src/pages/Alerts.tsx`; Test `tests/criterion-watch-notify.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/criterion-watch-notify.test.ts` (mirror the harness in `tests/price-check.test.ts`; mock `../lib/storage` to expose `getCriterionWatches`/`updateCriterionWatches`, `../lib/server-catalog` `fetchAvailable`, `../lib/notifications` `scheduleStockAlert`/`ensureNotificationPermission`, and `../lib/restock` `checkRestocks`):

```ts
import { describe, expect, it, vi } from "vitest";
// …reuse price-check.test.ts's mocks; add:
//   getCriterionWatches: async () => [ { id:"w1", category:"Switch", maxPrice:300, currency:"USD", seenProductIds:[], createdAt:"", isActive:true } ]
//   updateCriterionWatches: vi.fn(async (fn) => { state.updated = await fn(state.criterionWatches); })
//   fetchAvailable: async () => [ { id:"b", name:"Switch B", brand:"X", category:"Switch", modelNumber:"B", bestPrice:200, bestCurrency:"USD", bestDistributorId:"d1", storeCount:2, fetchedAt:1 } ]

import { checkPriceDropsNow } from "../lib/background-tasks/price-check";

describe("criterion watch notification", () => {
  it("fires a notification for a new match and advances seenProductIds", async () => {
    await checkPriceDropsNow();
    // assert a notification was scheduled mentioning "Switch B"
    // assert updateCriterionWatches persisted seenProductIds ["b"]
  });
});
```

Fill in the assertions against the harness's recorded notifications + the `updateCriterionWatches` spy.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/criterion-watch-notify.test.ts`
Expected: FAIL — no criterion evaluation.

- [ ] **Step 3: Implement**

In `lib/background-tasks/price-check.ts`, import `getCriterionWatches`, `updateCriterionWatches` from `../storage`, `evaluateCriterionWatches` from `../criterion-watch`, `fetchAvailable` from `../server-catalog`, `isServerConfigured` from `../../constants/oauth`, and `getWatchlist` from `../storage`. After `await checkRestocks();` (line ~119), insert:

```ts
  // Criterion watches: notify when a new matching product appears in stock.
  try {
    const watches = await getCriterionWatches();
    if (watches.some((w) => w.isActive)) {
      let available: AvailableProduct[] = [];
      if (isServerConfigured()) {
        available = await fetchAvailable({ currency: watches[0]!.currency });
      } else {
        const watchlist = await getWatchlist();
        available = watchlist.flatMap((p) =>
          (p.listings ?? [])
            .filter((l) => l.stockStatus === "in_stock")
            .map((l) => ({
              id: p.id, name: p.name, brand: p.brand, category: p.category,
              modelNumber: p.modelNumber, bestPrice: l.price, bestCurrency: l.currency,
              bestDistributorId: l.distributorId, storeCount: 1, fetchedAt: Date.now(),
            })),
        );
      }
      const { matches, updated } = evaluateCriterionWatches({ watches, available });
      if (matches.length > 0) {
        const settings = await getSettings();
        const enabled =
          settings.notificationsEnabled !== false && settings.stockAlerts !== false;
        let notified = false;
        if (enabled) {
          for (const m of matches) {
            try {
              const id = await scheduleStockAlert(
                m.name, `${m.storeCount} store${m.storeCount === 1 ? "" : "s"}`,
                m.bestPrice, m.bestCurrency, m.productId,
              );
              notified = notified || id !== null;
            } catch {
              // best effort
            }
          }
        } else {
          notified = true;
        }
        if (notified) {
          await updateCriterionWatches(() => updated);
        }
      } else {
        await updateCriterionWatches(() => updated);
      }
    }
  } catch {
    // criterion evaluation is best-effort; never break the price check
  }
```

(Import `AvailableProduct` type from `../types`.)

Add `criterion_match: "bookmark.fill"` to the icon map in `components/notification-center.tsx` and `criterion_match: Bookmark` in `desktop/src/pages/Alerts.tsx` (add `Bookmark` to the lucide-react import; `bookmark.fill` is already mapped in `components/ui/icon-symbol.tsx`).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/criterion-watch-notify.test.ts tests/price-check.test.ts && pnpm check`
Expected: PASS; 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add lib/background-tasks/price-check.ts components/notification-center.tsx desktop/src/pages/Alerts.tsx tests/criterion-watch-notify.test.ts
git commit -m "feat(criterion): evaluate + notify in the price check"
```

---

### Task 4: Creation UI + Reminders entry + full verification + docs

**Files:** Modify `app/available.tsx`, `app/(tabs)/alerts.tsx`; `todo.md`

- [ ] **Step 1: Board "Watch this search" button**

In `app/available.tsx`, add a button (near the filter chips) that, when at least one of `category`/`brand`/`maxPrice` is set, creates a criterion watch:
```ts
  const handleWatchSearch = useCallback(async () => {
    if (!category && !brand && maxPrice == null) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await addCriterionWatch({
      id: `cw-${Date.now()}`,
      category, brand, maxPrice, currency,
      seenProductIds: [],
      createdAt: new Date().toISOString(),
      isActive: true,
    });
    showToast("Watching this search — you'll be notified of new matches", "success");
  }, [category, brand, maxPrice, currency, showToast]);
```
Render the button disabled when no filter is set. Import `addCriterionWatch` from `@/lib/storage`.

- [ ] **Step 2: Reminders-list entry**

In `app/(tabs)/alerts.tsx`, in the Reminders tab, load `getCriterionWatches()` and render each as a row: `Any {category ?? brand ?? "product"}{maxPrice != null ? ` under ${formatPrice(maxPrice, currency)}` : ""}` with a remove action calling `removeCriterionWatch(id)`. Import `getCriterionWatches`, `removeCriterionWatch` from `@/lib/storage` and `formatPrice` from `@shared/currency`.

- [ ] **Step 3: Verify it compiles**

Run: `pnpm check`
Expected: 0 type errors.

- [ ] **Step 4: Run the full gate**

Run: `pnpm verify`
Expected: exit 0.

- [ ] **Step 5: Document**

Add a `todo.md` phase entry (next number 1134): the criterion-watch model, `evaluateCriterionWatches`, the client evaluation + notification, the board button, the Reminders entry, and the note that server-side evaluation + cross-device sync are deferred.

- [ ] **Step 6: Commit**

```bash
git add app/available.tsx app/\(tabs\)/alerts.tsx todo.md
git commit -m "feat(criterion): Watch this search + Reminders entry (Phase 1134)"
```

---

## Self-Review

- **Spec coverage:** model + storage (Task 1), evaluation (Task 2), client notify (Task 3), creation UI + Reminders + verify + docs (Task 4). Server evaluation, sync, and desktop parity are out of scope per the spec.
- **Placeholders:** none — the model, storage, evaluation, and notify wiring are given verbatim; Task 4 names the exact files, states, and strings.
- **Type consistency:** `CriterionWatch`; `matchesCriterion(product, watch)`; `evaluateCriterionWatches({watches, available}) → {matches, updated}`; `getCriterionWatches`/`addCriterionWatch`/`removeCriterionWatch`/`updateCriterionWatches`; `criterion_match` — used consistently.
- **Dedup:** `seenProductIds` advances only after a successful notify; a failed send re-detects next cycle.
