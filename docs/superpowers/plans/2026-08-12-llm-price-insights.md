# LLM Price Insights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public `insights.get` tRPC endpoint that generates a natural-language buying recommendation for a product from its server-side price history, current snapshot, distributor context, and landed-cost estimates, cached with a 24h TTL; display it on mobile and desktop product-detail screens.

**Architecture:** A new `server/price-insights.ts` builds a context payload from server-side history/snapshots (reconstructing synthetic listings since the server has no watchlist), calls the scaffolded `invokeLLM` from `server/_core/llm.ts`, and caches the result in a new `price_insights` Drizzle table (with in-memory Map fallback). `server/routers.ts` exposes `insights.get`. Mobile (`lib/server-insights.ts` + product detail) and desktop (Rust command + product detail) fetch and display it, hiding the card on null/error.

**Tech Stack:** Express + tRPC v11 + Drizzle (MySQL) + superjson; `server/_core/llm.ts` (invokeLLM); React Native (mobile); Tauri/Rust (desktop); vitest; cargo test.

---

## File Structure

| File                                  | Responsibility                                        |
| ------------------------------------- | ----------------------------------------------------- |
| `drizzle/schema.ts`                   | Add `price_insights` table + row types                |
| `drizzle/0004_*.sql`                  | Generated migration                                   |
| `server/price-insights.ts`            | Insight generation + TTL cache (DB + memory fallback) |
| `server/routers.ts`                   | Add `insights.get` public procedure                   |
| `lib/server-insights.ts`              | Mobile client helper `fetchPriceInsight`              |
| `app/product/[id].tsx`                | Display insight card                                  |
| `desktop/src-tauri/src/lib.rs`        | `fetch_price_insight` command                         |
| `desktop/src/pages/ProductDetail.tsx` | Display insight card                                  |
| `tests/price-insights.test.ts`        | Insight generation + cache tests                      |
| `tests/insights-router.test.ts`       | Router tests                                          |
| `tests/server-insights.test.ts`       | Mobile helper tests                                   |

---

### Task 1: `price_insights` Drizzle table + migration

**Files:**

- Modify: `drizzle/schema.ts`
- Test: `drizzle/0004_*.sql` (generated)

- [ ] **Step 1: Add `price_insights` table to `drizzle/schema.ts`**

Add at the end of the file (after `InsertPriceHistoryRow`, line ~130):

```ts
export const priceInsights = mysqlTable("price_insights", {
  productId: varchar("productId", { length: 128 }).notNull().primaryKey(),
  insight: text("insight").notNull(),
  generatedAt: bigint("generatedAt", { mode: "number" }).notNull(),
});

export type PriceInsightsRow = typeof priceInsights.$inferSelect;
export type InsertPriceInsightsRow = typeof priceInsights.$inferInsert;
```

No new imports needed — `varchar`, `text`, `bigint`, `mysqlTable` are all already imported.

- [ ] **Step 2: Generate the migration**

Run:

```bash
DATABASE_URL="mysql://localhost:3306/product_stock_finder" pnpm exec drizzle-kit generate
```

Expected: writes `drizzle/0004_*.sql` containing `CREATE TABLE \`price_insights\``with`productId`as primary key, plus updated`drizzle/meta/\_journal.json`and`drizzle/meta/0004_snapshot.json`. (This command only reads `drizzle/schema.ts` and writes SQL — it does not connect to a live DB.)

- [ ] **Step 3: Verify types**

Run: `pnpm check`
Expected: PASS (0 errors).

- [ ] **Step 4: Commit**

```bash
git add drizzle/schema.ts drizzle/0004_*.sql drizzle/meta/
git commit -m "feat(sync): add price_insights table"
```

---

### Task 2: Insight generation + cache — `server/price-insights.ts`

**Files:**

- Create: `server/price-insights.ts`
- Test: `tests/price-insights.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/price-insights.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { PriceSnapshot, PricePoint } from "../lib/types";

vi.mock("../server/price-cache", () => ({
  getCachedPrice: vi.fn(),
  setCachedPrice: vi.fn(),
  listNearExpiry: vi.fn(),
  getAllFetchedAt: vi.fn(),
  clearPriceCacheForTests: vi.fn(),
}));

vi.mock("../server/price-history", () => ({
  recordHistoryPoint: vi.fn(),
  getHistory: vi.fn(),
  mergeHistory: vi.fn(),
  purgeOldHistory: vi.fn(),
  clearHistoryForTests: vi.fn(),
}));

vi.mock("../server/_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

vi.mock("../lib/scrapers/registry", () => ({
  getParserByDistributorId: vi.fn(),
}));

import { getCachedPrice } from "../server/price-cache";
import { getHistory } from "../server/price-history";
import { invokeLLM } from "../server/_core/llm";
import { getParserByDistributorId } from "../lib/scrapers/registry";
import { getInsight, clearInsightsForTests } from "../server/price-insights";

const mockedGetCached = vi.mocked(getCachedPrice);
const mockedGetHistory = vi.mocked(getHistory);
const mockedInvokeLLM = vi.mocked(invokeLLM);
const mockedGetParser = vi.mocked(getParserByDistributorId);

const snapshot: PriceSnapshot = {
  price: 88.5,
  currency: "MYR",
  stockStatus: "in_stock",
  url: "https://server2u.com/p/1",
  fetchedAt: Date.parse("2026-08-12T00:00:00Z"),
};

const history: PricePoint[] = [
  {
    date: "2026-07-01T00:00:00.000Z",
    price: 95,
    currency: "MYR",
    stockStatus: "in_stock",
  },
  {
    date: "2026-08-01T00:00:00.000Z",
    price: 88.5,
    currency: "MYR",
    stockStatus: "in_stock",
  },
];

describe("getInsight", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearInsightsForTests();
    mockedGetCached.mockResolvedValue(snapshot);
    mockedGetHistory.mockResolvedValue(history);
    mockedGetParser.mockReturnValue({
      id: "server2u-my",
      baseUrl: "https://server2u.com",
      buildSearchUrl: (m: string) => `https://server2u.com/shop?q=${m}`,
      parsePrice: () => null,
      rateLimitMs: 0,
    });
    mockedInvokeLLM.mockResolvedValue({
      id: "x",
      created: 1,
      model: "m",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: "Price is down 7% over 30 days.",
          },
          finish_reason: "stop",
        },
      ],
    });
  });

  it("generates and caches an insight on first call", async () => {
    const result = await getInsight("mikrotik-crs804-4ddq-hrm");
    expect(result).not.toBeNull();
    expect(result!.insight).toContain("Price is down 7%");
    expect(mockedInvokeLLM).toHaveBeenCalledTimes(1);
  });

  it("returns the cached insight on a second call without calling the LLM again", async () => {
    await getInsight("mikrotik-crs804-4ddq-hrm");
    const second = await getInsight("mikrotik-crs804-4ddq-hrm");
    expect(second).not.toBeNull();
    expect(mockedInvokeLLM).toHaveBeenCalledTimes(1);
  });

  it("returns null when the product is not in the catalog", async () => {
    const result = await getInsight("unknown-product");
    expect(result).toBeNull();
    expect(mockedInvokeLLM).not.toHaveBeenCalled();
  });

  it("returns null when the LLM call fails", async () => {
    mockedInvokeLLM.mockRejectedValue(new Error("llm down"));
    const result = await getInsight("mikrotik-crs804-4ddq-hrm");
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run tests/price-insights.test.ts`
Expected: FAIL with "Cannot find module '../server/price-insights'".

- [ ] **Step 3: Write `server/price-insights.ts`**

Create `server/price-insights.ts`:

```ts
import { eq } from "drizzle-orm";
import { priceInsights, type PriceInsightsRow } from "../drizzle/schema";
import { PRODUCT_CATALOG } from "../lib/catalog";
import { getDistributorById } from "../lib/distributors";
import { getAllParserIds } from "../lib/scrapers/registry";
import { getCachedPrice } from "./price-cache";
import { getHistory } from "./price-history";
import { getDb } from "./db";
import { invokeLLM } from "./_core/llm";
import type { DistributorListing } from "../lib/types";

export const INSIGHT_TTL_MS = 24 * 60 * 60 * 1000;

const memoryInsights = new Map<
  string,
  { insight: string; generatedAt: number }
>();

export interface PriceInsight {
  insight: string;
  generatedAt: number;
}

export async function getInsight(
  productId: string,
): Promise<PriceInsight | null> {
  const cached = await readCached(productId);
  if (cached && Date.now() - cached.generatedAt < INSIGHT_TTL_MS) {
    return cached;
  }
  const context = await buildInsightContext(productId);
  if (!context) return null;
  const text = await generateInsight(context);
  if (!text) return null;
  const result: PriceInsight = { insight: text, generatedAt: Date.now() };
  await writeCached(productId, result);
  return result;
}

async function readCached(productId: string): Promise<PriceInsight | null> {
  const db = await getDb();
  if (!db) {
    return memoryInsights.get(productId) ?? null;
  }
  const rows = await db
    .select()
    .from(priceInsights)
    .where(eq(priceInsights.productId, productId))
    .limit(1);
  return rows.length > 0 ? rowToInsight(rows[0]) : null;
}

async function writeCached(
  productId: string,
  insight: PriceInsight,
): Promise<void> {
  const db = await getDb();
  if (!db) {
    memoryInsights.set(productId, insight);
    return;
  }
  await db
    .insert(priceInsights)
    .values({
      productId,
      insight: insight.insight,
      generatedAt: insight.generatedAt,
    })
    .onDuplicateKeyUpdate({
      set: { insight: insight.insight, generatedAt: insight.generatedAt },
    });
}

async function buildInsightContext(
  productId: string,
): Promise<Record<string, unknown> | null> {
  const product = PRODUCT_CATALOG.find((p) => p.id === productId);
  if (!product) return null;

  const listings: DistributorListing[] = [];
  for (const distributorId of getAllParserIds()) {
    const history = await getHistory(distributorId, product.modelNumber);
    const snapshot = await getCachedPrice(distributorId, product.modelNumber);
    if (!history.length && !snapshot) continue;
    const latest = history[history.length - 1];
    listings.push({
      distributorId,
      productId,
      price: snapshot?.price ?? latest?.price ?? 0,
      currency: snapshot?.currency ?? latest?.currency ?? "USD",
      stockStatus: snapshot?.stockStatus ?? latest?.stockStatus ?? "unknown",
      url: snapshot?.url ?? "",
      lastChecked: new Date(snapshot?.fetchedAt ?? Date.now()).toISOString(),
      priceHistory: history,
    });
  }
  if (listings.length === 0) return null;

  return {
    productName: product.name,
    modelNumber: product.modelNumber,
    listings: listings.map((l) => ({
      distributorId: l.distributorId,
      distributorName:
        getDistributorById(l.distributorId)?.name ?? l.distributorId,
      region: getDistributorById(l.distributorId)?.region ?? "",
      price: l.price,
      currency: l.currency,
      stockStatus: l.stockStatus,
      history: l.priceHistory,
    })),
  };
}

async function generateInsight(
  context: Record<string, unknown>,
): Promise<string | null> {
  try {
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are a price-analysis assistant for a networking gear stock finder. " +
            "Given a product's price history across distributors, write a short (1-3 sentence), " +
            "factual buying recommendation. Mention price trend (up/down/stable and rough %), " +
            "whether it's a good time to buy, and which distributor/region is cheapest if known. " +
            "Do not invent numbers not present in the data.",
        },
        {
          role: "user",
          content: JSON.stringify(context),
        },
      ],
      maxTokens: 200,
    });
    const content = result.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.trim().length === 0) return null;
    return content.trim();
  } catch {
    return null;
  }
}

export function clearInsightsForTests(): void {
  memoryInsights.clear();
}

function rowToInsight(row: PriceInsightsRow): PriceInsight {
  return { insight: row.insight, generatedAt: row.generatedAt };
}
```

> **Note:** `buildInsightContext` reconstructs synthetic `DistributorListing`s from server-side history + snapshots because the server has no watchlist (listings live in the app's AsyncStorage). It uses `getAllParserIds()` from `lib/scrapers/registry` to enumerate distributors, then filters by whether the distributor has any history/snapshot. There is no circular dependency — `lib/scrapers/registry` imports parser modules, none of which import `server/price-insights`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/price-insights.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Verify types**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/price-insights.ts tests/price-insights.test.ts
git commit -m "feat(server): add LLM price insight generation with TTL cache"
```

---

### Task 3: Router — `insights.get`

**Files:**

- Modify: `server/routers.ts`
- Test: `tests/insights-router.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/insights-router.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

vi.mock("../server/price-insights", () => ({
  getInsight: vi.fn(),
  clearInsightsForTests: vi.fn(),
}));

import { getInsight } from "../server/price-insights";
const mockedGetInsight = vi.mocked(getInsight);

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

describe("insights router", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the price insight for a product", async () => {
    mockedGetInsight.mockResolvedValue({
      insight: "Price is down 7% over 30 days.",
      generatedAt: 1000,
    });
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.insights.get({
      productId: "mikrotik-crs804-4ddq-hrm",
    });
    expect(result).toEqual({
      insight: "Price is down 7% over 30 days.",
      generatedAt: 1000,
    });
    expect(mockedGetInsight).toHaveBeenCalledWith("mikrotik-crs804-4ddq-hrm");
  });

  it("returns null when there is no insight", async () => {
    mockedGetInsight.mockResolvedValue(null);
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.insights.get({ productId: "unknown" });
    expect(result).toBeNull();
  });

  it("works without authentication (public procedure)", async () => {
    mockedGetInsight.mockResolvedValue({ insight: "x", generatedAt: 1 });
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.insights.get({ productId: "a" })).resolves.toEqual({
      insight: "x",
      generatedAt: 1,
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run tests/insights-router.test.ts`
Expected: FAIL with "caller.insights is undefined".

- [ ] **Step 3: Add the `insights` router to `server/routers.ts`**

Add the import (after the `mergeHistory` import, line 14):

```ts
import { getInsight } from "./price-insights";
```

Add the `insights` router to `appRouter` (after the `prices` router block, before the closing `});`):

```ts
  insights: router({
    get: publicProcedure
      .input(z.object({ productId: z.string().min(1) }))
      .query(async ({ input }) => {
        return getInsight(input.productId);
      }),
  }),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/insights-router.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Verify types + full test suite**

Run: `pnpm check`
Expected: PASS.

Run: `pnpm exec vitest run tests/insights-router.test.ts tests/prices-router.test.ts tests/sync-router.test.ts`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add server/routers.ts tests/insights-router.test.ts
git commit -m "feat(server): add public insights.get tRPC endpoint"
```

---

### Task 4: Mobile client helper — `lib/server-insights.ts`

**Files:**

- Create: `lib/server-insights.ts`
- Test: `tests/server-insights.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/server-insights.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("../lib/trpc", () => ({
  createTRPCClient: vi.fn(),
}));

import { createTRPCClient } from "../lib/trpc";
import { fetchPriceInsight } from "../lib/server-insights";

const mockedCreateClient = vi.mocked(createTRPCClient);

function mockClientQuery(query: Mock) {
  mockedCreateClient.mockReturnValue({
    insights: { get: { query } },
  } as unknown as ReturnType<typeof createTRPCClient>);
}

describe("fetchPriceInsight", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the insight from the server", async () => {
    const query = vi.fn().mockResolvedValue({
      insight: "Price is down 7% over 30 days.",
      generatedAt: 1000,
    });
    mockClientQuery(query);
    const result = await fetchPriceInsight("mikrotik-crs804-4ddq-hrm");
    expect(result).toEqual({
      insight: "Price is down 7% over 30 days.",
      generatedAt: 1000,
    });
    expect(query).toHaveBeenCalledWith({
      productId: "mikrotik-crs804-4ddq-hrm",
    });
  });

  it("returns null when the server returns null", async () => {
    const query = vi.fn().mockResolvedValue(null);
    mockClientQuery(query);
    expect(await fetchPriceInsight("x")).toBeNull();
  });

  it("returns null when the query rejects", async () => {
    const query = vi.fn().mockRejectedValue(new Error("network"));
    mockClientQuery(query);
    expect(await fetchPriceInsight("x")).toBeNull();
  });

  it("returns null when the query times out", async () => {
    const query = vi
      .fn()
      .mockImplementation(
        () =>
          new Promise<{ insight: string; generatedAt: number }>((resolve) =>
            setTimeout(() => resolve({ insight: "x", generatedAt: 1 }), 10_000),
          ),
      );
    mockClientQuery(query);
    expect(await fetchPriceInsight("x")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run tests/server-insights.test.ts`
Expected: FAIL with "Cannot find module '../lib/server-insights'".

- [ ] **Step 3: Write `lib/server-insights.ts`**

Create `lib/server-insights.ts`:

```ts
import { createTRPCClient } from "./trpc";

const TIMEOUT_MS = 4000;

export interface PriceInsight {
  insight: string;
  generatedAt: number;
}

export async function fetchPriceInsight(
  productId: string,
): Promise<PriceInsight | null> {
  try {
    const client = createTRPCClient();
    const result = await Promise.race([
      client.insights.get.query({ productId }),
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/server-insights.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Verify types**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/server-insights.ts tests/server-insights.test.ts
git commit -m "feat(mobile): add fetchPriceInsight client helper"
```

---

### Task 5: Mobile product detail — display insight card

**Files:**

- Modify: `app/product/[id].tsx`

- [ ] **Step 1: Add the import**

In `app/product/[id].tsx`, add the import (near the other `@/lib` imports):

```ts
import { fetchPriceInsight } from "@/lib/server-insights";
```

- [ ] **Step 2: Add insight state + fetch on load**

In the component, add state (near the other `useState` declarations, e.g. after `const [listings, setListings] = useState<DistributorListing[]>([]);` around line 391):

```ts
const [insight, setInsight] = useState<string | null>(null);
```

In the `loadData` callback (around line 422), after the existing listing-loading logic and before `setLoading(false)`, add a fire-and-forget insight fetch:

```ts
void fetchPriceInsight(id).then((res) => {
  if (res) setInsight(res.insight);
});
```

> **Note:** place this inside `loadData` so it runs once per product load. The `.then` swallows null (card stays hidden) and errors are already handled inside `fetchPriceInsight`.

- [ ] **Step 3: Render the insight card**

Find a suitable place in the JSX to render the card (e.g. near the best-distributor card). Add:

```tsx
{
  insight && (
    <View className="mt-3 rounded-2xl bg-surface p-4">
      <Text className="text-xs font-semibold uppercase tracking-wide text-muted">
        AI insight
      </Text>
      <Text className="mt-1 text-sm text-foreground">{insight}</Text>
    </View>
  );
}
```

> **Note:** match the existing styling conventions in the file (use `useColors()` theme tokens via inline styles if the file uses them, or NativeWind classes as shown). Place the card where it reads naturally on the product screen. If the file uses inline `style={{}}` for theme colors, mirror that instead of hardcoding classes.

- [ ] **Step 4: Verify types**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/product/[id].tsx
git commit -m "feat(mobile): show AI price insight on product detail"
```

---

### Task 6: Desktop — `fetch_price_insight` command + display

**Files:**

- Modify: `desktop/src-tauri/src/lib.rs`
- Modify: `desktop/src/pages/ProductDetail.tsx`

- [ ] **Step 1: Add the `fetch_price_insight` command in Rust**

In `desktop/src-tauri/src/lib.rs`, add a new command (near `fetch_server_price`, after line ~600):

```rust
#[tauri::command]
async fn fetch_price_insight(api_base_url: String, product_id: String) -> Result<Option<serde_json::Value>, String> {
    if api_base_url.is_empty() {
        return Ok(None);
    }
    let input = serde_json::json!({
        "json": { "productId": product_id }
    });
    let url = format!(
        "{}/api/trpc/insights.get?input={}",
        api_base_url.trim_end_matches('/'),
        urlencoding::encode(&input.to_string())
    );
    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .timeout(std::time::Duration::from_secs(8))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Ok(None);
    }
    let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let data = body.pointer("/result/data/json");
    match data {
        Some(v) if !v.is_null() => Ok(Some(v.clone())),
        _ => Ok(None),
    }
}
```

- [ ] **Step 2: Register the command**

Add `fetch_price_insight` to the `generate_handler!` list (after `backfill_local_history`):

```rust
            backfill_local_history,
            fetch_price_insight,
```

- [ ] **Step 3: Display the insight in `desktop/src/pages/ProductDetail.tsx`**

Add a state + fetch. In the component, add state (near the other `useState`):

```tsx
const [insight, setInsight] = useState<string | null>(null);
```

In the existing `useEffect` that loads the product (around line 92), after loading the product, add a fire-and-forget fetch. Add the import at the top:

```tsx
import { getApiBaseUrl } from "../lib/api-base";
```

And inside the effect (after the product is loaded), add:

```tsx
const base = getApiBaseUrl();
if (base) {
  const { invoke } = await import("@tauri-apps/api/core");
  invoke("fetch_price_insight", { apiBaseUrl: base, productId: id })
    .then((res: any) => {
      if (res && res.insight) setInsight(res.insight);
    })
    .catch(() => {});
}
```

Render the card in the JSX (near the best-listing card):

```tsx
{
  insight && (
    <div className="mt-3 rounded-2xl bg-surface p-4 dark:bg-surface-dark">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted dark:text-muted-dark">
        AI insight
      </p>
      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{insight}</p>
    </div>
  );
}
```

> **Note:** match the existing styling conventions in `ProductDetail.tsx` (it uses Tailwind classes with `dark:` variants). If the file uses a different card pattern, mirror it.

- [ ] **Step 4: Verify Rust compiles and tests pass**

Run: `cargo test` in `desktop/src-tauri`
Expected: PASS (existing tests compile and pass).

- [ ] **Step 5: Verify desktop typecheck + tests**

Run: `pnpm check:desktop`
Expected: PASS.

Run: `pnpm --filter desktop test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add desktop/src-tauri/src/lib.rs desktop/src/pages/ProductDetail.tsx
git commit -m "feat(desktop): show AI price insight on product detail"
```

---

### Task 7: Final verification + checkpoint commit

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

Append a Phase 30 entry after the Phase 29 block:

```markdown
## Phase 30: LLM Price Insights

- [x] price_insights Drizzle table + migration
- [x] Server insight generation + TTL cache (server/price-insights.ts)
- [x] Public insights.get tRPC endpoint
- [x] Mobile fetchPriceInsight helper + product detail card
- [x] Desktop fetch_price_insight command + product detail card
```

- [ ] **Step 3: Checkpoint commit**

```bash
git add -A
git commit -m "Checkpoint: v3.9: LLM price insights (server-generated buying recommendations from price history, cached 24h, shown on mobile + desktop product detail). TypeScript: 0 errors."
```

Use the next version number per the repo's existing checkpoint history (current latest is v3.8).

---

## Self-Review Notes (from planning)

- **Spec coverage:** Every spec section maps to a task: `price_insights` table (T1), insight generation + cache (T2), `insights.get` router (T3), mobile helper (T4), mobile product detail card (T5), desktop command + card (T6), verification (T7). Out-of-scope items (generic chat, image gen, voice, Data API, notifications, streaming, client-side LLM) are untouched.
- **Server has no watchlist:** `buildInsightContext` reconstructs synthetic `DistributorListing`s from server-side history + snapshots (via `getHistory` + `getCachedPrice`), enumerating distributors with `getAllParserIds()`. This is the key design constraint the spec flagged.
- **Type consistency:** `PriceInsight` defined in both `server/price-insights.ts` and `lib/server-insights.ts` (same shape `{ insight, generatedAt }`). `getInsight(productId)` signature consistent across the service, router, and client helper. `fetchPriceInsight(productId)` matches.
- **LLM result extraction:** `generateInsight` reads `result.choices[0].message.content` and returns null if it's not a non-empty string (handles LLM failure / empty response).
- **`getAllParserIds` import:** Task 2's `buildInsightContext` imports `getAllParserIds` from `lib/scrapers/registry` statically. There is no circular dependency (`lib/scrapers/registry` imports parser modules, none of which import `server/price-insights`).
- **Desktop command signature:** `fetch_price_insight(api_base_url, product_id)` — the JS side passes `apiBaseUrl` and `productId` (Tauri auto-converts camelCase JS args to snake_case Rust params).
