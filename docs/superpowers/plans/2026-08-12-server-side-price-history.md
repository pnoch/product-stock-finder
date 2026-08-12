# Server-Side Price History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the server the source of truth for price history — record a history point on every successful scrape, return `{ snapshot, history }` from `prices.get`, accept uploaded local history as backfill, and have mobile + desktop merge server history into their local listings.

**Architecture:** A new `price_history` Drizzle table keyed `(distributorId, modelNumber, date)` stores one point per UTC day (90-day retention, purged by the existing warmer tick). `server/prices.ts` records a point after each successful scrape and `getPrice` returns `{ snapshot, history }`. A new public `prices.uploadHistory` mutation merges client-uploaded points (dedup by day, newest wins). Mobile merges server history into `listing.priceHistory` on refresh and backfills local history at launch; desktop (Rust) does the same in its poller.

**Tech Stack:** Express + tRPC v11 + Drizzle (MySQL) + superjson; React Native (mobile); Tauri/Rust (desktop); vitest; cargo test.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `drizzle/schema.ts` | Add `price_history` table + row types |
| `drizzle/0003_*.sql` | Generated migration |
| `server/price-history.ts` | History storage: record/get/merge/purge (DB + memory fallback) |
| `server/prices.ts` | Record history on scrape; `getPrice` returns `{ snapshot, history }`; warmer purges |
| `server/routers.ts` | `prices.get` returns `{ snapshot, history }`; add `prices.uploadHistory` |
| `lib/types.ts` | Add `ServerPriceResult` helper type |
| `lib/price-history.ts` | Add `mergePriceHistory` helper (union by day, newest wins) |
| `lib/server-prices.ts` | `fetchServerPrice` returns `{ snapshot, history }`; add `uploadServerHistory` |
| `lib/background-price-check.ts` | `refreshListing` merges server history + piggyback backfill |
| `lib/history-sync.ts` | `backfillLocalHistory` at launch |
| `app/_layout.tsx` | Call `backfillLocalHistory` at launch |
| `desktop/src-tauri/src/lib.rs` | Parse history in `fetch_server_price`; merge in `update_listing_price`; `backfill_local_history` command |
| `desktop/src-tauri/src/scrapers/mod.rs` | Add `history` field to `ScrapeJobResult` |
| `tests/price-history.test.ts` | History storage tests |
| `tests/prices.test.ts` | Update for `{ snapshot, history }` + history recording |
| `tests/prices-router.test.ts` | Update for `{ snapshot, history }` + `uploadHistory` |
| `tests/server-prices.test.ts` | Update for `{ snapshot, history }` + `uploadServerHistory` |
| `tests/server-first-scrape.test.ts` | Update for merge + piggyback backfill |
| `tests/history-sync.test.ts` | `backfillLocalHistory` tests |

---

### Task 1: `price_history` Drizzle table + migration

**Files:**
- Modify: `drizzle/schema.ts`
- Test: `drizzle/0003_*.sql` (generated)

- [ ] **Step 1: Add `price_history` table to `drizzle/schema.ts`**

Add at the end of the file (after `InsertPriceCacheRow`, line 108):

```ts
export const priceHistory = mysqlTable(
  "price_history",
  {
    distributorId: varchar("distributorId", { length: 64 }).notNull(),
    modelNumber: varchar("modelNumber", { length: 128 }).notNull(),
    date: varchar("date", { length: 10 }).notNull(),
    price: double("price").notNull(),
    currency: varchar("currency", { length: 8 }).notNull(),
    stockStatus: varchar("stockStatus", { length: 16 }).notNull(),
    fetchedAt: bigint("fetchedAt", { mode: "number" }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.distributorId, table.modelNumber, table.date],
    }),
  ],
);

export type PriceHistoryRow = typeof priceHistory.$inferSelect;
export type InsertPriceHistoryRow = typeof priceHistory.$inferInsert;
```

No new imports needed — `varchar`, `double`, `bigint`, `mysqlTable`, `primaryKey` are all already imported.

- [ ] **Step 2: Generate the migration**

Run:

```bash
DATABASE_URL="mysql://localhost:3306/product_stock_finder" pnpm exec drizzle-kit generate
```

Expected: writes `drizzle/0003_*.sql` containing `CREATE TABLE \`price_history\`` with a composite primary key on `distributorId` + `modelNumber` + `date`, plus updated `drizzle/meta/_journal.json` and `drizzle/meta/0003_snapshot.json`. (This command only reads `drizzle/schema.ts` and writes SQL — it does not connect to a live DB.)

- [ ] **Step 3: Verify types**

Run: `pnpm check`
Expected: PASS (0 errors).

- [ ] **Step 4: Commit**

```bash
git add drizzle/schema.ts drizzle/0003_*.sql drizzle/meta/
git commit -m "feat(sync): add price_history table"
```

---

### Task 2: History storage — `server/price-history.ts`

**Files:**
- Create: `server/price-history.ts`
- Test: `tests/price-history.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/price-history.test.ts`:

```ts
import { describe, expect, it, beforeEach } from "vitest";
import {
  recordHistoryPoint,
  getHistory,
  mergeHistory,
  purgeOldHistory,
  clearHistoryForTests,
} from "../server/price-history";
import type { PriceSnapshot, PricePoint } from "../lib/types";

function snapshot(overrides: Partial<PriceSnapshot> = {}): PriceSnapshot {
  return {
    price: 99.5,
    currency: "USD",
    stockStatus: "in_stock",
    url: "https://example.com/p",
    fetchedAt: 1000,
    ...overrides,
  };
}

function point(overrides: Partial<PricePoint> = {}): PricePoint {
  return {
    date: "2026-08-01T00:00:00.000Z",
    price: 99.5,
    currency: "USD",
    stockStatus: "in_stock",
    ...overrides,
  };
}

describe("price history (memory backend)", () => {
  beforeEach(() => clearHistoryForTests());

  it("returns an empty history for an unknown key", async () => {
    expect(await getHistory("server2u-my", "CRS804")).toEqual([]);
  });

  it("records a point from a snapshot", async () => {
    await recordHistoryPoint(
      "server2u-my",
      "CRS804",
      snapshot({ price: 88.5, fetchedAt: Date.parse("2026-08-01T12:00:00Z") }),
    );
    const history = await getHistory("server2u-my", "CRS804");
    expect(history).toEqual([
      {
        date: "2026-08-01T12:00:00.000Z",
        price: 88.5,
        currency: "USD",
        stockStatus: "in_stock",
      },
    ]);
  });

  it("dedupes two records on the same UTC day", async () => {
    await recordHistoryPoint(
      "server2u-my",
      "CRS804",
      snapshot({ price: 88.5, fetchedAt: Date.parse("2026-08-01T08:00:00Z") }),
    );
    await recordHistoryPoint(
      "server2u-my",
      "CRS804",
      snapshot({ price: 90, fetchedAt: Date.parse("2026-08-01T20:00:00Z") }),
    );
    const history = await getHistory("server2u-my", "CRS804");
    expect(history).toHaveLength(1);
    expect(history[0]!.price).toBe(90);
  });

  it("keeps distinct days and sorts ascending", async () => {
    await recordHistoryPoint(
      "server2u-my",
      "CRS804",
      snapshot({ price: 90, fetchedAt: Date.parse("2026-08-02T00:00:00Z") }),
    );
    await recordHistoryPoint(
      "server2u-my",
      "CRS804",
      snapshot({ price: 88.5, fetchedAt: Date.parse("2026-08-01T00:00:00Z") }),
    );
    const history = await getHistory("server2u-my", "CRS804");
    expect(history.map((p) => p.price)).toEqual([88.5, 90]);
  });

  it("mergeHistory upserts points with newest fetchedAt winning", async () => {
    await mergeHistory("server2u-my", "CRS804", [
      point({ date: "2026-08-01T08:00:00.000Z", price: 100 }),
    ]);
    await mergeHistory("server2u-my", "CRS804", [
      point({ date: "2026-08-01T20:00:00.000Z", price: 95 }),
      point({ date: "2026-08-02T00:00:00.000Z", price: 90 }),
    ]);
    const history = await getHistory("server2u-my", "CRS804");
    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({ date: "2026-08-01T20:00:00.000Z", price: 95 });
    expect(history[1]).toMatchObject({ date: "2026-08-02T00:00:00.000Z", price: 90 });
  });

  it("purgeOldHistory removes rows older than 90 days", async () => {
    const now = Date.parse("2026-08-12T00:00:00Z");
    await recordHistoryPoint(
      "server2u-my",
      "CRS804",
      snapshot({ price: 80, fetchedAt: Date.parse("2026-01-01T00:00:00Z") }),
    );
    await recordHistoryPoint(
      "server2u-my",
      "CRS804",
      snapshot({ price: 90, fetchedAt: Date.parse("2026-08-01T00:00:00Z") }),
    );
    await purgeOldHistory(now);
    const history = await getHistory("server2u-my", "CRS804");
    expect(history.map((p) => p.price)).toEqual([90]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run tests/price-history.test.ts`
Expected: FAIL with "Cannot find module '../server/price-history'".

- [ ] **Step 3: Write `server/price-history.ts`**

Create `server/price-history.ts`:

```ts
import { and, eq, lt } from "drizzle-orm";
import { priceHistory, type PriceHistoryRow } from "../drizzle/schema";
import { getDb } from "./db";
import type { PricePoint, PriceSnapshot, StockStatus } from "../lib/types";

const HISTORY_DAYS = 90;

const memoryHistory = new Map<string, PricePoint[]>();

function cacheKey(distributorId: string, modelNumber: string): string {
  return `${distributorId}:${modelNumber}`;
}

function dayOf(date: string): string {
  return date.slice(0, 10);
}

export async function recordHistoryPoint(
  distributorId: string,
  modelNumber: string,
  snapshot: PriceSnapshot,
): Promise<void> {
  const point: PricePoint = {
    date: new Date(snapshot.fetchedAt).toISOString(),
    price: snapshot.price,
    currency: snapshot.currency,
    stockStatus: snapshot.stockStatus,
  };
  await mergeHistory(distributorId, modelNumber, [point]);
}

export async function getHistory(
  distributorId: string,
  modelNumber: string,
): Promise<PricePoint[]> {
  const db = await getDb();
  if (!db) {
    const points = memoryHistory.get(cacheKey(distributorId, modelNumber)) ?? [];
    return [...points].sort((a, b) => a.date.localeCompare(b.date));
  }
  const rows = await db
    .select()
    .from(priceHistory)
    .where(
      and(
        eq(priceHistory.distributorId, distributorId),
        eq(priceHistory.modelNumber, modelNumber),
      ),
    )
    .orderBy(priceHistory.date);
  return rows.map(rowToPoint);
}

export async function mergeHistory(
  distributorId: string,
  modelNumber: string,
  points: PricePoint[],
): Promise<void> {
  const db = await getDb();
  if (!db) {
    const key = cacheKey(distributorId, modelNumber);
    const existing = memoryHistory.get(key) ?? [];
    const byDay = new Map<string, PricePoint>();
    for (const p of existing) byDay.set(dayOf(p.date), p);
    for (const p of points) {
      const current = byDay.get(dayOf(p.date));
      if (!current || p.date > current.date) byDay.set(dayOf(p.date), p);
    }
    memoryHistory.set(key, [...byDay.values()]);
    return;
  }
  for (const p of points) {
    const values = {
      distributorId,
      modelNumber,
      date: dayOf(p.date),
      price: p.price,
      currency: p.currency,
      stockStatus: p.stockStatus,
      fetchedAt: Date.parse(p.date),
    };
    await db.insert(priceHistory).values(values).onDuplicateKeyUpdate({
      set: {
        price: p.price,
        currency: p.currency,
        stockStatus: p.stockStatus,
        fetchedAt: Date.parse(p.date),
      },
    });
  }
}

export async function purgeOldHistory(now: number): Promise<void> {
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - HISTORY_DAYS);
  const cutoffDay = cutoff.toISOString().slice(0, 10);
  const db = await getDb();
  if (!db) {
    for (const [key, points] of memoryHistory) {
      const kept = points.filter((p) => dayOf(p.date) >= cutoffDay);
      if (kept.length === 0) memoryHistory.delete(key);
      else memoryHistory.set(key, kept);
    }
    return;
  }
  await db.delete(priceHistory).where(lt(priceHistory.date, cutoffDay));
}

export function clearHistoryForTests(): void {
  memoryHistory.clear();
}

function rowToPoint(row: PriceHistoryRow): PricePoint {
  return {
    date: new Date(row.fetchedAt).toISOString(),
    price: row.price,
    currency: row.currency,
    stockStatus: row.stockStatus as StockStatus,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/price-history.test.ts`
Expected: PASS (6 tests). Note: `getDb()` returns null without `DATABASE_URL`, so the memory backend is exercised.

- [ ] **Step 5: Verify types**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/price-history.ts tests/price-history.test.ts
git commit -m "feat(server): add price history storage with memory fallback"
```

---

### Task 3: Record history on scrape + `getPrice` returns `{ snapshot, history }`

**Files:**
- Modify: `server/prices.ts`
- Modify: `lib/types.ts`
- Test: `tests/prices.test.ts`

- [ ] **Step 1: Add `ServerPriceResult` to `lib/types.ts`**

Add after the `PricePoint` interface (after line 48):

```ts
export interface ServerPriceResult {
  snapshot: PriceSnapshot | null;
  history: PricePoint[];
}
```

- [ ] **Step 2: Update the failing tests in `tests/prices.test.ts`**

Replace the entire file with:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { DistributorParser } from "../lib/scrapers/types";
import type { PriceSnapshot } from "../lib/types";

vi.mock("../lib/scrapers/registry", () => ({
  getParserByDistributorId: vi.fn(),
}));

vi.mock("../lib/scrapers/utils", () => ({
  fetchWithParser: vi.fn(),
}));

vi.mock("../server/price-cache", () => ({
  getCachedPrice: vi.fn(),
  setCachedPrice: vi.fn(),
  listNearExpiry: vi.fn(),
  clearPriceCacheForTests: vi.fn(),
}));

vi.mock("../server/price-history", () => ({
  recordHistoryPoint: vi.fn(),
  getHistory: vi.fn(),
  mergeHistory: vi.fn(),
  purgeOldHistory: vi.fn(),
  clearHistoryForTests: vi.fn(),
}));

import { getParserByDistributorId } from "../lib/scrapers/registry";
import { fetchWithParser } from "../lib/scrapers/utils";
import { getCachedPrice, setCachedPrice } from "../server/price-cache";
import { getHistory, recordHistoryPoint } from "../server/price-history";
import { getPrice, PRICE_TTL_MS } from "../server/prices";
import type { ScrapeResult } from "../lib/scrapers/types";

const mockedGetParser = vi.mocked(getParserByDistributorId);
const mockedFetch = vi.mocked(fetchWithParser);
const mockedGetCached = vi.mocked(getCachedPrice);
const mockedSetCached = vi.mocked(setCachedPrice);
const mockedGetHistory = vi.mocked(getHistory);
const mockedRecordHistory = vi.mocked(recordHistoryPoint);

const parser: DistributorParser = {
  id: "server2u-my",
  baseUrl: "https://server2u.com",
  buildSearchUrl: (model) => `https://server2u.com/shop?q=${model}`,
  parsePrice: () => null,
  rateLimitMs: 0,
};

const scrapeResult: ScrapeResult = {
  price: 88.5,
  currency: "MYR",
  stockStatus: "in_stock",
  url: "https://server2u.com/p/1",
};

const freshSnapshot: PriceSnapshot = {
  ...scrapeResult,
  fetchedAt: Date.now(),
};

describe("getPrice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetParser.mockReturnValue(parser);
    mockedGetHistory.mockResolvedValue([]);
  });

  it("returns a fresh cached snapshot and its history without scraping", async () => {
    mockedGetCached.mockResolvedValue(freshSnapshot);
    mockedGetHistory.mockResolvedValue([
      { date: "2026-08-01T00:00:00.000Z", price: 90, currency: "MYR", stockStatus: "in_stock" },
    ]);
    const result = await getPrice("server2u-my", "CRS804");
    expect(result).toEqual({
      snapshot: freshSnapshot,
      history: [
        { date: "2026-08-01T00:00:00.000Z", price: 90, currency: "MYR", stockStatus: "in_stock" },
      ],
    });
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("returns a stale snapshot and triggers a background refresh", async () => {
    const stale: PriceSnapshot = {
      ...scrapeResult,
      fetchedAt: Date.now() - PRICE_TTL_MS - 1000,
    };
    mockedGetCached.mockResolvedValue(stale);
    mockedFetch.mockResolvedValue("<html>price</html>");
    parser.parsePrice = () => scrapeResult;
    mockedSetCached.mockResolvedValue(undefined);

    const result = await getPrice("server2u-my", "CRS804");
    expect(result).toEqual({ snapshot: stale, history: [] });

    await vi.waitFor(() => expect(mockedFetch).toHaveBeenCalled());
    expect(mockedSetCached).toHaveBeenCalled();
  });

  it("returns null snapshot on a miss and triggers a background refresh", async () => {
    mockedGetCached.mockResolvedValue(null);
    mockedFetch.mockResolvedValue("<html>price</html>");
    parser.parsePrice = () => scrapeResult;
    mockedSetCached.mockResolvedValue(undefined);

    const result = await getPrice("server2u-my", "CRS804");
    expect(result).toEqual({ snapshot: null, history: [] });

    await vi.waitFor(() => expect(mockedFetch).toHaveBeenCalled());
    expect(mockedSetCached).toHaveBeenCalled();
  });

  it("does not throw when the refresh scrape fails", async () => {
    mockedGetCached.mockResolvedValue(null);
    mockedFetch.mockRejectedValue(new Error("network down"));
    const result = await getPrice("server2u-my", "CRS804");
    expect(result).toEqual({ snapshot: null, history: [] });
    await vi.waitFor(() => expect(mockedFetch).toHaveBeenCalled());
    expect(mockedSetCached).not.toHaveBeenCalled();
  });

  it("returns null snapshot when no parser exists for the distributor", async () => {
    mockedGetCached.mockResolvedValue(null);
    mockedGetParser.mockReturnValue(undefined);
    const result = await getPrice("unknown-dist", "CRS804");
    expect(result).toEqual({ snapshot: null, history: [] });
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("records a history point after a successful refresh", async () => {
    mockedGetCached.mockResolvedValue(null);
    mockedFetch.mockResolvedValue("<html>price</html>");
    parser.parsePrice = () => scrapeResult;
    mockedSetCached.mockResolvedValue(undefined);
    mockedRecordHistory.mockResolvedValue(undefined);

    await getPrice("server2u-my", "CRS804");
    await vi.waitFor(() => expect(mockedRecordHistory).toHaveBeenCalled());
    expect(mockedRecordHistory).toHaveBeenCalledWith(
      "server2u-my",
      "CRS804",
      expect.objectContaining({ price: 88.5, currency: "MYR" }),
    );
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm exec vitest run tests/prices.test.ts`
Expected: FAIL — `getPrice` still returns `PriceSnapshot | null`, not `{ snapshot, history }`.

- [ ] **Step 4: Modify `server/prices.ts`**

Current `refreshPrice` (lines 20-41) and `getPrice` (lines 57-68). Make these changes:

Add the import (after the `./price-cache` import, line 8):

```ts
import { getHistory, recordHistoryPoint, purgeOldHistory } from "./price-history";
```

Change `refreshPrice` to record a history point after a successful scrape:

```ts
async function refreshPrice(
  distributorId: string,
  modelNumber: string,
): Promise<PriceSnapshot | null> {
  const parser = getParserByDistributorId(distributorId);
  if (!parser) return null;
  try {
    const url = parser.buildSearchUrl(modelNumber);
    const html = await fetchWithParser(parser, url);
    const result = parser.parsePrice(html);
    if (!result) return null;
    const snapshot: PriceSnapshot = { ...result, fetchedAt: Date.now() };
    await setCachedPrice(distributorId, modelNumber, snapshot);
    await recordHistoryPoint(distributorId, modelNumber, snapshot);
    return snapshot;
  } catch (error) {
    console.warn(
      `[Prices] Scrape failed for ${distributorId}/${modelNumber}:`,
      error,
    );
    return null;
  }
}
```

Change `getPrice` to return `{ snapshot, history }`:

```ts
export async function getPrice(
  distributorId: string,
  modelNumber: string,
): Promise<ServerPriceResult> {
  const cached = await getCachedPrice(distributorId, modelNumber);
  const fresh =
    cached !== null && Date.now() - cached.fetchedAt < PRICE_TTL_MS;
  if (!fresh) {
    void refreshSingleFlight(distributorId, modelNumber);
  }
  const history = await getHistory(distributorId, modelNumber);
  return { snapshot: cached, history };
}
```

Add `ServerPriceResult` to the type import at the top of the file:

```ts
import type { PriceSnapshot, ServerPriceResult } from "../lib/types";
```

Change the warmer tick to also purge old history. Current lines 83-85:

```ts
  warmerTimer = setInterval(() => {
    void refreshNearExpiry(Date.now());
  }, intervalMs);
```

Change to:

```ts
  warmerTimer = setInterval(() => {
    void refreshNearExpiry(Date.now());
    void purgeOldHistory(Date.now());
  }, intervalMs);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/prices.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Verify types**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/prices.ts lib/types.ts tests/prices.test.ts
git commit -m "feat(server): record price history on scrape and return it from getPrice"
```

---

### Task 4: Router — `prices.get` returns `{ snapshot, history }` + `prices.uploadHistory`

**Files:**
- Modify: `server/routers.ts`
- Test: `tests/prices-router.test.ts`

- [ ] **Step 1: Update the failing tests in `tests/prices-router.test.ts`**

Replace the entire file with:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";
import type { PriceSnapshot } from "../lib/types";

vi.mock("../server/prices", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../server/prices")>();
  return {
    ...actual,
    getPrice: vi.fn(),
  };
});

vi.mock("../server/price-history", () => ({
  recordHistoryPoint: vi.fn(),
  getHistory: vi.fn(),
  mergeHistory: vi.fn(),
  purgeOldHistory: vi.fn(),
  clearHistoryForTests: vi.fn(),
}));

import { getPrice } from "../server/prices";
import { mergeHistory } from "../server/price-history";
const mockedGetPrice = vi.mocked(getPrice);
const mockedMergeHistory = vi.mocked(mergeHistory);

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      hostname: "localhost",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (_name: string, _options: Record<string, unknown>) => {},
    } as TrpcContext["res"],
  };
}

const snapshot: PriceSnapshot = {
  price: 88.5,
  currency: "MYR",
  stockStatus: "in_stock",
  url: "https://server2u.com/p/1",
  fetchedAt: 1000,
};

describe("prices router", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the snapshot and history for a distributor and model", async () => {
    mockedGetPrice.mockResolvedValue({
      snapshot,
      history: [
        { date: "2026-08-01T00:00:00.000Z", price: 90, currency: "MYR", stockStatus: "in_stock" },
      ],
    });
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.prices.get({
      distributorId: "server2u-my",
      modelNumber: "CRS804",
    });
    expect(result).toEqual({
      snapshot,
      history: [
        { date: "2026-08-01T00:00:00.000Z", price: 90, currency: "MYR", stockStatus: "in_stock" },
      ],
    });
    expect(mockedGetPrice).toHaveBeenCalledWith("server2u-my", "CRS804");
  });

  it("returns null snapshot when there is no cached price", async () => {
    mockedGetPrice.mockResolvedValue({ snapshot: null, history: [] });
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.prices.get({
      distributorId: "server2u-my",
      modelNumber: "CRS804",
    });
    expect(result).toEqual({ snapshot: null, history: [] });
  });

  it("works without authentication (public procedure)", async () => {
    mockedGetPrice.mockResolvedValue({ snapshot, history: [] });
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.prices.get({ distributorId: "a", modelNumber: "b" }),
    ).resolves.toEqual({ snapshot, history: [] });
  });

  it("uploadHistory merges uploaded points and returns the accepted count", async () => {
    mockedMergeHistory.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createPublicContext());
    const points = [
      { date: "2026-08-01T00:00:00.000Z", price: 90, currency: "MYR", stockStatus: "in_stock" },
    ];
    const result = await caller.prices.uploadHistory({
      distributorId: "server2u-my",
      modelNumber: "CRS804",
      points,
    });
    expect(result).toEqual({ accepted: 1 });
    expect(mockedMergeHistory).toHaveBeenCalledWith(
      "server2u-my",
      "CRS804",
      points,
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run tests/prices-router.test.ts`
Expected: FAIL — `prices.uploadHistory` doesn't exist yet and `prices.get` returns the old shape.

- [ ] **Step 3: Modify `server/routers.ts`**

The current `prices` router block (lines 65-76):

```ts
  prices: router({
    get: publicProcedure
      .input(
        z.object({
          distributorId: z.string().min(1),
          modelNumber: z.string().min(1),
        }),
      )
      .query(async ({ input }) => {
        return getPrice(input.distributorId, input.modelNumber);
      }),
  }),
```

Replace it with:

```ts
  prices: router({
    get: publicProcedure
      .input(
        z.object({
          distributorId: z.string().min(1),
          modelNumber: z.string().min(1),
        }),
      )
      .query(async ({ input }) => {
        return getPrice(input.distributorId, input.modelNumber);
      }),
    uploadHistory: publicProcedure
      .input(
        z.object({
          distributorId: z.string().min(1),
          modelNumber: z.string().min(1),
          points: z.array(
            z.object({
              date: z.string(),
              price: z.number(),
              currency: z.string(),
              stockStatus: z.enum([
                "in_stock",
                "back_order",
                "out_of_stock",
                "unknown",
              ]),
            }),
          ),
        }),
      )
      .mutation(async ({ input }) => {
        await mergeHistory(input.distributorId, input.modelNumber, input.points);
        return { accepted: input.points.length } as const;
      }),
  }),
```

Add `mergeHistory` to the imports at the top of the file (after the `getPrice` import, line 13):

```ts
import { getPrice } from "./prices";
import { mergeHistory } from "./price-history";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/prices-router.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Verify types + full test suite**

Run: `pnpm check`
Expected: PASS.

Run: `pnpm exec vitest run tests/prices-router.test.ts tests/sync-router.test.ts`
Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add server/routers.ts tests/prices-router.test.ts
git commit -m "feat(server): add public prices.uploadHistory endpoint"
```

---

### Task 5: Mobile client helper — `{ snapshot, history }` + `uploadServerHistory`

**Files:**
- Modify: `lib/server-prices.ts`
- Test: `tests/server-prices.test.ts`

- [ ] **Step 1: Update the failing tests in `tests/server-prices.test.ts`**

Replace the entire file with:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import type { PriceSnapshot } from "../lib/types";

vi.mock("../lib/trpc", () => ({
  createTRPCClient: vi.fn(),
}));

import { createTRPCClient } from "../lib/trpc";
import { fetchServerPrice, uploadServerHistory } from "../lib/server-prices";

const mockedCreateClient = vi.mocked(createTRPCClient);

const snapshot: PriceSnapshot = {
  price: 88.5,
  currency: "MYR",
  stockStatus: "in_stock",
  url: "https://server2u.com/p/1",
  fetchedAt: 1000,
};

function mockClient(query: Mock, mutation: Mock) {
  mockedCreateClient.mockReturnValue({
    prices: {
      get: { query },
      uploadHistory: { mutate: mutation },
    },
  } as unknown as ReturnType<typeof createTRPCClient>);
}

describe("fetchServerPrice", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the snapshot and history from the server", async () => {
    const query = vi.fn().mockResolvedValue({
      snapshot,
      history: [
        { date: "2026-08-01T00:00:00.000Z", price: 90, currency: "MYR", stockStatus: "in_stock" },
      ],
    });
    mockClient(query, vi.fn());
    const result = await fetchServerPrice("server2u-my", "CRS804");
    expect(result).toEqual({
      snapshot,
      history: [
        { date: "2026-08-01T00:00:00.000Z", price: 90, currency: "MYR", stockStatus: "in_stock" },
      ],
    });
    expect(query).toHaveBeenCalledWith({
      distributorId: "server2u-my",
      modelNumber: "CRS804",
    });
  });

  it("returns null when the server returns a null snapshot", async () => {
    const query = vi.fn().mockResolvedValue({ snapshot: null, history: [] });
    mockClient(query, vi.fn());
    expect(await fetchServerPrice("server2u-my", "CRS804")).toBeNull();
  });

  it("returns null when the query rejects", async () => {
    const query = vi.fn().mockRejectedValue(new Error("network"));
    mockClient(query, vi.fn());
    expect(await fetchServerPrice("server2u-my", "CRS804")).toBeNull();
  });

  it("returns null when the query times out", async () => {
    const query = vi.fn().mockImplementation(
      () =>
        new Promise<{ snapshot: PriceSnapshot; history: unknown[] }>((resolve) =>
          setTimeout(() => resolve({ snapshot, history: [] }), 10_000),
        ),
    );
    mockClient(query, vi.fn());
    const result = await fetchServerPrice("server2u-my", "CRS804");
    expect(result).toBeNull();
  });
});

describe("uploadServerHistory", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mutates the server with the uploaded points", async () => {
    const mutation = vi.fn().mockResolvedValue({ accepted: 2 });
    mockClient(vi.fn(), mutation);
    const points = [
      { date: "2026-08-01T00:00:00.000Z", price: 90, currency: "MYR", stockStatus: "in_stock" },
      { date: "2026-08-02T00:00:00.000Z", price: 88, currency: "MYR", stockStatus: "in_stock" },
    ];
    await uploadServerHistory("server2u-my", "CRS804", points);
    expect(mutation).toHaveBeenCalledWith({
      distributorId: "server2u-my",
      modelNumber: "CRS804",
      points,
    });
  });

  it("swallows errors", async () => {
    const mutation = vi.fn().mockRejectedValue(new Error("network"));
    mockClient(vi.fn(), mutation);
    await expect(
      uploadServerHistory("server2u-my", "CRS804", []),
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run tests/server-prices.test.ts`
Expected: FAIL — `fetchServerPrice` returns the old shape and `uploadServerHistory` doesn't exist.

- [ ] **Step 3: Modify `lib/server-prices.ts`**

Replace the entire file with:

```ts
import { createTRPCClient } from "./trpc";
import type { PricePoint, ServerPriceResult } from "./types";

const TIMEOUT_MS = 4000;

export async function fetchServerPrice(
  distributorId: string,
  modelNumber: string,
): Promise<ServerPriceResult | null> {
  try {
    const client = createTRPCClient();
    const result = await Promise.race([
      client.prices.get.query({ distributorId, modelNumber }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
    ]);
    if (!result || !result.snapshot) return null;
    return result;
  } catch {
    return null;
  }
}

export async function uploadServerHistory(
  distributorId: string,
  modelNumber: string,
  points: PricePoint[],
): Promise<void> {
  try {
    const client = createTRPCClient();
    await client.prices.uploadHistory.mutate({
      distributorId,
      modelNumber,
      points,
    });
  } catch {
    // Swallow — history upload is best-effort
  }
}
```

> **Note:** `fetchServerPrice` returns null when the server responds with a null snapshot (miss), preserving the existing "null means fall back to local scraping" contract. `uploadServerHistory` is fire-and-forget and swallows errors.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/server-prices.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Verify types**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/server-prices.ts tests/server-prices.test.ts
git commit -m "feat(mobile): return history from fetchServerPrice and add uploadServerHistory"
```

---

### Task 6: Mobile merge — `refreshListing` merges server history + piggyback backfill

**Files:**
- Modify: `lib/price-history.ts`
- Modify: `lib/background-price-check.ts`
- Test: `tests/server-first-scrape.test.ts`

- [ ] **Step 1: Add `mergePriceHistory` to `lib/price-history.ts`**

Append to the end of `lib/price-history.ts`:

```ts
export function mergePriceHistory(
  local: PricePoint[],
  server: PricePoint[],
  maxDays = 90,
  now = new Date().toISOString(),
): PricePoint[] {
  const byDay = new Map<string, PricePoint>();
  for (const p of [...local, ...server]) {
    const day = p.date.slice(0, 10);
    const existing = byDay.get(day);
    if (!existing || p.date > existing.date) byDay.set(day, p);
  }
  const merged = [...byDay.values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - maxDays);
  const cutoffDay = cutoff.toISOString().slice(0, 10);
  return merged.filter((p) => p.date.slice(0, 10) >= cutoffDay);
}
```

Add `PricePoint` to the type import at the top of `lib/price-history.ts`:

```ts
import type { PricePoint } from "@/lib/types";
```

- [ ] **Step 2: Update the failing tests in `tests/server-first-scrape.test.ts`**

The current file mocks `../lib/server-prices` with only `fetchServerPrice` (line 27-29). Update that mock to also expose `uploadServerHistory`:

```ts
vi.mock("../lib/server-prices", () => ({
  fetchServerPrice: vi.fn(),
  uploadServerHistory: vi.fn(),
}));
```

Add `uploadServerHistory` to the imports (after the `fetchServerPrice` import):

```ts
import { fetchServerPrice, uploadServerHistory } from "../lib/server-prices";
```

Add the mocked variable (after `const mockedFetchServer`):

```ts
const mockedUploadHistory = vi.mocked(uploadServerHistory);
```

In the `beforeEach`, reset it:

```ts
  beforeEach(() => {
    vi.clearAllMocks();
    state.watchlistStore = [product];
    state.updatedListings = [];
  });
```

Update the first test ("uses the server price when the server responds") to return the new shape and assert history merge. Replace it with:

```ts
  it("uses the server price and merges server history when the server responds", async () => {
    mockedFetchServer.mockResolvedValue({
      snapshot: {
        price: 88.5,
        currency: "MYR",
        stockStatus: "in_stock",
        url: "https://server2u.com/p/1",
        fetchedAt: 1000,
      },
      history: [
        { date: "2026-07-01T00:00:00.000Z", price: 95, currency: "MYR", stockStatus: "in_stock" },
        { date: "2026-08-01T00:00:00.000Z", price: 88.5, currency: "MYR", stockStatus: "in_stock" },
      ],
    });

    await checkPriceDropsNow();

    expect(mockedFetchLocal).not.toHaveBeenCalled();
    expect(state.updatedListings).toHaveLength(1);
    const updated = state.updatedListings[0][0];
    expect(updated.price).toBe(88.5);
    expect(updated.currency).toBe("MYR");
    expect(updated.stockStatus).toBe("in_stock");
    expect(updated.priceHistory).toHaveLength(2);
    expect(updated.priceHistory[0]).toMatchObject({ price: 95 });
  });
```

Update the second test ("falls back to local scraping when the server returns null") — `fetchServerPrice` still returns null, so the local path runs unchanged. No change needed to the mock value.

Update the third test ("keeps the listing unchanged when both server and local fail") — no change needed.

Add a new test for piggyback backfill at the end of the `describe` block:

```ts
  it("uploads local history when the server history is shorter", async () => {
    const localHistory = [
      { date: "2026-06-01T00:00:00.000Z", price: 100, currency: "USD", stockStatus: "unknown" },
      { date: "2026-07-01T00:00:00.000Z", price: 98, currency: "USD", stockStatus: "unknown" },
    ];
    state.watchlistStore = [
      { ...product, listings: [{ ...listing, priceHistory: localHistory }] },
    ];
    mockedFetchServer.mockResolvedValue({
      snapshot: {
        price: 88.5,
        currency: "MYR",
        stockStatus: "in_stock",
        url: "https://server2u.com/p/1",
        fetchedAt: 1000,
      },
      history: [],
    });

    await checkPriceDropsNow();

    expect(mockedUploadHistory).toHaveBeenCalledWith(
      "server2u-my",
      "CRS804",
      localHistory,
    );
  });
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm exec vitest run tests/server-first-scrape.test.ts`
Expected: FAIL — `refreshListing` doesn't merge server history or upload local history yet.

- [ ] **Step 4: Modify `lib/background-price-check.ts`**

Add the import (after the `fetchServerPrice` import, line 12):

```ts
import { fetchServerPrice, uploadServerHistory } from "./server-prices";
```

Add `mergePriceHistory` to the `./price-history` import (line 14):

```ts
import { appendPricePoint, mergePriceHistory } from "./price-history";
```

In `refreshListing` (lines 57-146), the server-result branch currently builds the updated listing from `serverResult` directly. Replace the server-result branch:

```ts
  if (serverResult) {
    healthCollector.record(listing.distributorId, "working");
    const now = new Date().toISOString();
    const newPricePoint: PricePoint = {
      date: now,
      price: serverResult.snapshot.price,
      currency: serverResult.snapshot.currency,
      stockStatus: serverResult.snapshot.stockStatus,
    };
    const mergedHistory = mergePriceHistory(
      listing.priceHistory,
      serverResult.history,
    );
    if (serverResult.history.length < listing.priceHistory.length) {
      void uploadServerHistory(
        listing.distributorId,
        product.modelNumber,
        listing.priceHistory,
      );
    }
    return {
      ...listing,
      price: serverResult.snapshot.price,
      currency: serverResult.snapshot.currency,
      stockStatus: serverResult.snapshot.stockStatus,
      expectedDate: serverResult.snapshot.expectedDate,
      url: serverResult.snapshot.url,
      lastChecked: now,
      priceHistory: appendPricePoint(
        mergedHistory,
        newPricePoint,
        PRICE_HISTORY_DAYS,
      ),
    };
  }
```

> **Note:** `serverResult` is now `ServerPriceResult` (has `.snapshot` and `.history`), not a bare `PriceSnapshot`. The merge unions local + server history by day (newest wins), then appends today's point with the existing `appendPricePoint` (which dedupes today and prunes to 90 days). The piggyback backfill fires when the server history is shorter than local — uploading the local points so the server catches up.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/server-first-scrape.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Run the existing price-check tests**

Run: `pnpm exec vitest run tests/price-check.test.ts`
Expected: PASS. If the existing `tests/price-check.test.ts` mock of `../lib/server-prices` only has `fetchServerPrice`, add `uploadServerHistory: vi.fn(async () => {})` to it (line ~27-29):

```ts
vi.mock("../lib/server-prices", () => ({
  fetchServerPrice: vi.fn(async () => null),
  uploadServerHistory: vi.fn(async () => {}),
}));
```

- [ ] **Step 7: Verify types**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/price-history.ts lib/background-price-check.ts tests/server-first-scrape.test.ts tests/price-check.test.ts
git commit -m "feat(mobile): merge server history into listings with piggyback backfill"
```

---

### Task 7: Launch backfill — `lib/history-sync.ts`

**Files:**
- Create: `lib/history-sync.ts`
- Modify: `app/_layout.tsx`
- Test: `tests/history-sync.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/history-sync.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Product } from "../lib/types";

const state = vi.hoisted(() => ({
  watchlistStore: [] as Product[],
  uploaded: [] as Array<{ distributorId: string; modelNumber: string; points: unknown[] }>,
}));

vi.mock("../lib/storage", () => ({
  getWatchlist: vi.fn(async () => state.watchlistStore),
}));

vi.mock("../lib/server-prices", () => ({
  uploadServerHistory: vi.fn(async (distributorId: string, modelNumber: string, points: unknown[]) => {
    state.uploaded.push({ distributorId, modelNumber, points });
  }),
}));

import { backfillLocalHistory } from "../lib/history-sync";

function makeProduct(modelNumber: string, historyLength: number): Product {
  const points = Array.from({ length: historyLength }, (_, i) => ({
    date: `2026-07-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`,
    price: 100 - i,
    currency: "USD",
    stockStatus: "in_stock" as const,
  }));
  return {
    id: modelNumber.toLowerCase(),
    name: modelNumber,
    modelNumber,
    brand: "MikroTik",
    category: "Networking Switch",
    description: "",
    imageUrl: "",
    addedAt: "2026-01-01T00:00:00.000Z",
    isWatched: true,
    listings: [
      {
        distributorId: "server2u-my",
        productId: modelNumber.toLowerCase(),
        price: 90,
        currency: "USD",
        stockStatus: "in_stock",
        url: "https://example.com",
        lastChecked: "2026-08-01T00:00:00.000Z",
        priceHistory: points,
      },
    ],
  };
}

describe("backfillLocalHistory", () => {
  beforeEach(() => {
    state.watchlistStore = [];
    state.uploaded = [];
  });

  it("uploads local history for each watched listing", async () => {
    state.watchlistStore = [makeProduct("CRS804", 3), makeProduct("CRS326", 2)];
    const count = await backfillLocalHistory();
    expect(count).toBe(2);
    expect(state.uploaded).toHaveLength(2);
    expect(state.uploaded[0]).toMatchObject({
      distributorId: "server2u-my",
      modelNumber: "CRS804",
    });
    expect(state.uploaded[0]!.points).toHaveLength(3);
    expect(state.uploaded[1]).toMatchObject({ modelNumber: "CRS326" });
  });

  it("skips listings with empty history", async () => {
    state.watchlistStore = [makeProduct("CRS804", 0)];
    const count = await backfillLocalHistory();
    expect(count).toBe(0);
    expect(state.uploaded).toHaveLength(0);
  });

  it("returns 0 when the watchlist is empty", async () => {
    const count = await backfillLocalHistory();
    expect(count).toBe(0);
  });

  it("swallows upload errors", async () => {
    state.watchlistStore = [makeProduct("CRS804", 1)];
    state.uploaded = [];
    const { uploadServerHistory } = await import("../lib/server-prices");
    vi.mocked(uploadServerHistory).mockRejectedValueOnce(new Error("network"));
    const count = await backfillLocalHistory();
    expect(count).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run tests/history-sync.test.ts`
Expected: FAIL with "Cannot find module '../lib/history-sync'".

- [ ] **Step 3: Write `lib/history-sync.ts`**

Create `lib/history-sync.ts`:

```ts
import { getWatchlist } from "./storage";
import { uploadServerHistory } from "./server-prices";

export async function backfillLocalHistory(): Promise<number> {
  try {
    const watchlist = await getWatchlist();
    let uploaded = 0;
    for (const product of watchlist) {
      for (const listing of product.listings ?? []) {
        if (listing.priceHistory.length === 0) continue;
        await uploadServerHistory(
          listing.distributorId,
          product.modelNumber,
          listing.priceHistory,
        );
        uploaded += 1;
      }
    }
    return uploaded;
  } catch {
    return 0;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/history-sync.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Wire into `app/_layout.tsx`**

Add the import (near the other lib imports, after line 43 `import { setupSync, type SyncSetup } from "@/lib/sync";`):

```ts
import { backfillLocalHistory } from "@/lib/history-sync";
```

Add a call in the existing `useEffect` that runs on auth change (lines 183-185):

```ts
  useEffect(() => {
    if (isAuthenticated) syncRef.current?.syncNow();
  }, [isAuthenticated]);
```

Change to:

```ts
  useEffect(() => {
    if (isAuthenticated) {
      syncRef.current?.syncNow();
      void backfillLocalHistory();
    }
  }, [isAuthenticated]);
```

- [ ] **Step 6: Verify types**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/history-sync.ts app/_layout.tsx tests/history-sync.test.ts
git commit -m "feat(mobile): backfill local price history at launch"
```

---

### Task 8: Desktop — parse history, merge in poller, backfill command

**Files:**
- Modify: `desktop/src-tauri/src/scrapers/mod.rs`
- Modify: `desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Add `history` field to `ScrapeJobResult`**

In `desktop/src-tauri/src/scrapers/mod.rs`, change `ScrapeJobResult` (lines 50-57):

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScrapeJobResult {
    pub distributor_id: String,
    pub product_id: String,
    pub result: Option<ScrapeResult>,
    pub error: Option<String>,
    pub duration_ms: u64,
    pub history: Vec<serde_json::Value>,
}
```

- [ ] **Step 2: Update `fetch_server_price` to parse history**

In `desktop/src-tauri/src/lib.rs`, change `fetch_server_price` (lines 486-529) to return the snapshot plus history. Replace the function with:

```rust
async fn fetch_server_price(
    api_base_url: &str,
    distributor_id: &str,
    model: &str,
) -> Option<(scrapers::ScrapeResult, Vec<serde_json::Value>)> {
    if api_base_url.is_empty() {
        return None;
    }
    let input = serde_json::json!({
        "json": {
            "distributorId": distributor_id,
            "modelNumber": model,
        }
    });
    let url = format!(
        "{}/api/trpc/prices.get?input={}",
        api_base_url.trim_end_matches('/'),
        urlencoding::encode(&input.to_string())
    );
    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .timeout(std::time::Duration::from_secs(8))
        .send()
        .await
        .ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let body: serde_json::Value = resp.json().await.ok()?;
    let data = body.pointer("/result/data/json")?;
    let snapshot = data.get("snapshot")?;
    let price = snapshot.get("price")?.as_f64()?;
    let currency = snapshot.get("currency")?.as_str()?.to_string();
    let stock_status = snapshot.get("stockStatus").and_then(|v| v.as_str()).unwrap_or("unknown").to_string();
    let expected_date = snapshot.get("expectedDate").and_then(|v| v.as_str()).map(|s| s.to_string());
    let url = snapshot.get("url").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let history = data.get("history").and_then(|v| v.as_array()).cloned().unwrap_or_default();
    Some((
        scrapers::ScrapeResult {
            price,
            currency,
            stock_status,
            expected_date,
            url,
        },
        history,
    ))
}
```

- [ ] **Step 3: Thread history through `check_all_prices`**

In `desktop/src-tauri/src/lib.rs`, change `check_all_prices` (lines 421-447). The current inner loop:

```rust
            let start = std::time::Instant::now();
            let scrape_result = match fetch_server_price(&api_base_url, &distributor_id, &product.model_number).await {
                Some(r) => Ok(r),
                None => scrape_distributor(&distributor_id, &product.model_number).await,
            };
            let duration_ms = start.elapsed().as_millis() as u64;
            let (result, error) = match scrape_result {
                Ok(r) => (Some(r), None),
                Err(e) => (None, Some(e)),
            };
            results.push(scrapers::ScrapeJobResult {
                distributor_id,
                product_id: product.id.clone(),
                result,
                error,
                duration_ms,
            });
```

Replace with:

```rust
            let start = std::time::Instant::now();
            let (scrape_result, history) = match fetch_server_price(&api_base_url, &distributor_id, &product.model_number).await {
                Some((r, h)) => (Ok(r), h),
                None => (scrape_distributor(&distributor_id, &product.model_number).await, Vec::new()),
            };
            let duration_ms = start.elapsed().as_millis() as u64;
            let (result, error) = match scrape_result {
                Ok(r) => (Some(r), None),
                Err(e) => (None, Some(e)),
            };
            results.push(scrapers::ScrapeJobResult {
                distributor_id,
                product_id: product.id.clone(),
                result,
                error,
                duration_ms,
                history,
            });
```

- [ ] **Step 4: Merge server history in `run_full_price_check` / `update_listing_price`**

In `desktop/src-tauri/src/lib.rs`, change the `run_full_price_check` loop (lines 643-656). Current:

```rust
    for job_result in &results {
        if let Some(scrape) = &job_result.result {
            update_listing_price(&data_dir, &job_result.product_id, &job_result.distributor_id, scrape)?;
            let _ = app.emit("listing-updated", serde_json::json!({
                "productId": job_result.product_id,
                "distributorId": job_result.distributor_id,
                "price": scrape.price,
                "currency": scrape.currency,
                "stockStatus": scrape.stock_status,
                "expectedDate": scrape.expected_date,
                "lastChecked": current_iso_timestamp(),
            }));
        }
    }
```

Replace with:

```rust
    for job_result in &results {
        if let Some(scrape) = &job_result.result {
            update_listing_price(&data_dir, &job_result.product_id, &job_result.distributor_id, scrape, &job_result.history)?;
            let _ = app.emit("listing-updated", serde_json::json!({
                "productId": job_result.product_id,
                "distributorId": job_result.distributor_id,
                "price": scrape.price,
                "currency": scrape.currency,
                "stockStatus": scrape.stock_status,
                "expectedDate": scrape.expected_date,
                "lastChecked": current_iso_timestamp(),
            }));
        }
    }
```

Change `update_listing_price` (line 669) signature:

```rust
fn update_listing_price(
    data_dir: &PathBuf,
    product_id: &str,
    distributor_id: &str,
    scrape: &scrapers::ScrapeResult,
    server_history: &[serde_json::Value],
) -> Result<(), String> {
```

In the listing update block (around lines 714-735), before appending today's point, merge the server history. Current block:

```rust
                // Append a price point to history so the compare chart stays fresh,
                // replacing the same-day point and pruning to a 90-day window.
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs();
                let cutoff_day = iso_date_from_secs(now.saturating_sub(90 * 86400));
                let point = serde_json::json!({
                    "date": current_iso_timestamp(),
                    "price": scrape.price,
                    "currency": scrape.currency,
                    "stockStatus": scrape.stock_status,
                });
                match obj.get_mut("priceHistory").and_then(|v| v.as_array_mut()) {
                    Some(arr) => append_price_point_with_retention(arr, point, &cutoff_day),
                    None => {
                        obj.insert("priceHistory".to_string(), serde_json::json!([point]));
                    }
                }
```

Replace with:

```rust
                // Merge server history (union by day, newest wins) then append today's point,
                // pruning to a 90-day window.
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs();
                let cutoff_day = iso_date_from_secs(now.saturating_sub(90 * 86400));
                let point = serde_json::json!({
                    "date": current_iso_timestamp(),
                    "price": scrape.price,
                    "currency": scrape.currency,
                    "stockStatus": scrape.stock_status,
                });
                let existing = obj.get_mut("priceHistory").and_then(|v| v.as_array_mut());
                match existing {
                    Some(arr) => {
                        for hp in server_history {
                            append_price_point_with_retention(arr, hp.clone(), &cutoff_day);
                        }
                        append_price_point_with_retention(arr, point, &cutoff_day);
                    }
                    None => {
                        let mut arr = server_history.to_vec();
                        arr.push(point);
                        obj.insert("priceHistory".to_string(), serde_json::Value::Array(arr));
                    }
                }
```

> **Note:** `append_price_point_with_retention` already implements union-by-day with newest-wins (it replaces the same-day point) and prunes to the cutoff. Feeding server history points through it achieves the merge.

- [ ] **Step 5: Add `backfill_local_history` command**

Add a new command after `check_all_prices` (after line ~447). It reads the watchlist, uploads each listing's local `priceHistory`, and returns a count:

```rust
#[tauri::command]
async fn backfill_local_history(app: tauri::AppHandle, api_base_url: String) -> Result<u64, String> {
    if api_base_url.is_empty() {
        return Ok(0);
    }
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let watchlist_val = read_json_file(&data_dir, "watchlist_products")?;
    let watchlist: Vec<serde_json::Value> = watchlist_val
        .as_array()
        .cloned()
        .unwrap_or_default();

    let mut uploaded = 0u64;
    for product in &watchlist {
        let model_number = product.get("modelNumber").and_then(|v| v.as_str()).unwrap_or("");
        if model_number.is_empty() {
            continue;
        }
        let listings = product.get("listings").and_then(|v| v.as_array()).cloned().unwrap_or_default();
        for listing in &listings {
            let distributor_id = listing.get("distributorId").and_then(|v| v.as_str()).unwrap_or("");
            let history = listing.get("priceHistory").and_then(|v| v.as_array()).cloned().unwrap_or_default();
            if distributor_id.is_empty() || history.is_empty() {
                continue;
            }
            if upload_server_history(&api_base_url, distributor_id, model_number, &history).await.is_ok() {
                uploaded += 1;
            }
        }
    }
    Ok(uploaded)
}

async fn upload_server_history(
    api_base_url: &str,
    distributor_id: &str,
    model_number: &str,
    points: &[serde_json::Value],
) -> Result<(), String> {
    if api_base_url.is_empty() {
        return Ok(());
    }
    let input = serde_json::json!({
        "json": {
            "distributorId": distributor_id,
            "modelNumber": model_number,
            "points": points,
        }
    });
    let url = format!(
        "{}/api/trpc/prices.uploadHistory",
        api_base_url.trim_end_matches('/')
    );
    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .json(&input)
        .timeout(std::time::Duration::from_secs(8))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("uploadHistory failed: {}", resp.status()));
    }
    Ok(())
}
```

- [ ] **Step 6: Register the command + call backfill from the poller**

Add `backfill_local_history` to the `generate_handler!` list (after `check_all_prices`, line ~1007):

```rust
            check_all_prices,
            backfill_local_history,
```

In `start_price_poller` (lines 276-307), after the `running` guard is released, spawn the backfill. Current:

```rust
    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(interval_minutes * 60));
        interval.tick().await;
        loop {
```

Change to:

```rust
    let handle = app.clone();
    let backfill_url = api_base_url.clone();
    tauri::async_runtime::spawn(async move {
        let _ = backfill_local_history(handle.clone(), backfill_url.clone()).await;
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(interval_minutes * 60));
        interval.tick().await;
        loop {
```

> **Note:** `backfill_local_history` is `async` and takes `app: tauri::AppHandle`, so calling it from within the spawned task with `handle.clone()` works.

- [ ] **Step 7: Verify Rust compiles and tests pass**

Run: `cargo test` in `desktop/src-tauri`
Expected: PASS (existing tests compile and pass).

- [ ] **Step 8: Verify desktop typecheck + tests**

Run: `pnpm check:desktop`
Expected: PASS.

Run: `pnpm --filter desktop test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add desktop/src-tauri/src/lib.rs desktop/src-tauri/src/scrapers/mod.rs
git commit -m "feat(desktop): merge server price history and backfill local history"
```

---

### Task 9: Final verification + checkpoint commit

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

Append a Phase 28 entry after the Phase 27 block:

```markdown
## Phase 28: Server-Side Price History

- [x] price_history Drizzle table + migration
- [x] Server history storage (record/get/merge/purge, memory fallback)
- [x] Record history on scrape; getPrice returns { snapshot, history }
- [x] Public prices.uploadHistory endpoint
- [x] Mobile fetchServerPrice returns { snapshot, history } + uploadServerHistory
- [x] Mobile refreshListing merges server history + piggyback backfill
- [x] Mobile launch backfill (lib/history-sync.ts)
- [x] Desktop history merge + backfill command (Rust)
```

- [ ] **Step 3: Checkpoint commit**

```bash
git add -A
git commit -m "Checkpoint: v3.7: Server-side price history (history recording, prices.get returns history, uploadHistory backfill, mobile+desktop merge). TypeScript: 0 errors."
```

Use the next version number per the repo's existing checkpoint history (current latest is v3.6).

---

## Self-Review Notes (from planning)

- **Spec coverage:** Every spec section maps to a task: `price_history` table (T1), history storage (T2), record-on-scrape + `getPrice` shape (T3), `uploadHistory` endpoint (T4), mobile helper shape (T5), mobile merge + piggyback (T6), launch backfill (T7), desktop merge + backfill (T8), verification (T9). Out-of-scope items (chart UI, retention > 90 days, change-only recording) are untouched.
- **Type consistency:** `ServerPriceResult` defined once in `lib/types.ts` (T3), used by `server/prices.ts`, `lib/server-prices.ts`, and the router. `fetchServerPrice` returns `ServerPriceResult | null` (null on miss/unreachable — preserves the existing local-fallback contract). `mergePriceHistory(local, server)` in `lib/price-history.ts` is used by `refreshListing`; the Rust side reuses `append_price_point_with_retention` for the same union-by-day/newest-wins semantics.
- **`prices.get` shape change ripple:** The return type changes from `PriceSnapshot | null` to `{ snapshot, history }` across server (T3), router (T4), mobile helper (T5), and desktop Rust (T8). All consumers updated in the same phase.
- **Piggyback backfill condition:** fires when `serverResult.history.length < listing.priceHistory.length` (server behind). The launch backfill (T7) handles the cold-start case where the server has no history at all.
- **Desktop merge:** `append_price_point_with_retention` already implements union-by-day/newest-wins + 90-day pruning, so feeding server history points through it (T8 Step 4) achieves the merge without a new Rust helper.
- **Test isolation:** `tests/price-check.test.ts` and `tests/server-first-scrape.test.ts` mocks of `../lib/server-prices` must include `uploadServerHistory` after T6 (noted in T6 Step 6).