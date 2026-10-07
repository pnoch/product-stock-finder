# Available-Now Board — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A server-backed board of catalog products currently in stock somewhere, ranked by price, with a Home section and a standalone fallback.

**Architecture:** `listCachedInStock` reads the warmed price cache; a pure `groupAvailable` groups rows by model and ranks them; `catalog.available` exposes it; `app/available.tsx` renders it with filters; a Home section links to it.

**Tech Stack:** TypeScript, Drizzle, tRPC, React Native / Expo, vitest.

**Spec:** `docs/superpowers/specs/2026-10-06-available-now-board-design.md`

---

## File Structure

- Modify `server/price-cache.ts` — `listCachedInStock`.
- Create `server/available.ts` — pure `groupAvailable`.
- Create `server/routers/catalog.ts` — `catalog.available`.
- Modify `server/routers.ts` — register the router.
- Create `lib/server-catalog.ts` — `fetchAvailable`.
- Create `app/available.tsx` — the board screen.
- Create `components/home/available-section.tsx` — the Home section.
- Modify `app/(tabs)/index.tsx` — render the section.
- Tests: `tests/available-group.test.ts`, `tests/available-screen.test.tsx`.

---

### Task 1: Pure grouping — `server/available.ts`

**Files:** Create `server/available.ts`; Test `tests/available-group.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/available-group.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { groupAvailable } from "../server/available";

const catalog = [
  { id: "p1", name: "Switch A", brand: "MikroTik", category: "Networking Switch", modelNumber: "M1" },
  { id: "p2", name: "Switch B", brand: "Ubiquiti", category: "Networking Switch", modelNumber: "M2" },
  { id: "p3", name: "NAS C", brand: "Synology", category: "Storage", modelNumber: "M3" },
] as never;

function row(modelNumber: string, distributorId: string, price: number, stockStatus = "in_stock") {
  return { distributorId, modelNumber, price, currency: "USD", stockStatus, url: "", fetchedAt: 1000 } as never;
}

describe("groupAvailable", () => {
  it("keeps only models with an in-stock row", () => {
    const out = groupAvailable(
      [row("M1", "d1", 100), row("M2", "d1", 50, "out_of_stock")],
      catalog,
      "USD",
    );
    expect(out.map((r) => r.modelNumber)).toEqual(["M1"]);
  });

  it("picks the min price and counts distinct stores", () => {
    const out = groupAvailable(
      [row("M1", "d1", 120), row("M1", "d2", 100), row("M1", "d2", 110)],
      catalog,
      "USD",
    );
    expect(out[0]!.bestPrice).toBe(100);
    expect(out[0]!.storeCount).toBe(2);
    expect(out[0]!.bestDistributorId).toBe("d2");
  });

  it("sorts by best price ascending", () => {
    const out = groupAvailable([row("M1", "d1", 200), row("M3", "d1", 50)], catalog, "USD");
    expect(out.map((r) => r.modelNumber)).toEqual(["M3", "M1"]);
  });

  it("drops rows whose model is not in the catalog", () => {
    const out = groupAvailable([row("ZZZ", "d1", 1)], catalog, "USD");
    expect(out).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/available-group.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `server/available.ts`:

```ts
import { PRODUCT_CATALOG } from "../shared/src/catalog.js";
import { convertPrice } from "../shared/src/currency.js";

export interface AvailableProduct {
  id: string;
  name: string;
  brand: string;
  category: string;
  modelNumber: string;
  bestPrice: number;
  bestCurrency: string;
  bestDistributorId: string;
  storeCount: number;
  fetchedAt: number;
}

interface CacheRow {
  distributorId: string;
  modelNumber: string;
  price: number;
  currency: string;
  stockStatus: string;
  fetchedAt: number;
}

/**
 * Group in-stock cache rows by catalog model: keep models with ≥1 in-stock row,
 * pick the cheapest (converted to `currency`), count distinct in-stock stores,
 * and sort by best price ascending. Rows for unknown models are dropped.
 */
export function groupAvailable(
  rows: CacheRow[],
  catalog: typeof PRODUCT_CATALOG,
  currency: string,
): AvailableProduct[] {
  const byModel = new Map<string, CacheRow[]>();
  for (const row of rows) {
    if (row.stockStatus !== "in_stock") continue;
    const list = byModel.get(row.modelNumber) ?? [];
    list.push(row);
    byModel.set(row.modelNumber, list);
  }
  const out: AvailableProduct[] = [];
  for (const [modelNumber, modelRows] of byModel) {
    const product = catalog.find((p) => p.modelNumber === modelNumber);
    if (!product) continue;
    let best: { price: number; distributorId: string; fetchedAt: number } | null = null;
    const stores = new Set<string>();
    for (const row of modelRows) {
      const converted = convertPrice(row.price, row.currency, currency);
      if (converted === null) continue;
      stores.add(row.distributorId);
      if (!best || converted < best.price) {
        best = { price: converted, distributorId: row.distributorId, fetchedAt: row.fetchedAt };
      }
    }
    if (!best) continue;
    out.push({
      id: product.id,
      name: product.name,
      brand: product.brand,
      category: product.category,
      modelNumber,
      bestPrice: best.price,
      bestCurrency: currency,
      bestDistributorId: best.distributorId,
      storeCount: stores.size,
      fetchedAt: best.fetchedAt,
    });
  }
  return out.sort((a, b) => a.bestPrice - b.bestPrice);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/available-group.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add server/available.ts tests/available-group.test.ts
git commit -m "feat(available): group in-stock cache rows by model"
```

---

### Task 2: Cache query + endpoint

**Files:** Modify `server/price-cache.ts`; Create `server/routers/catalog.ts`; Modify `server/routers.ts`

- [ ] **Step 1: Add `listCachedInStock`**

In `server/price-cache.ts`:

```ts
export async function listCachedInStock(
  now: number,
  maxAgeMs: number,
): Promise<Array<PriceSnapshot & { distributorId: string; modelNumber: string }>> {
  const cutoff = now - maxAgeMs;
  const db = await getDb();
  if (!db) {
    const out: Array<PriceSnapshot & { distributorId: string; modelNumber: string }> = [];
    for (const entry of memoryCache.values()) {
      if (entry.snapshot.stockStatus === "in_stock" && entry.snapshot.fetchedAt >= cutoff) {
        out.push({ ...entry.snapshot, distributorId: entry.distributorId, modelNumber: entry.modelNumber });
      }
    }
    return out;
  }
  const rows = await db
    .select()
    .from(priceCache)
    .where(and(eq(priceCache.stockStatus, "in_stock"), gte(priceCache.fetchedAt, cutoff)));
  return rows.map((r) => ({ ...rowToSnapshot(r), distributorId: r.distributorId, modelNumber: r.modelNumber }));
}
```

(Ensure `gte` is imported from `drizzle-orm`.)

- [ ] **Step 2: Create the router**

Create `server/routers/catalog.ts`:

```ts
import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { PRICE_SNAPSHOT_TTL_MS } from "../../shared/const";
import { listCachedInStock } from "../price-cache";
import { groupAvailable } from "../available";

export const catalogRouter = router({
  available: publicProcedure
    .input(
      z
        .object({
          currency: z.string().max(8).default("USD"),
          category: z.string().max(64).optional(),
          brand: z.string().max(64).optional(),
          maxPrice: z.number().positive().optional(),
        })
        .default({ currency: "USD" }),
    )
    .query(async ({ input }) => {
      const rows = await listCachedInStock(Date.now(), PRICE_SNAPSHOT_TTL_MS);
      let out = groupAvailable(rows, PRODUCT_CATALOG, input.currency);
      if (input.category) out = out.filter((r) => r.category === input.category);
      if (input.brand) out = out.filter((r) => r.brand === input.brand);
      if (input.maxPrice != null) out = out.filter((r) => r.bestPrice <= input.maxPrice!);
      return out.slice(0, 100);
    }),
});
```

Import `PRODUCT_CATALOG` from `../../shared/src/catalog.js`.

- [ ] **Step 3: Register it**

In `server/routers.ts`, add `import { catalogRouter } from "./routers/catalog";` and `catalog: catalogRouter,` to the `appRouter` object.

- [ ] **Step 4: Verify**

Run: `pnpm check && pnpm exec vitest run tests/available-group.test.ts`
Expected: 0 type errors; PASS.

- [ ] **Step 5: Commit**

```bash
git add server/price-cache.ts server/routers/catalog.ts server/routers.ts
git commit -m "feat(available): catalog.available endpoint"
```

---

### Task 3: Client wrapper + board screen

**Files:** Create `lib/server-catalog.ts`, `app/available.tsx`; Test `tests/available-screen.test.tsx`

- [ ] **Step 1: Client wrapper**

Create `lib/server-catalog.ts`:

```ts
import { createTRPCClient } from "./trpc";
import { isServerConfigured } from "@/constants/oauth";
import type { AvailableProduct } from "../server/available";

export type { AvailableProduct };

export async function fetchAvailable(params: {
  currency?: string;
  category?: string;
  brand?: string;
  maxPrice?: number;
} = {}): Promise<AvailableProduct[]> {
  if (!isServerConfigured()) return [];
  try {
    const client = createTRPCClient();
    return (await client.catalog.available.query(params)) as AvailableProduct[];
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: Write the failing screen test**

Create `tests/available-screen.test.tsx` (mirror the jsdom harness in `tests/availability-card.test.tsx`; mock `react-native`, `@/hooks/use-colors`, `@/components/stock-badge`, `@/components/ui/icon-symbol`, `expo-router`, `@tanstack/react-query`'s `useQuery` to return fixed data, and `@/lib/server-catalog`):

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
    Pressable: ({ children, onPress, accessibilityLabel, ...r }: any) =>
      React.createElement("button", { ...r, "aria-label": accessibilityLabel, onClick: onPress }, children),
    TouchableOpacity: ({ children, onPress, accessibilityLabel, ...r }: any) =>
      React.createElement("button", { ...r, "aria-label": accessibilityLabel, onClick: onPress }, children),
    ScrollView: ({ children, ...r }: any) => React.createElement("div", r, children),
    Platform: { OS: "ios" },
  };
});
vi.mock("@/hooks/use-colors", () => ({
  useColors: () => ({ foreground: "#111", muted: "#888", primary: "#0F52BA", success: "#0a0", border: "#ddd", surface: "#fff" }),
}));
vi.mock("@/components/stock-badge", () => ({ StockBadge: () => null }));
vi.mock("@/components/ui/icon-symbol", () => ({ IconSymbol: () => null }));
vi.mock("expo-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: [{ id: "p1", name: "Switch A", brand: "MikroTik", category: "Networking Switch", modelNumber: "M1", bestPrice: 100, bestCurrency: "USD", bestDistributorId: "d1", storeCount: 2, fetchedAt: Date.now() }],
    isLoading: false,
  }),
}));

import AvailableScreen from "../app/available";

afterEach(cleanup);

describe("AvailableScreen", () => {
  it("renders an in-stock product with its price", () => {
    render(<AvailableScreen />);
    expect(screen.getByText(/Switch A/)).toBeTruthy();
    expect(screen.getByText(/100/)).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm exec vitest run tests/available-screen.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the screen**

Create `app/available.tsx`: a `useQuery({ queryKey: ["available"], queryFn: () => fetchAvailable() })`; filter chips for category/brand/price; a list of rows (name, `formatPrice(bestPrice, bestCurrency)`, `in stock at ${storeCount} stores`, tap → `router.push(\`/product/${id}\`)`); a loading skeleton; an empty state ("Nothing in stock right now — check back"). When `!isServerConfigured()`, render the watchlist fallback (in-stock watchlist products via `getBestPrice`) with a "Connect to see all 121 products" banner. Use `useColors()`, `IconSymbol`, `ScreenContainer`.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec vitest run tests/available-screen.test.tsx && pnpm check`
Expected: PASS (1 test); 0 type errors.

- [ ] **Step 6: Commit**

```bash
git add lib/server-catalog.ts app/available.tsx tests/available-screen.test.tsx
git commit -m "feat(available): board screen + client wrapper"
```

---

### Task 4: Home section + full verification + docs

**Files:** Create `components/home/available-section.tsx`; Modify `app/(tabs)/index.tsx`; `todo.md`

- [ ] **Step 1: Implement the Home section**

Create `components/home/available-section.tsx`: a `useQuery` over `fetchAvailable()`, rendering the top ~5 rows in a compact list with a header row ("Available Now" + a "See all" `Pressable` → `router.push("/available")`). Hide the whole section when the query returns `[]` (standalone or empty). Mirror `components/home/trending-section.tsx`'s structure and styling.

- [ ] **Step 2: Render it on Home**

In `app/(tabs)/index.tsx`, import and render `<AvailableSection />` above `<TrendingSection />` (line ~631).

- [ ] **Step 3: Verify it compiles**

Run: `pnpm check`
Expected: 0 type errors.

- [ ] **Step 4: Run the full gate**

Run: `pnpm verify`
Expected: exit 0.

- [ ] **Step 5: Document**

Add a `todo.md` phase entry (next number 1128): the board, the endpoint, the Home section, the standalone fallback, and the note that freshness is cache-cadence.

- [ ] **Step 6: Commit**

```bash
git add components/home/available-section.tsx app/\(tabs\)/index.tsx todo.md
git commit -m "feat(available): Home section + docs (Phase 1128)"
```

---

## Self-Review

- **Spec coverage:** grouping (Task 1), cache query + endpoint (Task 2), client wrapper + screen (Task 3), Home section + verify + docs (Task 4). Desktop parity is out of scope per the spec.
- **Placeholders:** none — the grouping logic, the endpoint, the wrapper, and the tests are given verbatim; the screen/section tasks name the exact files, data shape, and patterns.
- **Type consistency:** `AvailableProduct { id, name, brand, category, modelNumber, bestPrice, bestCurrency, bestDistributorId, storeCount, fetchedAt }`; `groupAvailable(rows, catalog, currency)`; `listCachedInStock(now, maxAgeMs)`; `fetchAvailable(params)`; `catalog.available` — used consistently.
- **Freshness:** `PRICE_SNAPSHOT_TTL_MS` from `shared/const.ts` is the window; the board shows `fetchedAt` as "as of X ago".
