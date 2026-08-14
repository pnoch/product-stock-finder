# Server-Side Price Scraping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a server-side price scraping service (shared cache + background warmer + public tRPC endpoint) and wire mobile + desktop clients to try the server first, falling back to local scraping.

**Architecture:** A single public `prices.get` tRPC procedure backed by `server/prices.ts`. On request it returns the cached snapshot (fresh → immediate; stale → stale value + background refresh; miss → null + background refresh). Refreshes reuse the existing `lib/scrapers/` TS parsers (rate-limited fetch or Playwright), are single-flighted per (distributor, model), and a `setInterval` warmer refreshes near-expiry entries. Cache lives in a new Drizzle `price_cache` table with an in-memory Map fallback when no `DATABASE_URL`. Clients call `fetchServerPrice` first and fall back to local scraping on null/unreachable.

**Tech Stack:** Express + tRPC v11 + Drizzle (MySQL) + superjson; `lib/scrapers/` (cheerio + fetch + Playwright); React Native (mobile) + Tauri/Rust (desktop); vitest.

---

## File Structure

| File                                                    | Responsibility                                            |
| ------------------------------------------------------- | --------------------------------------------------------- |
| `lib/types.ts`                                          | Add shared `PriceSnapshot` type                           |
| `drizzle/schema.ts`                                     | Add `price_cache` table + row types                       |
| `drizzle/0002_*.sql`                                    | Generated migration                                       |
| `server/price-cache.ts`                                 | Cache backend: DB table + in-memory Map, same interface   |
| `server/prices.ts`                                      | `getPrice`, single-flight refresh, `startWarmer`          |
| `server/routers.ts`                                     | Add `prices.get` public procedure                         |
| `lib/server-prices.ts`                                  | Mobile client helper `fetchServerPrice`                   |
| `lib/background-price-check.ts`                         | Server-first + local fallback in both scrape loops        |
| `desktop/src/background.ts`                             | Pass `apiBaseUrl` to Rust poller commands                 |
| `desktop/src/App.tsx`, `desktop/src/pages/Settings.tsx` | Pass `getApiBaseUrl()` to poller                          |
| `desktop/src-tauri/src/lib.rs`                          | `fetch_server_price` + server-first in `check_all_prices` |
| `tests/price-cache.test.ts`                             | Cache backend tests                                       |
| `tests/prices-router.test.ts`                           | Router tests                                              |
| `tests/server-prices.test.ts`                           | Mobile client helper tests                                |
| `tests/server-first-scrape.test.ts`                     | Mobile integration fallback tests                         |

---

### Task 1: Shared `PriceSnapshot` type + Drizzle `price_cache` table

**Files:**

- Modify: `lib/types.ts`
- Modify: `drizzle/schema.ts`
- Test: `drizzle/0002_*.sql` (generated)

- [ ] **Step 1: Add `PriceSnapshot` to `lib/types.ts`**

Add after the `StockStatus` type (top of file, after line 4):

```ts
export interface PriceSnapshot {
  price: number;
  currency: string;
  stockStatus: StockStatus;
  expectedDate?: string;
  url: string;
  taxRate?: number;
  fetchedAt: number;
}
```

- [ ] **Step 2: Add `price_cache` table to `drizzle/schema.ts`**

Add at the end of the file (after `InsertAppSettingsRow`):

```ts
export const priceCache = mysqlTable(
  "price_cache",
  {
    distributorId: varchar("distributorId", { length: 64 }).notNull(),
    modelNumber: varchar("modelNumber", { length: 128 }).notNull(),
    price: double("price").notNull(),
    currency: varchar("currency", { length: 8 }).notNull(),
    stockStatus: varchar("stockStatus", { length: 16 }).notNull(),
    expectedDate: varchar("expectedDate", { length: 64 }),
    url: text("url").notNull(),
    taxRate: double("taxRate"),
    fetchedAt: bigint("fetchedAt", { mode: "number" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.distributorId, table.modelNumber] }),
  ],
);

export type PriceCacheRow = typeof priceCache.$inferSelect;
export type InsertPriceCacheRow = typeof priceCache.$inferInsert;
```

Add `double` to the drizzle-orm/mysql-core import at the top of the file (line 1-11):

```ts
import {
  bigint,
  double,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
```

> **Deviation from spec (approved):** the spec listed `decimal(12,2)` for `price`/`taxRate`. Drizzle's MySQL `decimal` maps to `string` in TS, which would force conversions everywhere. `double` maps to `number`, keeping the row type aligned with `PriceSnapshot`. Prices in a cache don't need exact decimal semantics.

- [ ] **Step 3: Generate the migration**

Run:

```bash
DATABASE_URL="mysql://localhost:3306/product_stock_finder" pnpm exec drizzle-kit generate
```

Expected: writes `drizzle/0002_*.sql` containing `CREATE TABLE \`price_cache\``with a composite primary key on`distributorId`+`modelNumber`. (This command only reads `drizzle/schema.ts` and writes SQL — it does not connect to a live DB.)

- [ ] **Step 4: Verify types**

Run: `pnpm check`
Expected: PASS (0 errors).

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts drizzle/schema.ts drizzle/0002_*.sql
git commit -m "feat(sync): add price_cache table and PriceSnapshot type"
```

---

### Task 2: Cache backend — `server/price-cache.ts`

**Files:**

- Create: `server/price-cache.ts`
- Test: `tests/price-cache.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/price-cache.test.ts`:

```ts
import { describe, expect, it, beforeEach } from "vitest";
import {
  getCachedPrice,
  setCachedPrice,
  listNearExpiry,
  clearPriceCacheForTests,
} from "../server/price-cache";
import type { PriceSnapshot } from "../lib/types";

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

describe("price cache (memory backend)", () => {
  beforeEach(() => clearPriceCacheForTests());

  it("returns null for a missing key", async () => {
    expect(await getCachedPrice("server2u-my", "CRS804")).toBeNull();
  });

  it("stores and retrieves a snapshot", async () => {
    const snap = snapshot({ price: 123.45, fetchedAt: 5000 });
    await setCachedPrice("server2u-my", "CRS804", snap);
    const got = await getCachedPrice("server2u-my", "CRS804");
    expect(got).toEqual(snap);
  });

  it("keeps keys distinct by distributor and model", async () => {
    await setCachedPrice("server2u-my", "CRS804", snapshot({ price: 1 }));
    await setCachedPrice("linitx-uk", "CRS804", snapshot({ price: 2 }));
    await setCachedPrice("server2u-my", "CRS326", snapshot({ price: 3 }));
    expect((await getCachedPrice("server2u-my", "CRS804"))?.price).toBe(1);
    expect((await getCachedPrice("linitx-uk", "CRS804"))?.price).toBe(2);
    expect((await getCachedPrice("server2u-my", "CRS326"))?.price).toBe(3);
  });

  it("overwrites an existing entry on set", async () => {
    await setCachedPrice("server2u-my", "CRS804", snapshot({ price: 1 }));
    await setCachedPrice("server2u-my", "CRS804", snapshot({ price: 2 }));
    expect((await getCachedPrice("server2u-my", "CRS804"))?.price).toBe(2);
  });

  it("listNearExpiry returns only entries older than the cutoff", async () => {
    const now = 10_000;
    await setCachedPrice("a", "m1", snapshot({ fetchedAt: now - 1000 }));
    await setCachedPrice("a", "m2", snapshot({ fetchedAt: now - 5000 }));
    await setCachedPrice("b", "m1", snapshot({ fetchedAt: now - 100 }));
    const entries = await listNearExpiry(now, 2000);
    expect(entries).toContainEqual({ distributorId: "a", modelNumber: "m2" });
    expect(entries).not.toContainEqual({
      distributorId: "a",
      modelNumber: "m1",
    });
    expect(entries).not.toContainEqual({
      distributorId: "b",
      modelNumber: "m1",
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run tests/price-cache.test.ts`
Expected: FAIL with "Cannot find module '../server/price-cache'".

- [ ] **Step 3: Write `server/price-cache.ts`**

```ts
import { and, eq, lt } from "drizzle-orm";
import { priceCache, type PriceCacheRow } from "../drizzle/schema";
import { getDb } from "./db";
import type { PriceSnapshot, StockStatus } from "../lib/types";

const memoryCache = new Map<string, PriceSnapshot>();

function cacheKey(distributorId: string, modelNumber: string): string {
  return `${distributorId}:${modelNumber}`;
}

export async function getCachedPrice(
  distributorId: string,
  modelNumber: string,
): Promise<PriceSnapshot | null> {
  const db = await getDb();
  if (!db) {
    return memoryCache.get(cacheKey(distributorId, modelNumber)) ?? null;
  }
  const rows = await db
    .select()
    .from(priceCache)
    .where(
      and(
        eq(priceCache.distributorId, distributorId),
        eq(priceCache.modelNumber, modelNumber),
      ),
    )
    .limit(1);
  return rows.length > 0 ? rowToSnapshot(rows[0]) : null;
}

export async function setCachedPrice(
  distributorId: string,
  modelNumber: string,
  snapshot: PriceSnapshot,
): Promise<void> {
  const db = await getDb();
  if (!db) {
    memoryCache.set(cacheKey(distributorId, modelNumber), snapshot);
    return;
  }
  const values = {
    distributorId,
    modelNumber,
    price: snapshot.price,
    currency: snapshot.currency,
    stockStatus: snapshot.stockStatus,
    expectedDate: snapshot.expectedDate ?? null,
    url: snapshot.url,
    taxRate: snapshot.taxRate ?? null,
    fetchedAt: snapshot.fetchedAt,
  };
  await db
    .insert(priceCache)
    .values(values)
    .onDuplicateKeyUpdate({
      set: {
        price: snapshot.price,
        currency: snapshot.currency,
        stockStatus: snapshot.stockStatus,
        expectedDate: snapshot.expectedDate ?? null,
        url: snapshot.url,
        taxRate: snapshot.taxRate ?? null,
        fetchedAt: snapshot.fetchedAt,
      },
    });
}

export async function listNearExpiry(
  now: number,
  thresholdMs: number,
): Promise<Array<{ distributorId: string; modelNumber: string }>> {
  const cutoff = now - thresholdMs;
  const db = await getDb();
  if (!db) {
    const entries: Array<{ distributorId: string; modelNumber: string }> = [];
    for (const [key, snap] of memoryCache) {
      if (snap.fetchedAt < cutoff) {
        const [distributorId, modelNumber] = key.split(":");
        entries.push({ distributorId, modelNumber });
      }
    }
    return entries;
  }
  const rows = await db
    .select({
      distributorId: priceCache.distributorId,
      modelNumber: priceCache.modelNumber,
    })
    .from(priceCache)
    .where(lt(priceCache.fetchedAt, cutoff));
  return rows;
}

export function clearPriceCacheForTests(): void {
  memoryCache.clear();
}

function rowToSnapshot(row: PriceCacheRow): PriceSnapshot {
  return {
    price: row.price,
    currency: row.currency,
    stockStatus: row.stockStatus as StockStatus,
    expectedDate: row.expectedDate ?? undefined,
    url: row.url,
    taxRate: row.taxRate ?? undefined,
    fetchedAt: row.fetchedAt,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/price-cache.test.ts`
Expected: PASS (5 tests). Note: `getDb()` returns null without `DATABASE_URL`, so the memory backend is exercised.

- [ ] **Step 5: Verify types**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/price-cache.ts tests/price-cache.test.ts
git commit -m "feat(server): add price cache backend with memory fallback"
```

---

### Task 3: Price service — `server/prices.ts`

**Files:**

- Create: `server/prices.ts`
- Test: `tests/prices.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/prices.test.ts`:

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

import { getParserByDistributorId } from "../lib/scrapers/registry";
import { fetchWithParser } from "../lib/scrapers/utils";
import { getCachedPrice, setCachedPrice } from "../server/price-cache";
import { getPrice, PRICE_TTL_MS } from "../server/prices";
import type { ScrapeResult } from "../lib/scrapers/types";

const mockedGetParser = vi.mocked(getParserByDistributorId);
const mockedFetch = vi.mocked(fetchWithParser);
const mockedGetCached = vi.mocked(getCachedPrice);
const mockedSetCached = vi.mocked(setCachedPrice);

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
  });

  it("returns a fresh cached snapshot without scraping", async () => {
    mockedGetCached.mockResolvedValue(freshSnapshot);
    const result = await getPrice("server2u-my", "CRS804");
    expect(result).toEqual(freshSnapshot);
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
    expect(result).toEqual(stale);

    await vi.waitFor(() => expect(mockedFetch).toHaveBeenCalled());
    expect(mockedSetCached).toHaveBeenCalled();
  });

  it("returns null on a miss and triggers a background refresh", async () => {
    mockedGetCached.mockResolvedValue(null);
    mockedFetch.mockResolvedValue("<html>price</html>");
    parser.parsePrice = () => scrapeResult;
    mockedSetCached.mockResolvedValue(undefined);

    const result = await getPrice("server2u-my", "CRS804");
    expect(result).toBeNull();

    await vi.waitFor(() => expect(mockedFetch).toHaveBeenCalled());
    expect(mockedSetCached).toHaveBeenCalled();
  });

  it("does not throw when the refresh scrape fails", async () => {
    mockedGetCached.mockResolvedValue(null);
    mockedFetch.mockRejectedValue(new Error("network down"));
    const result = await getPrice("server2u-my", "CRS804");
    expect(result).toBeNull();
    await vi.waitFor(() => expect(mockedFetch).toHaveBeenCalled());
    expect(mockedSetCached).not.toHaveBeenCalled();
  });

  it("returns null when no parser exists for the distributor", async () => {
    mockedGetCached.mockResolvedValue(null);
    mockedGetParser.mockReturnValue(undefined);
    const result = await getPrice("unknown-dist", "CRS804");
    expect(result).toBeNull();
    expect(mockedFetch).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run tests/prices.test.ts`
Expected: FAIL with "Cannot find module '../server/prices'".

- [ ] **Step 3: Write `server/prices.ts`**

```ts
import { getParserByDistributorId } from "../lib/scrapers/registry";
import { fetchWithParser } from "../lib/scrapers/utils";
import type { PriceSnapshot } from "../lib/types";
import { getCachedPrice, setCachedPrice, listNearExpiry } from "./price-cache";

export const PRICE_TTL_MS = 60 * 60 * 1000; // 1 hour
const WARMER_INTERVAL_MS = 5 * 60 * 1000; // every 5 min
const WARMER_LEAD_MS = 10 * 60 * 1000; // refresh 10 min before expiry

const inFlight = new Map<string, Promise<PriceSnapshot | null>>();

function cacheKey(distributorId: string, modelNumber: string): string {
  return `${distributorId}:${modelNumber}`;
}

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
    return snapshot;
  } catch (error) {
    console.warn(
      `[Prices] Scrape failed for ${distributorId}/${modelNumber}:`,
      error,
    );
    return null;
  }
}

function refreshSingleFlight(
  distributorId: string,
  modelNumber: string,
): Promise<PriceSnapshot | null> {
  const key = cacheKey(distributorId, modelNumber);
  const existing = inFlight.get(key);
  if (existing) return existing;
  const promise = refreshPrice(distributorId, modelNumber).finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}

export async function getPrice(
  distributorId: string,
  modelNumber: string,
): Promise<PriceSnapshot | null> {
  const cached = await getCachedPrice(distributorId, modelNumber);
  const fresh = cached !== null && Date.now() - cached.fetchedAt < PRICE_TTL_MS;
  if (!fresh) {
    void refreshSingleFlight(distributorId, modelNumber);
  }
  return cached;
}

export async function refreshNearExpiry(now: number): Promise<void> {
  const entries = await listNearExpiry(now, PRICE_TTL_MS - WARMER_LEAD_MS);
  for (const entry of entries) {
    await refreshSingleFlight(entry.distributorId, entry.modelNumber);
  }
}

let warmerTimer: ReturnType<typeof setInterval> | null = null;

export function startWarmer(opts?: { intervalMs?: number }): () => void {
  const intervalMs = opts?.intervalMs ?? WARMER_INTERVAL_MS;
  if (process.env.NODE_ENV === "test") return () => {};
  if (warmerTimer) return () => {};
  warmerTimer = setInterval(() => {
    void refreshNearExpiry(Date.now());
  }, intervalMs);
  return () => {
    if (warmerTimer) clearInterval(warmerTimer);
    warmerTimer = null;
  };
}

startWarmer();
```

> **Note:** the module-level `startWarmer()` call starts the warmer when `server/routers.ts` imports this module at server boot. In vitest `NODE_ENV === "test"`, so it returns a no-op and no interval is created during tests.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/prices.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Verify types**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/prices.ts tests/prices.test.ts
git commit -m "feat(server): add price service with single-flight refresh"
```

---

### Task 4: Warmer tests

**Files:**

- Test: `tests/warmer.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/warmer.test.ts`:

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

import { getParserByDistributorId } from "../lib/scrapers/registry";
import { fetchWithParser } from "../lib/scrapers/utils";
import { listNearExpiry, setCachedPrice } from "../server/price-cache";
import { refreshNearExpiry, startWarmer } from "../server/prices";
import type { ScrapeResult } from "../lib/scrapers/types";

const mockedGetParser = vi.mocked(getParserByDistributorId);
const mockedFetch = vi.mocked(fetchWithParser);
const mockedListNearExpiry = vi.mocked(listNearExpiry);
const mockedSetCached = vi.mocked(setCachedPrice);

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

describe("warmer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetParser.mockReturnValue(parser);
    parser.parsePrice = () => scrapeResult;
    mockedFetch.mockResolvedValue("<html>price</html>");
    mockedSetCached.mockResolvedValue(undefined);
  });

  it("refreshNearExpiry refreshes near-expiry entries", async () => {
    mockedListNearExpiry.mockResolvedValue([
      { distributorId: "server2u-my", modelNumber: "CRS804" },
    ]);
    await refreshNearExpiry(Date.now());
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(mockedSetCached).toHaveBeenCalledTimes(1);
  });

  it("refreshNearExpiry skips when there are no near-expiry entries", async () => {
    mockedListNearExpiry.mockResolvedValue([]);
    await refreshNearExpiry(Date.now());
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("refreshNearExpiry refreshes multiple entries sequentially", async () => {
    mockedListNearExpiry.mockResolvedValue([
      { distributorId: "a", modelNumber: "m1" },
      { distributorId: "b", modelNumber: "m2" },
    ]);
    await refreshNearExpiry(Date.now());
    expect(mockedFetch).toHaveBeenCalledTimes(2);
  });

  it("startWarmer returns a no-op stop function in test env", () => {
    const stop = startWarmer({ intervalMs: 10 });
    expect(typeof stop).toBe("function");
    stop();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run tests/warmer.test.ts`
Expected: FAIL with "Cannot find module '../server/prices'" (until Task 3 is committed) or "refreshNearExpiry is not exported".

- [ ] **Step 3: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/warmer.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 4: Verify types**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/warmer.test.ts
git commit -m "test(server): add warmer tests"
```

---

### Task 5: tRPC router — `prices.get`

**Files:**

- Modify: `server/routers.ts`
- Test: `tests/prices-router.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/prices-router.test.ts`:

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

import { getPrice } from "../server/prices";
const mockedGetPrice = vi.mocked(getPrice);

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

  it("returns the price snapshot for a distributor and model", async () => {
    mockedGetPrice.mockResolvedValue(snapshot);
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.prices.get({
      distributorId: "server2u-my",
      modelNumber: "CRS804",
    });
    expect(result).toEqual(snapshot);
    expect(mockedGetPrice).toHaveBeenCalledWith("server2u-my", "CRS804");
  });

  it("returns null when there is no cached price", async () => {
    mockedGetPrice.mockResolvedValue(null);
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.prices.get({
      distributorId: "server2u-my",
      modelNumber: "CRS804",
    });
    expect(result).toBeNull();
  });

  it("works without authentication (public procedure)", async () => {
    mockedGetPrice.mockResolvedValue(snapshot);
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.prices.get({ distributorId: "a", modelNumber: "b" }),
    ).resolves.toEqual(snapshot);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run tests/prices-router.test.ts`
Expected: FAIL with "caller.prices is undefined" (router not yet added).

- [ ] **Step 3: Add the `prices` router to `server/routers.ts`**

Add `getPrice` to the imports (after the `sync-db` import):

```ts
import { getPrice } from "./prices";
```

Add the `prices` router to `appRouter` (after the `sync` router block, before the closing `});`):

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

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/prices-router.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Verify types + full test suite**

Run: `pnpm check`
Expected: PASS.

Run: `pnpm exec vitest run tests/prices-router.test.ts tests/sync-router.test.ts`
Expected: both PASS (the sync router tests still pass with the new router mounted).

- [ ] **Step 6: Commit**

```bash
git add server/routers.ts tests/prices-router.test.ts
git commit -m "feat(server): add public prices.get tRPC endpoint"
```

---

### Task 6: Mobile client helper — `lib/server-prices.ts`

**Files:**

- Create: `lib/server-prices.ts`
- Test: `tests/server-prices.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/server-prices.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { PriceSnapshot } from "../lib/types";

vi.mock("../lib/trpc", () => ({
  createTRPCClient: vi.fn(),
}));

import { createTRPCClient } from "../lib/trpc";
import { fetchServerPrice } from "../lib/server-prices";

const mockedCreateClient = vi.mocked(createTRPCClient);

const snapshot: PriceSnapshot = {
  price: 88.5,
  currency: "MYR",
  stockStatus: "in_stock",
  url: "https://server2u.com/p/1",
  fetchedAt: 1000,
};

function mockClientQuery(query: vi.Mock) {
  mockedCreateClient.mockReturnValue({
    prices: { get: { query } },
  } as unknown as ReturnType<typeof createTRPCClient>);
}

describe("fetchServerPrice", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the snapshot from the server", async () => {
    const query = vi.fn().mockResolvedValue(snapshot);
    mockClientQuery(query);
    const result = await fetchServerPrice("server2u-my", "CRS804");
    expect(result).toEqual(snapshot);
    expect(query).toHaveBeenCalledWith({
      distributorId: "server2u-my",
      modelNumber: "CRS804",
    });
  });

  it("returns null when the server returns null", async () => {
    const query = vi.fn().mockResolvedValue(null);
    mockClientQuery(query);
    expect(await fetchServerPrice("server2u-my", "CRS804")).toBeNull();
  });

  it("returns null when the query rejects", async () => {
    const query = vi.fn().mockRejectedValue(new Error("network"));
    mockClientQuery(query);
    expect(await fetchServerPrice("server2u-my", "CRS804")).toBeNull();
  });

  it("returns null when the query times out", async () => {
    const query = vi
      .fn()
      .mockImplementation(
        () =>
          new Promise<PriceSnapshot>((resolve) =>
            setTimeout(() => resolve(snapshot), 10_000),
          ),
      );
    mockClientQuery(query);
    const result = await fetchServerPrice("server2u-my", "CRS804");
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run tests/server-prices.test.ts`
Expected: FAIL with "Cannot find module '../lib/server-prices'".

- [ ] **Step 3: Write `lib/server-prices.ts`**

```ts
import { createTRPCClient } from "./trpc";
import type { PriceSnapshot } from "./types";

const TIMEOUT_MS = 4000;

let client: ReturnType<typeof createTRPCClient> | null = null;

function getClient() {
  if (!client) client = createTRPCClient();
  return client;
}

export async function fetchServerPrice(
  distributorId: string,
  modelNumber: string,
): Promise<PriceSnapshot | null> {
  try {
    const result = await Promise.race([
      getClient().prices.get.query({ distributorId, modelNumber }),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), TIMEOUT_MS),
      ),
    ]);
    return result;
  } catch {
    return null;
  }
}
```

> **Note:** a lazily-created module-level tRPC client is used (not the React `trpc` wrapper) because `fetchServerPrice` runs from the background task, outside React.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/server-prices.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Verify types**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/server-prices.ts tests/server-prices.test.ts
git commit -m "feat(mobile): add fetchServerPrice client helper"
```

---

### Task 7: Mobile integration — server-first with local fallback

**Files:**

- Modify: `lib/background-price-check.ts`
- Test: `tests/server-first-scrape.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/server-first-scrape.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Product, DistributorListing } from "../lib/types";

const state = vi.hoisted(() => ({
  watchlistStore: [] as Product[],
  updatedListings: [] as DistributorListing[][],
}));

vi.mock("../lib/storage", () => ({
  getWatchlist: vi.fn(async () => state.watchlistStore),
  updateProductListings: vi.fn(
    async (productId: string, listings: DistributorListing[]) => {
      state.updatedListings.push(listings);
    },
  ),
  getSettings: vi.fn(async () => ({
    theme: "auto",
    displayCurrency: "USD",
    checkInterval: "manual",
    notificationsEnabled: false,
    priceAlerts: false,
    stockAlerts: false,
  })),
  getAlerts: vi.fn(async () => []),
  getPriceDigestSnapshot: vi.fn(async () => null),
  savePriceDigestSnapshot: vi.fn(async () => {}),
}));

vi.mock("../lib/server-prices", () => ({
  fetchServerPrice: vi.fn(),
}));

vi.mock("../lib/scrapers/registry", () => ({
  getParserByDistributorId: vi.fn(),
}));

vi.mock("../lib/scrapers/utils", () => ({
  fetchWithParser: vi.fn(),
}));

vi.mock("../lib/scrapers/health", () => ({
  createHealthService: vi.fn(() => ({
    getDistributorHealth: vi.fn(async () => []),
    saveDistributorHealth: vi.fn(async () => {}),
  })),
}));

vi.mock("expo-task-manager", () => ({ defineTask: vi.fn() }));
vi.mock("expo-background-task", () => ({
  BackgroundTaskResult: { Success: "success" },
}));

import { fetchServerPrice } from "../lib/server-prices";
import { getParserByDistributorId } from "../lib/scrapers/registry";
import { fetchWithParser } from "../lib/scrapers/utils";
import { checkPriceDropsNow } from "../lib/background-price-check";

const mockedFetchServer = vi.mocked(fetchServerPrice);
const mockedGetParser = vi.mocked(getParserByDistributorId);
const mockedFetchLocal = vi.mocked(fetchWithParser);

const listing: DistributorListing = {
  distributorId: "server2u-my",
  productId: "crs804",
  price: 100,
  currency: "USD",
  stockStatus: "unknown",
  url: "https://example.com",
  lastChecked: "2026-01-01T00:00:00.000Z",
  priceHistory: [],
};

const product: Product = {
  id: "crs804",
  name: "CRS804",
  modelNumber: "CRS804",
  category: "Networking Switch",
  imageUrl: "",
  listings: [listing],
};

describe("server-first scraping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.watchlistStore = [product];
    state.updatedListings = [];
  });

  it("uses the server price when the server responds", async () => {
    mockedFetchServer.mockResolvedValue({
      price: 88.5,
      currency: "MYR",
      stockStatus: "in_stock",
      url: "https://server2u.com/p/1",
      fetchedAt: 1000,
    });

    await checkPriceDropsNow();

    expect(mockedFetchLocal).not.toHaveBeenCalled();
    expect(state.updatedListings).toHaveLength(1);
    const updated = state.updatedListings[0][0];
    expect(updated.price).toBe(88.5);
    expect(updated.currency).toBe("MYR");
    expect(updated.stockStatus).toBe("in_stock");
    expect(updated.priceHistory).toHaveLength(1);
  });

  it("falls back to local scraping when the server returns null", async () => {
    mockedFetchServer.mockResolvedValue(null);
    mockedGetParser.mockReturnValue({
      id: "server2u-my",
      baseUrl: "https://server2u.com",
      buildSearchUrl: (m: string) => `https://server2u.com/shop?q=${m}`,
      parsePrice: () => ({
        price: 77,
        currency: "MYR",
        stockStatus: "back_order",
        url: "https://server2u.com/p/2",
      }),
      rateLimitMs: 0,
    });
    mockedFetchLocal.mockResolvedValue("<html>price</html>");

    await checkPriceDropsNow();

    expect(mockedFetchLocal).toHaveBeenCalled();
    expect(state.updatedListings).toHaveLength(1);
    expect(state.updatedListings[0][0].price).toBe(77);
    expect(state.updatedListings[0][0].stockStatus).toBe("back_order");
  });

  it("keeps the listing unchanged when both server and local fail", async () => {
    mockedFetchServer.mockResolvedValue(null);
    mockedGetParser.mockReturnValue({
      id: "server2u-my",
      baseUrl: "https://server2u.com",
      buildSearchUrl: (m: string) => `https://server2u.com/shop?q=${m}`,
      parsePrice: () => null,
      rateLimitMs: 0,
    });
    mockedFetchLocal.mockResolvedValue("<html>no price</html>");

    await checkPriceDropsNow();

    expect(state.updatedListings).toHaveLength(1);
    expect(state.updatedListings[0][0]).toEqual(listing);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run tests/server-first-scrape.test.ts`
Expected: FAIL — the local scrape path runs unconditionally today, so the first test ("uses the server price") fails because `mockedFetchLocal` IS called.

- [ ] **Step 3: Refactor `lib/background-price-check.ts`**

Add the import (after the `fetchWithParser` import):

```ts
import { fetchServerPrice } from "./server-prices";
```

Add a shared helper function after `createHealthCollector` (after line ~54):

```ts
async function refreshListing(
  product: Product,
  listing: DistributorListing,
  healthCollector: ReturnType<typeof createHealthCollector>,
): Promise<DistributorListing> {
  const serverResult = await fetchServerPrice(
    listing.distributorId,
    product.modelNumber,
  );
  if (serverResult) {
    healthCollector.record(listing.distributorId, "working");
    const now = new Date().toISOString();
    const newPricePoint: PricePoint = {
      date: now,
      price: serverResult.price,
      currency: serverResult.currency,
      stockStatus: serverResult.stockStatus,
    };
    return {
      ...listing,
      price: serverResult.price,
      currency: serverResult.currency,
      stockStatus: serverResult.stockStatus,
      expectedDate: serverResult.expectedDate,
      url: serverResult.url,
      lastChecked: now,
      priceHistory: appendPricePoint(
        listing.priceHistory,
        newPricePoint,
        PRICE_HISTORY_DAYS,
      ),
    };
  }

  const parser = getParserByDistributorId(listing.distributorId);
  if (!parser) return listing;

  try {
    const url = parser.buildSearchUrl(product.modelNumber);
    const html = await fetchWithParser(parser, url);
    const result = parser.parsePrice(html);

    if (result) {
      healthCollector.record(parser.id, "working");
      const now = new Date().toISOString();
      const newPricePoint: PricePoint = {
        date: now,
        price: result.price,
        currency: result.currency,
        stockStatus: result.stockStatus,
      };
      return {
        ...listing,
        price: result.price,
        currency: result.currency,
        stockStatus: result.stockStatus,
        expectedDate: result.expectedDate,
        url: result.url,
        lastChecked: now,
        priceHistory: appendPricePoint(
          listing.priceHistory,
          newPricePoint,
          PRICE_HISTORY_DAYS,
        ),
      };
    }
    if (
      html.includes("403 Forbidden") ||
      html.includes("Access Denied") ||
      html.includes("cf-browser-verification") ||
      html.includes("Checking your browser")
    ) {
      healthCollector.record(parser.id, "blocked", "blocked by site");
      return listing;
    }
    healthCollector.record(parser.id, "error", "no price found");
    return listing;
  } catch (error) {
    healthCollector.record(
      parser.id,
      "error",
      error instanceof Error ? error.message : String(error),
    );
    return listing;
  }
}
```

**Replace the per-listing loop body in the background task** (lines ~75-136, inside `TaskManager.defineTask`). Replace the block from `const parser = getParserByDistributorId(listing.distributorId);` through the `catch` block with:

```ts
const updated = await refreshListing(product, listing, healthCollector);
updatedListings.push(updated);

// 2-second delay between scrapes
await new Promise((resolve) => setTimeout(resolve, 2000));
```

**Replace the per-listing loop body in `checkPriceDropsNow`** (lines ~270-320, the foreground path). Replace the block from `const parser = getParserByDistributorId(listing.distributorId);` through the `catch` block with:

```ts
const updated = await refreshListing(product, listing, healthCollector);
updatedListings.push(updated);

// 2-second delay between scrapes
await new Promise((resolve) => setTimeout(resolve, 2000));
```

> **Note:** both loops currently contain the same scraping logic (parser lookup → fetchWithParser → parsePrice → health record → build updated listing). The refactor extracts it into `refreshListing` and both call sites become identical. Read the current file carefully and replace the exact duplicated block in each loop — do not leave any leftover `parser`/`fetchWithParser` references in the loops.

- [ ] **Step 4: Run the new tests to verify they pass**

Run: `pnpm exec vitest run tests/server-first-scrape.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the existing price-check tests**

Run: `pnpm exec vitest run tests/price-check.test.ts`
Expected: PASS. If the existing test mocks don't stub `fetchServerPrice`, add a `vi.mock("../lib/server-prices", () => ({ fetchServerPrice: vi.fn(async () => null) }))` to `tests/price-check.test.ts` so the local path still runs.

- [ ] **Step 6: Verify types**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/background-price-check.ts tests/server-first-scrape.test.ts tests/price-check.test.ts
git commit -m "feat(mobile): try server prices first with local fallback"
```

---

### Task 8: Desktop integration — server-first in the Rust poller

**Files:**

- Modify: `desktop/src/background.ts`
- Modify: `desktop/src/App.tsx`
- Modify: `desktop/src/pages/Settings.tsx`
- Modify: `desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Update the JS poller wrapper to pass the API base URL**

In `desktop/src/background.ts`, change `startPricePoller`:

```ts
export async function startPricePoller(
  intervalMinutes: number = 15,
  apiBaseUrl: string = "",
): Promise<void> {
  try {
    await invoke("start_price_poller", { intervalMinutes, apiBaseUrl });
  } catch (e) {
    console.error("Failed to start price poller:", e);
  }
}
```

- [ ] **Step 2: Pass `getApiBaseUrl()` at the two call sites**

In `desktop/src/App.tsx`, add `getApiBaseUrl` to the existing `./lib/api-base` import (or add the import if not present):

```ts
import { getApiBaseUrl } from "./lib/api-base";
```

Change the call at line ~97:

```ts
await startPricePoller(intervalMinutes, getApiBaseUrl());
```

In `desktop/src/pages/Settings.tsx`, add the import:

```ts
import { getApiBaseUrl } from "../lib/api-base";
```

Change the call at line ~30:

```ts
startPricePoller(intervalMinutes, getApiBaseUrl());
```

- [ ] **Step 3: Update the Rust poller command signature**

In `desktop/src-tauri/src/lib.rs`, change `start_price_poller` (line ~277):

```rust
#[tauri::command]
async fn start_price_poller(app: tauri::AppHandle, interval_minutes: u64, api_base_url: String) -> Result<String, String> {
```

And pass it through to `run_full_price_check` (line ~297):

```rust
            let _ = run_full_price_check(handle.clone(), api_base_url.clone()).await;
```

- [ ] **Step 4: Add `fetch_server_price` + server-first in `check_all_prices`**

Add a helper near `scrape_distributor` (after line ~481):

```rust
async fn fetch_server_price(
    api_base_url: &str,
    distributor_id: &str,
    model: &str,
) -> Option<scrapers::ScrapeResult> {
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
    let price = data.get("price")?.as_f64()?;
    let currency = data.get("currency")?.as_str()?.to_string();
    let stock_status = data.get("stockStatus").and_then(|v| v.as_str()).unwrap_or("unknown").to_string();
    let expected_date = data.get("expectedDate").and_then(|v| v.as_str()).map(|s| s.to_string());
    let url = data.get("url").and_then(|v| v.as_str()).unwrap_or("").to_string();
    Some(scrapers::ScrapeResult {
        price,
        currency,
        stock_status,
        expected_date,
        url,
    })
}
```

Change `run_full_price_check` (line ~552) to accept and forward the API base URL:

```rust
async fn run_full_price_check(app: tauri::AppHandle, api_base_url: String) -> Result<String, String> {
```

And change the `check_all_prices` call (line ~593):

```rust
    let results = check_all_prices(products, api_base_url).await?;
```

Change `check_all_prices` (line ~421) to accept the URL and try the server first:

```rust
#[tauri::command]
async fn check_all_prices(products: Vec<WatchedProduct>, api_base_url: String) -> Result<Vec<scrapers::ScrapeJobResult>, String> {
    let mut results = Vec::new();
    let mut first = true;
    for product in products {
        for distributor_id in product.distributor_ids {
            if !first {
                tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
            }
            first = false;
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
        }
    }
    Ok(results)
}
```

> **Note:** `check_all_prices` is registered as a `#[tauri::command]` (line ~959). It is not called from JS today, so changing its signature is safe. If the JS side ever calls it, pass `getApiBaseUrl()` there too.

- [ ] **Step 5: Verify Rust compiles and tests pass**

Run: `cargo test` in `desktop/src-tauri`
Expected: PASS (existing tests compile and pass).

- [ ] **Step 6: Verify desktop typecheck + tests**

Run: `pnpm check:desktop`
Expected: PASS.

Run: `pnpm --filter desktop test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add desktop/src/background.ts desktop/src/App.tsx desktop/src/pages/Settings.tsx desktop/src-tauri/src/lib.rs
git commit -m "feat(desktop): try server prices first in the price poller"
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

Append a Phase 27 entry:

```markdown
## Phase 27: Server-Side Price Scraping

- [x] price_cache Drizzle table + PriceSnapshot shared type
- [x] Server price cache backend (DB table + in-memory fallback)
- [x] Server price service (getPrice, single-flight refresh, background warmer)
- [x] Public prices.get tRPC endpoint
- [x] Mobile fetchServerPrice helper + server-first background/foreground scraping
- [x] Desktop server-first price poller (Rust)
```

- [ ] **Step 3: Checkpoint commit**

```bash
git add -A
git commit -m "Checkpoint: v3.6: Server-side price scraping (shared cache, background warmer, public prices.get endpoint, mobile+desktop server-first). TypeScript: 0 errors."
```

Use the next version number per the repo's existing checkpoint history (current latest is v3.5).

---

## Self-Review Notes (from planning)

- **Spec coverage:** Every spec section maps to a task: price_cache table + PriceSnapshot (T1), cache backend (T2), price service + single-flight (T3), warmer (T4), tRPC endpoint (T5), mobile client helper (T6), mobile integration (T7), desktop integration (T8), verification (T9). Out-of-scope items (server-side history, full-catalog warming, multi-server coordination, Rust scraper rewrites) are untouched.
- **Deviation:** `double` instead of `decimal` for `price`/`taxRate` in the Drizzle table (documented in Task 1) — avoids string↔number conversion since Drizzle MySQL `decimal` maps to `string`.
- **Type consistency:** `PriceSnapshot` defined once in `lib/types.ts`, reused by `server/price-cache.ts`, `server/prices.ts`, `lib/server-prices.ts`, and the router. `getPrice(distributorId, modelNumber)` signature is consistent across the service, router, and client helper. `fetchServerPrice(distributorId, modelNumber)` matches.
- **Warmer start:** module-level `startWarmer()` in `server/prices.ts`; guarded by `NODE_ENV === "test"` so tests never spawn an interval. `server/routers.ts` imports `server/prices.ts`, so the warmer starts at server boot.
- **Mobile refactor risk:** Task 7 replaces duplicated per-listing scrape logic in two loops with a shared `refreshListing` helper. The existing `tests/price-check.test.ts` may need a `fetchServerPrice` stub added (noted in Task 7 Step 5).
- **Desktop signature change:** `check_all_prices` gains an `api_base_url` param; it is not called from JS today, so this is safe. `start_price_poller` gains `api_base_url`; both JS call sites are updated in Task 8.
