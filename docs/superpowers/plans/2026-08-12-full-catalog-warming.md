# Full-Catalog Warming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Warm the server's price cache and history for the entire product catalog — every `(distributor, model)` pair — via a continuous least-recently-fetched rotation, so `prices.get` returns fresh snapshots for any catalog product without waiting for an on-demand scrape.

**Architecture:** A new `server/catalog-warmer.ts` provides pure helpers (`buildCatalogPairs`, `pickPairsToWarm`). `server/prices.ts` adds a `warmCatalogRotation(count)` that builds the pair list, reads a fetched-at map from the cache, picks the `count` least-recently-fetched pairs, and warms each via the existing `refreshSingleFlight`. The warmer `setInterval` tick calls it after the near-expiry pass. `server/price-cache.ts` gains `getAllFetchedAt()` to feed the fetched-at map.

**Tech Stack:** Express + tRPC v11 + Drizzle (MySQL) + superjson; vitest.

---

## File Structure

| File                           | Responsibility                                                            |
| ------------------------------ | ------------------------------------------------------------------------- |
| `server/price-cache.ts`        | Add `getAllFetchedAt()` (DB + memory fallback)                            |
| `server/catalog-warmer.ts`     | Pure helpers: `buildCatalogPairs`, `pickPairsToWarm`                      |
| `server/prices.ts`             | Add `warmCatalogRotation`, `CATALOG_WARM_PER_TICK`, wire into warmer tick |
| `tests/price-cache.test.ts`    | Add `getAllFetchedAt` tests                                               |
| `tests/catalog-warmer.test.ts` | `buildCatalogPairs` + `pickPairsToWarm` tests                             |
| `tests/prices.test.ts`         | Add `warmCatalogRotation` tests                                           |

---

### Task 1: `getAllFetchedAt()` in `server/price-cache.ts`

**Files:**

- Modify: `server/price-cache.ts`
- Test: `tests/price-cache.test.ts`

- [ ] **Step 1: Add the failing tests to `tests/price-cache.test.ts`**

The current file is at `/home/pnoch/Development/product-stock-finder/tests/price-cache.test.ts` (60 lines). Read it first. It imports `getCachedPrice, setCachedPrice, listNearExpiry, clearPriceCacheForTests` from `../server/price-cache`. Add `getAllFetchedAt` to that import:

```ts
import {
  getCachedPrice,
  setCachedPrice,
  listNearExpiry,
  getAllFetchedAt,
  clearPriceCacheForTests,
} from "../server/price-cache";
```

Add a new `describe` block at the end of the file (after the existing `describe("price cache (memory backend)", ...)` block):

```ts
describe("getAllFetchedAt", () => {
  beforeEach(() => clearPriceCacheForTests());

  it("returns an empty array when nothing is cached", async () => {
    expect(await getAllFetchedAt()).toEqual([]);
  });

  it("returns all cached entries with their fetchedAt", async () => {
    await setCachedPrice(
      "server2u-my",
      "CRS804",
      snapshot({ price: 1, fetchedAt: 1000 }),
    );
    await setCachedPrice(
      "linitx-uk",
      "CRS804",
      snapshot({ price: 2, fetchedAt: 2000 }),
    );
    await setCachedPrice(
      "server2u-my",
      "CRS326",
      snapshot({ price: 3, fetchedAt: 3000 }),
    );
    const entries = await getAllFetchedAt();
    expect(entries).toHaveLength(3);
    expect(entries).toContainEqual({
      distributorId: "server2u-my",
      modelNumber: "CRS804",
      fetchedAt: 1000,
    });
    expect(entries).toContainEqual({
      distributorId: "linitx-uk",
      modelNumber: "CRS804",
      fetchedAt: 2000,
    });
    expect(entries).toContainEqual({
      distributorId: "server2u-my",
      modelNumber: "CRS326",
      fetchedAt: 3000,
    });
  });
});
```

Note: the `snapshot()` helper already exists in this file (returns a `PriceSnapshot` with `price`, `currency`, `stockStatus`, `url`, `fetchedAt` defaults).

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run tests/price-cache.test.ts`
Expected: FAIL with "getAllFetchedAt is not a function" (not yet exported).

- [ ] **Step 3: Add `getAllFetchedAt` to `server/price-cache.ts`**

Add after `listNearExpiry` (after line 91):

```ts
export async function getAllFetchedAt(): Promise<
  Array<{ distributorId: string; modelNumber: string; fetchedAt: number }>
> {
  const db = await getDb();
  if (!db) {
    const entries: Array<{
      distributorId: string;
      modelNumber: string;
      fetchedAt: number;
    }> = [];
    for (const [key, snap] of memoryCache) {
      const [distributorId, modelNumber] = key.split(":");
      entries.push({ distributorId, modelNumber, fetchedAt: snap.fetchedAt });
    }
    return entries;
  }
  const rows = await db
    .select({
      distributorId: priceCache.distributorId,
      modelNumber: priceCache.modelNumber,
      fetchedAt: priceCache.fetchedAt,
    })
    .from(priceCache);
  return rows;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/price-cache.test.ts`
Expected: PASS (7 tests — 5 existing + 2 new).

- [ ] **Step 5: Verify types**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/price-cache.ts tests/price-cache.test.ts
git commit -m "feat(server): add getAllFetchedAt to price cache"
```

---

### Task 2: Pure helpers — `server/catalog-warmer.ts`

**Files:**

- Create: `server/catalog-warmer.ts`
- Test: `tests/catalog-warmer.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/catalog-warmer.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../lib/scrapers/registry", () => ({
  getParserByDistributorId: vi.fn(),
}));

import { getParserByDistributorId } from "../lib/scrapers/registry";
import { buildCatalogPairs, pickPairsToWarm } from "../server/catalog-warmer";

const mockedGetParser = vi.mocked(getParserByDistributorId);

describe("buildCatalogPairs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetParser.mockReturnValue({
      id: "server2u-my",
      baseUrl: "https://server2u.com",
      buildSearchUrl: (model: string) => `https://server2u.com/shop?q=${model}`,
      parsePrice: () => null,
      rateLimitMs: 0,
    });
  });

  it("returns the full cross product of catalog models and distributors", () => {
    const pairs = buildCatalogPairs();
    expect(pairs.length).toBeGreaterThan(0);
    expect(pairs).toContainEqual({
      distributorId: "server2u-my",
      modelNumber: "CRS804-4DDQ-hRM",
    });
  });

  it("excludes distributors with no parser", () => {
    mockedGetParser.mockReturnValue(undefined);
    const pairs = buildCatalogPairs();
    expect(pairs).toHaveLength(0);
  });
});

describe("pickPairsToWarm", () => {
  const pairs = [
    { distributorId: "a", modelNumber: "m1" },
    { distributorId: "a", modelNumber: "m2" },
    { distributorId: "b", modelNumber: "m1" },
    { distributorId: "c", modelNumber: "m1" },
  ];

  it("picks never-fetched pairs first", () => {
    const fetchedAt = new Map<string, number>([
      ["a:m1", 1000],
      ["b:m1", 2000],
    ]);
    const picked = pickPairsToWarm(pairs, fetchedAt, 2);
    expect(picked).toHaveLength(2);
    expect(picked[0]).toEqual({ distributorId: "a", modelNumber: "m2" });
    expect(picked[1]).toEqual({ distributorId: "c", modelNumber: "m1" });
  });

  it("picks the oldest fetchedAt when all pairs have been fetched", () => {
    const fetchedAt = new Map<string, number>([
      ["a:m1", 3000],
      ["a:m2", 1000],
      ["b:m1", 2000],
      ["c:m1", 4000],
    ]);
    const picked = pickPairsToWarm(pairs, fetchedAt, 2);
    expect(picked).toEqual([
      { distributorId: "a", modelNumber: "m2" },
      { distributorId: "b", modelNumber: "m1" },
    ]);
  });

  it("respects the count limit", () => {
    const fetchedAt = new Map<string, number>();
    const picked = pickPairsToWarm(pairs, fetchedAt, 1);
    expect(picked).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run tests/catalog-warmer.test.ts`
Expected: FAIL with "Cannot find module '../server/catalog-warmer'".

- [ ] **Step 3: Write `server/catalog-warmer.ts`**

Create `server/catalog-warmer.ts`:

```ts
import { PRODUCT_CATALOG } from "../lib/catalog";
import { DISTRIBUTORS } from "../lib/distributors";
import { getParserByDistributorId } from "../lib/scrapers/registry";

export interface CatalogPair {
  distributorId: string;
  modelNumber: string;
}

export function buildCatalogPairs(): CatalogPair[] {
  const pairs: CatalogPair[] = [];
  for (const distributor of DISTRIBUTORS) {
    if (!getParserByDistributorId(distributor.id)) continue;
    for (const product of PRODUCT_CATALOG) {
      pairs.push({
        distributorId: distributor.id,
        modelNumber: product.modelNumber,
      });
    }
  }
  return pairs;
}

export function pickPairsToWarm(
  pairs: CatalogPair[],
  fetchedAtMap: Map<string, number>,
  count: number,
): CatalogPair[] {
  const key = (p: CatalogPair) => `${p.distributorId}:${p.modelNumber}`;
  return [...pairs]
    .sort((a, b) => {
      const aAt = fetchedAtMap.get(key(a)) ?? 0;
      const bAt = fetchedAtMap.get(key(b)) ?? 0;
      return aAt - bAt;
    })
    .slice(0, count);
}
```

> **Note:** `buildCatalogPairs` imports `PRODUCT_CATALOG` and `DISTRIBUTORS` from `lib/` (shared code, resolves fine in the server esbuild build — same as `lib/scrapers` imports). `pickPairsToWarm` sorts by `fetchedAt` ascending (missing = 0, so never-fetched sorts first) and is stable (Array.prototype.sort is stable in modern V8), giving deterministic tie-breaks.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/catalog-warmer.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Verify types**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/catalog-warmer.ts tests/catalog-warmer.test.ts
git commit -m "feat(server): add catalog pair builders and least-recently-fetched selection"
```

---

### Task 3: `warmCatalogRotation` + wire into the warmer tick

**Files:**

- Modify: `server/prices.ts`
- Test: `tests/prices.test.ts`

- [ ] **Step 1: Update the failing tests in `tests/prices.test.ts`**

The current file is at `/home/pnoch/Development/product-stock-finder/tests/prices.test.ts` (110 lines). Read it first. It mocks `../lib/scrapers/registry`, `../lib/scrapers/utils`, `../server/price-cache`, `../server/price-history`, and imports `getPrice, PRICE_TTL_MS` from `../server/prices`.

Add `getAllFetchedAt` to the `../server/price-cache` mock (the mock factory currently has `getCachedPrice, setCachedPrice, listNearExpiry, clearPriceCacheForTests`):

```ts
vi.mock("../server/price-cache", () => ({
  getCachedPrice: vi.fn(),
  setCachedPrice: vi.fn(),
  listNearExpiry: vi.fn(),
  getAllFetchedAt: vi.fn(),
  clearPriceCacheForTests: vi.fn(),
}));
```

Add `getAllFetchedAt` to the import and mocked variable. Current import (line 22):

```ts
import { getCachedPrice, setCachedPrice } from "../server/price-cache";
```

Change to:

```ts
import {
  getCachedPrice,
  setCachedPrice,
  getAllFetchedAt,
} from "../server/price-cache";
```

Add the mocked variable (after `const mockedSetCached`):

```ts
const mockedGetAllFetchedAt = vi.mocked(getAllFetchedAt);
```

Add `warmCatalogRotation` to the `../server/prices` import. Current (line 23):

```ts
import { getPrice, PRICE_TTL_MS } from "../server/prices";
```

Change to:

```ts
import { getPrice, PRICE_TTL_MS, warmCatalogRotation } from "../server/prices";
```

Add a new `describe` block at the end of the file:

```ts
describe("warmCatalogRotation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetParser.mockReturnValue(parser);
    parser.parsePrice = () => scrapeResult;
    mockedFetch.mockResolvedValue("<html>price</html>");
    mockedSetCached.mockResolvedValue(undefined);
    mockedGetAllFetchedAt.mockResolvedValue([]);
  });

  it("warms the least-recently-fetched pairs", async () => {
    mockedGetAllFetchedAt.mockResolvedValue([
      {
        distributorId: "server2u-my",
        modelNumber: "CRS804-4DDQ-hRM",
        fetchedAt: 1000,
      },
    ]);
    const warmed = await warmCatalogRotation(Date.now(), 3);
    expect(warmed).toBe(3);
    expect(mockedFetch).toHaveBeenCalledTimes(3);
    expect(mockedSetCached).toHaveBeenCalledTimes(3);
  });

  it("returns 0 when there are no pairs to warm", async () => {
    mockedGetParser.mockReturnValue(undefined);
    const warmed = await warmCatalogRotation(Date.now(), 3);
    expect(warmed).toBe(0);
    expect(mockedFetch).not.toHaveBeenCalled();
  });
});
```

> **Note:** `warmCatalogRotation` calls `buildCatalogPairs()` which imports the real `PRODUCT_CATALOG`/`DISTRIBUTORS` and uses `getParserByDistributorId` (mocked). With the parser mocked to return `parser` for all distributors, `buildCatalogPairs` returns the full cross product (~442 pairs), and `pickPairsToWarm` picks the 3 least-recently-fetched (all never-fetched = 0, since `getAllFetchedAt` returns only one entry). So `warmed` is 3.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run tests/prices.test.ts`
Expected: FAIL with "warmCatalogRotation is not exported".

- [ ] **Step 3: Modify `server/prices.ts`**

Add imports (after the `./price-history` import, line 9):

```ts
import { buildCatalogPairs, pickPairsToWarm } from "./catalog-warmer";
import { getAllFetchedAt } from "./price-cache";
```

Add the constant (after `WARMER_LEAD_MS`, line 13):

```ts
const CATALOG_WARM_PER_TICK = 3;
```

Add `warmCatalogRotation` after `refreshNearExpiry` (after line 78):

```ts
export async function warmCatalogRotation(
  now: number,
  count: number,
): Promise<number> {
  const pairs = buildCatalogPairs();
  if (pairs.length === 0) return 0;
  const fetchedRows = await getAllFetchedAt();
  const fetchedAtMap = new Map<string, number>();
  for (const row of fetchedRows) {
    fetchedAtMap.set(`${row.distributorId}:${row.modelNumber}`, row.fetchedAt);
  }
  const toWarm = pickPairsToWarm(pairs, fetchedAtMap, count);
  for (const pair of toWarm) {
    await refreshSingleFlight(pair.distributorId, pair.modelNumber);
  }
  return toWarm.length;
}
```

Change the warmer tick (lines 86-89) to call the rotation. Current:

```ts
warmerTimer = setInterval(() => {
  void refreshNearExpiry(Date.now());
  void purgeOldHistory(Date.now());
}, intervalMs);
```

Change to:

```ts
warmerTimer = setInterval(() => {
  void refreshNearExpiry(Date.now());
  void warmCatalogRotation(CATALOG_WARM_PER_TICK);
  void purgeOldHistory(Date.now());
}, intervalMs);
```

> **Note:** `warmCatalogRotation` lives in `server/prices.ts` (not `catalog-warmer.ts`) so it can call `refreshSingleFlight` directly without a circular import (`prices.ts` imports `catalog-warmer.ts`; `catalog-warmer.ts` does not import `prices.ts`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/prices.test.ts`
Expected: PASS (8 tests — 6 existing + 2 new).

- [ ] **Step 5: Verify types + full test suite**

Run: `pnpm check`
Expected: PASS.

Run: `pnpm exec vitest run tests/prices.test.ts tests/warmer.test.ts tests/catalog-warmer.test.ts tests/price-cache.test.ts`
Expected: all PASS (rotation is additive; existing warmer/cache tests unchanged).

- [ ] **Step 6: Commit**

```bash
git add server/prices.ts tests/prices.test.ts
git commit -m "feat(server): warm full catalog rotation in the price warmer"
```

---

### Task 4: Final verification + checkpoint commit

**Files:**

- Whole repo
- Modify: `todo.md`

- [ ] **Step 1: Run all verification gates**

```bash
pnpm check
pnpm lint
pnpm test
pnpm check:desktop
pnpm --filter desktop test
```

And in `desktop/src-tauri`: `cargo test`

Expected: all PASS.

- [ ] **Step 2: Update `todo.md`**

Append a Phase 29 entry after the Phase 28 block:

```markdown
## Phase 29: Full-Catalog Warming

- [x] price-cache getAllFetchedAt
- [x] Catalog pair builders (buildCatalogPairs, pickPairsToWarm)
- [x] warmCatalogRotation + wiring into the warmer tick
```

- [ ] **Step 3: Checkpoint commit**

```bash
git add -A
git commit -m "Checkpoint: v3.8: Full-catalog warming (continuous least-recently-fetched rotation of all product x distributor pairs). TypeScript: 0 errors."
```

Use the next version number per the repo's existing checkpoint history (current latest is v3.7).

---

## Self-Review Notes (from planning)

- **Spec coverage:** Every spec section maps to a task: `getAllFetchedAt` (T1), pure helpers `buildCatalogPairs`/`pickPairsToWarm` (T2), `warmCatalogRotation` + warmer-tick wiring (T3), verification (T4). Out-of-scope items (curated mapping, persisted state, client changes, cadence env vars) are untouched.
- **Circular-import avoidance:** `warmCatalogRotation` lives in `server/prices.ts` (where `refreshSingleFlight` is private) and imports the pure helpers from `server/catalog-warmer.ts`. `catalog-warmer.ts` does NOT import `prices.ts`, so there is no cycle.
- **Type consistency:** `CatalogPair` defined once in `server/catalog-warmer.ts`, used by `buildCatalogPairs` and `pickPairsToWarm`. `getAllFetchedAt` returns `Array<{ distributorId, modelNumber, fetchedAt }>` matching the rotation's fetched-at map construction. `warmCatalogRotation(count)` signature consistent across the test and the warmer-tick call (no unused `now` param — the desktop tsconfig's `noUnusedParameters` rejects it).
- **Single-flight reuse:** the rotation calls `refreshSingleFlight` (same as `refreshPrice`/near-expiry), so a pair warmed by the rotation and requested on-demand share one in-flight promise — no double-scrape.
- **Test isolation:** `tests/prices.test.ts` mocks `getAllFetchedAt` (added in T3 Step 1) so `warmCatalogRotation` uses the mock; `tests/catalog-warmer.test.ts` mocks `getParserByDistributorId` so `buildCatalogPairs` is deterministic. The existing `tests/price-cache.test.ts` memory-backend tests exercise `getAllFetchedAt`'s memory path.
