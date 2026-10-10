# Price Drop Leaderboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a price drop leaderboard showing the biggest price drops across tracked products (local) and all products (server), with a Home preview and dedicated full screen on mobile, web, and desktop.

**Architecture:** Pure function `computeLocalDrops` computes drops from local watchlist price history. Server endpoint `prices.topDrops` queries the `priceHistory` DB table for global drops. Home section component shows top 5; full screen shows top 20 with time-range/ sort-by controls and Your/Global tabs.

**Tech Stack:** TypeScript, React Native (Expo), Tailwind/NativeWind, tRPC, Drizzle ORM, vitest, React (desktop), Tauri (desktop).

---

## File Structure

| File | Purpose |
|------|---------|
| Create `lib/price-leaderboard.ts` | `computeLocalDrops` pure function |
| Create `components/home/drop-leaderboard.tsx` | Home section (top 5 preview) |
| Create `app/drops.tsx` | Full screen route (top 20, Your/Global tabs) |
| Create `desktop/src/pages/Drops.tsx` | Desktop full screen |
| Create `desktop/src/components/DropLeaderboard.tsx` | Desktop Home section |
| Create `tests/price-leaderboard.test.ts` | Unit tests for `computeLocalDrops` |
| Create `tests/drops-wiring-guard.test.ts` | Wiring guard tests |
| Create `desktop/tests/drops-parity.test.tsx` | Desktop wiring guards |
| Modify `server/routers/prices.ts` | Add `topDrops` query |
| Modify `app/(tabs)/index.tsx` | Insert Home section |
| Modify `desktop/src/pages/Home.tsx` | Insert desktop Home section |
| Modify `desktop/src/components/Sidebar.tsx` | Add "Drops" nav entry |
| Modify `desktop/src/App.tsx` | Register `/drops` route |

---

### Task 1: Pure function — `computeLocalDrops`

**Files:** Create `lib/price-leaderboard.ts`, Create `tests/price-leaderboard.test.ts`

- [ ] **Step 1: Define the types and function signature**

Create `lib/price-leaderboard.ts`:

```typescript
import type { Product } from "@/lib/types";
import { convertPrice } from "@/lib/currency";

export interface PriceDrop {
  productId: string;
  productName: string;
  modelNumber: string;
  distributorId: string;
  distributorName: string;
  previousPrice: number;
  currentPrice: number;
  currency: string;
  dropPct: number;
  dropAbs: number;
  droppedAt: string;
}

export type DropWindow = "24h" | "7d" | "30d";
export type DropSortBy = "pct" | "abs";

function windowMs(window: DropWindow): number {
  switch (window) {
    case "24h": return 24 * 60 * 60 * 1000;
    case "7d":  return 7 * 24 * 60 * 60 * 1000;
    case "30d": return 30 * 24 * 60 * 60 * 1000;
  }
}

export function computeLocalDrops(
  products: Product[],
  window: DropWindow,
  displayCurrency: string,
  sortBy: DropSortBy = "pct",
  limit = 20,
): PriceDrop[] {
  const cutoff = Date.now() - windowMs(window);
  const drops: PriceDrop[] = [];

  for (const product of products) {
    for (const listing of product.listings ?? []) {
      const history = (listing.priceHistory ?? [])
        .filter((p) => !Number.isNaN(Date.parse(p.date)))
        .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));

      if (history.length < 2) continue;

      // Find the oldest point within the window
      const windowPoints = history.filter((p) => Date.parse(p.date) >= cutoff);
      if (windowPoints.length === 0) continue;

      const oldest = windowPoints[0];
      const newest = windowPoints[windowPoints.length - 1];

      // Convert both to display currency for comparison
      const prevPrice = convertPrice(oldest.price, oldest.currency, displayCurrency);
      const currPrice = convertPrice(newest.price, newest.currency, displayCurrency);

      if (currPrice >= prevPrice) continue; // Not a drop

      const dropAbs = prevPrice - currPrice;
      const dropPct = prevPrice > 0 ? (dropAbs / prevPrice) * 100 : 0;

      drops.push({
        productId: product.id,
        productName: product.name ?? product.modelNumber,
        modelNumber: product.modelNumber,
        distributorId: listing.distributorId,
        distributorName: listing.distributorName ?? listing.distributorId,
        previousPrice: prevPrice,
        currentPrice: currPrice,
        currency: displayCurrency,
        dropPct,
        dropAbs,
        droppedAt: oldest.date,
      });
    }
  }

  // Deduplicate by (productId, distributorId) — keep the biggest drop
  const best = new Map<string, PriceDrop>();
  for (const drop of drops) {
    const key = `${drop.productId}:${drop.distributorId}`;
    const existing = best.get(key);
    if (!existing || drop.dropPct > existing.dropPct) {
      best.set(key, drop);
    }
  }

  const sorted = [...best.values()].sort((a, b) =>
    sortBy === "pct" ? b.dropPct - a.dropPct : b.dropAbs - a.dropAbs,
  );

  return sorted.slice(0, limit);
}
```

- [ ] **Step 2: Write the tests**

Create `tests/price-leaderboard.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { computeLocalDrops, type PriceDrop } from "../lib/price-leaderboard";
import type { Product } from "../lib/types";

function makeProduct(overrides: Partial<Product> & { listingPrices?: { price: number; currency: string; date: string; distributorId: string }[] }): Product {
  const listings = (overrides.listingPrices ?? []).map((lp) => ({
    distributorId: lp.distributorId,
    distributorName: lp.distributorId,
    price: lp.price,
    currency: lp.currency,
    stockStatus: "in_stock" as const,
    url: "https://example.com",
    lastChecked: lp.date,
    priceHistory: [{ date: lp.date, price: lp.price, currency: lp.currency }],
  }));
  return {
    id: overrides.id ?? "p1",
    name: overrides.name ?? "Test Product",
    modelNumber: overrides.modelNumber ?? "M1",
    brand: "Test",
    category: "Switch",
    description: "",
    isWatched: true,
    addedAt: new Date().toISOString(),
    listings,
    ...overrides,
  } as Product;
}

describe("computeLocalDrops", () => {
  it("returns empty when no products", () => {
    expect(computeLocalDrops([], "7d", "USD")).toEqual([]);
  });

  it("returns empty when no price drops in window", () => {
    const now = new Date();
    const recent = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const product = makeProduct({
      listingPrices: [
        { price: 100, currency: "USD", date: recent, distributorId: "d1" },
      ],
    });
    // Single point — no drop possible
    expect(computeLocalDrops([product], "7d", "USD")).toEqual([]);
  });

  it("detects a price drop within the window", () => {
    const now = Date.now();
    const older = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString();
    const newer = new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString();
    const product: Product = {
      id: "p1",
      name: "Widget",
      modelNumber: "W1",
      brand: "Test",
      category: "Switch",
      description: "",
      isWatched: true,
      addedAt: new Date().toISOString(),
      listings: [{
        distributorId: "d1",
        distributorName: "D1",
        price: 80,
        currency: "USD",
        stockStatus: "in_stock",
        url: "https://example.com",
        lastChecked: newer,
        priceHistory: [
          { date: older, price: 100, currency: "USD" },
          { date: newer, price: 80, currency: "USD" },
        ],
      }],
    };
    const drops = computeLocalDrops([product], "7d", "USD");
    expect(drops).toHaveLength(1);
    expect(drops[0].dropPct).toBeCloseTo(20);
    expect(drops[0].dropAbs).toBeCloseTo(20);
    expect(drops[0].productId).toBe("p1");
  });

  it("ignores drops outside the window", () => {
    const now = Date.now();
    const old = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
    const older = new Date(now - 20 * 24 * 60 * 60 * 1000).toISOString();
    const product: Product = {
      id: "p1",
      name: "Widget",
      modelNumber: "W1",
      brand: "Test",
      category: "Switch",
      description: "",
      isWatched: true,
      addedAt: new Date().toISOString(),
      listings: [{
        distributorId: "d1",
        distributorName: "D1",
        price: 80,
        currency: "USD",
        stockStatus: "in_stock",
        url: "https://example.com",
        lastChecked: older,
        priceHistory: [
          { date: old, price: 100, currency: "USD" },
          { date: older, price: 80, currency: "USD" },
        ],
      }],
    };
    // 7d window — drop was 20 days ago
    expect(computeLocalDrops([product], "7d", "USD")).toEqual([]);
    // 30d window — drop is within range
    expect(computeLocalDrops([product], "30d", "USD")).toHaveLength(1);
  });

  it("sorts by percentage by default", () => {
    const now = Date.now();
    const older = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString();
    const newer = new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString();
    const products: Product[] = [
      {
        id: "p1", name: "A", modelNumber: "A1", brand: "T", category: "Switch",
        description: "", isWatched: true, addedAt: new Date().toISOString(),
        listings: [{
          distributorId: "d1", distributorName: "D1", price: 90, currency: "USD",
          stockStatus: "in_stock", url: "", lastChecked: newer,
          priceHistory: [
            { date: older, price: 100, currency: "USD" },
            { date: newer, price: 90, currency: "USD" },
          ],
        }],
      },
      {
        id: "p2", name: "B", modelNumber: "B1", brand: "T", category: "Switch",
        description: "", isWatched: true, addedAt: new Date().toISOString(),
        listings: [{
          distributorId: "d2", distributorName: "D2", price: 50, currency: "USD",
          stockStatus: "in_stock", url: "", lastChecked: newer,
          priceHistory: [
            { date: older, price: 100, currency: "USD" },
            { date: newer, price: 50, currency: "USD" },
          ],
        }],
      },
    ];
    const drops = computeLocalDrops(products, "7d", "USD", "pct");
    expect(drops[0].productId).toBe("p2"); // 50% drop > 10% drop
  });

  it("sorts by absolute when specified", () => {
    const now = Date.now();
    const older = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString();
    const newer = new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString();
    const products: Product[] = [
      {
        id: "p1", name: "A", modelNumber: "A1", brand: "T", category: "Switch",
        description: "", isWatched: true, addedAt: new Date().toISOString(),
        listings: [{
          distributorId: "d1", distributorName: "D1", price: 400, currency: "USD",
          stockStatus: "in_stock", url: "", lastChecked: newer,
          priceHistory: [
            { date: older, price: 500, currency: "USD" },
            { date: newer, price: 400, currency: "USD" },
          ],
        }],
      },
      {
        id: "p2", name: "B", modelNumber: "B1", brand: "T", category: "Switch",
        description: "", isWatched: true, addedAt: new Date().toISOString(),
        listings: [{
          distributorId: "d2", distributorName: "D2", price: 50, currency: "USD",
          stockStatus: "in_stock", url: "", lastChecked: newer,
          priceHistory: [
            { date: older, price: 100, currency: "USD" },
            { date: newer, price: 50, currency: "USD" },
          ],
        }],
      },
    ];
    const drops = computeLocalDrops(products, "7d", "USD", "abs");
    expect(drops[0].productId).toBe("p1"); // $100 drop > $50 drop
  });

  it("respects limit parameter", () => {
    const now = Date.now();
    const older = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString();
    const newer = new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString();
    const products: Product[] = Array.from({ length: 5 }, (_, i) => ({
      id: `p${i}`, name: `P${i}`, modelNumber: `M${i}`, brand: "T", category: "Switch",
      description: "", isWatched: true, addedAt: new Date().toISOString(),
      listings: [{
        distributorId: `d${i}`, distributorName: `D${i}`, price: 80, currency: "USD",
        stockStatus: "in_stock", url: "", lastChecked: newer,
        priceHistory: [
          { date: older, price: 100, currency: "USD" },
          { date: newer, price: 80, currency: "USD" },
        ],
      }],
    })) as unknown as Product[];
    expect(computeLocalDrops(products, "7d", "USD", "pct", 3)).toHaveLength(3);
  });

  it("keeps the biggest drop per product+distributor pair", () => {
    const now = Date.now();
    const t1 = new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString();
    const t2 = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString();
    const t3 = new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString();
    const product: Product = {
      id: "p1", name: "W", modelNumber: "W1", brand: "T", category: "Switch",
      description: "", isWatched: true, addedAt: new Date().toISOString(),
      listings: [{
        distributorId: "d1", distributorName: "D1", price: 70, currency: "USD",
        stockStatus: "in_stock", url: "", lastChecked: t3,
        priceHistory: [
          { date: t1, price: 100, currency: "USD" },
          { date: t2, price: 90, currency: "USD" },
          { date: t3, price: 70, currency: "USD" },
        ],
      }],
    };
    const drops = computeLocalDrops([product], "7d", "USD");
    expect(drops).toHaveLength(1);
    // Biggest drop is 100→70 (30%), not 100→90 or 90→70
    expect(drops[0].previousPrice).toBe(100);
    expect(drops[0].currentPrice).toBe(70);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm exec vitest run tests/price-leaderboard.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Implement and verify**

Run: `pnpm exec vitest run tests/price-leaderboard.test.ts`
Expected: all pass

- [ ] **Step 5: Run full check**

Run: `pnpm check && pnpm lint`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add lib/price-leaderboard.ts tests/price-leaderboard.test.ts
git commit -m "feat(drops): computeLocalDrops pure function + tests"
```

---

### Task 2: Server endpoint — `prices.topDrops`

**Files:** Modify `server/routers/prices.ts`, Create `tests/drops-server.test.ts`

- [ ] **Step 1: Add the `topDrops` query**

In `server/routers/prices.ts`, add after the existing `uploadHistory` mutation:

```typescript
topDrops: publicProcedure
  .input(
    z.object({
      window: z.enum(["24h", "7d", "30d"]),
      limit: z.number().int().min(1).max(50).default(20),
      sortBy: z.enum(["pct", "abs"]).default("pct"),
    }),
  )
  .query(async ({ input }) => {
    const { topDrops } = await import("../price-leaderboard.js");
    return topDrops(input.window, input.limit, input.sortBy);
  }),
```

- [ ] **Step 2: Create the server-side computation**

Create `server/price-leaderboard.ts`:

```typescript
import { and, eq, gte, sql } from "drizzle-orm";
import { priceHistory } from "../drizzle/schema";
import { getDb } from "./db";
import { PRODUCT_CATALOG } from "../shared/catalog";
import { DISTRIBUTORS } from "../shared/distributors";

export interface ServerPriceDrop {
  productId: string;
  productName: string;
  modelNumber: string;
  distributorId: string;
  distributorName: string;
  previousPrice: number;
  currentPrice: number;
  currency: string;
  dropPct: number;
  dropAbs: number;
  droppedAt: string;
}

function windowDays(window: string): number {
  switch (window) {
    case "24h": return 1;
    case "7d":  return 7;
    case "30d": return 30;
    default:    return 7;
  }
}

export async function topDrops(
  window: string,
  limit: number,
  sortBy: "pct" | "abs",
): Promise<ServerPriceDrop[]> {
  const db = await getDb();
  if (!db) return []; // No DB = no global drops

  const days = windowDays(window);
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  const cutoffDay = cutoff.toISOString().slice(0, 10);

  // Get the latest and earliest price per (distributorId, modelNumber) within window
  const rows = await db
    .select({
      distributorId: priceHistory.distributorId,
      modelNumber: priceHistory.modelNumber,
      currency: priceHistory.currency,
      minPrice: sql<string>`MIN(${priceHistory.price})`.as("min_price"),
      maxPrice: sql<string>`MAX(${priceHistory.price})`.as("max_price"),
      earliestDate: sql<string>`MIN(${priceHistory.date})`.as("earliest_date"),
      latestDate: sql<string>`MAX(${priceHistory.date})`.as("latest_date"),
    })
    .from(priceHistory)
    .where(gte(priceHistory.date, cutoffDay))
    .groupBy(priceHistory.distributorId, priceHistory.modelNumber, priceHistory.currency);

  const drops: ServerPriceDrop[] = [];

  for (const row of rows) {
    const prevPrice = parseFloat(row.maxPrice);
    const currPrice = parseFloat(row.minPrice);
    if (currPrice >= prevPrice || prevPrice <= 0) continue;

    const catalog = PRODUCT_CATALOG.find((p) => p.modelNumber === row.modelNumber);
    const dist = DISTRIBUTORS.find((d) => d.id === row.distributorId);

    drops.push({
      productId: catalog?.id ?? row.modelNumber,
      productName: catalog?.name ?? row.modelNumber,
      modelNumber: row.modelNumber,
      distributorId: row.distributorId,
      distributorName: dist?.name ?? row.distributorId,
      previousPrice: prevPrice,
      currentPrice: currPrice,
      currency: row.currency,
      dropPct: ((prevPrice - currPrice) / prevPrice) * 100,
      dropAbs: prevPrice - currPrice,
      droppedAt: row.earliestDate,
    });
  }

  drops.sort((a, b) =>
    sortBy === "pct" ? b.dropPct - a.dropPct : b.dropAbs - a.dropAbs,
  );

  return drops.slice(0, limit);
}
```

- [ ] **Step 3: Write a guard test**

Create `tests/drops-server.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("server drops endpoint", () => {
  it("prices router exposes topDrops query", () => {
    const src = readFileSync(join(__dirname, "..", "server", "routers", "prices.ts"), "utf8");
    expect(src).toContain("topDrops");
  });

  it("server price-leaderboard module exists and exports topDrops", () => {
    const src = readFileSync(join(__dirname, "..", "server", "price-leaderboard.ts"), "utf8");
    expect(src).toContain("export async function topDrops");
  });
});
```

- [ ] **Step 4: Run tests**

Run: `pnpm exec vitest run tests/drops-server.test.ts`
Expected: all pass

- [ ] **Step 5: Run check**

Run: `pnpm check`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add server/routers/prices.ts server/price-leaderboard.ts tests/drops-server.test.ts
git commit -m "feat(drops): server prices.topDrops query + price-leaderboard module"
```

---

### Task 3: Home section component (mobile)

**Files:** Create `components/home/drop-leaderboard.tsx`, Modify `app/(tabs)/index.tsx`

- [ ] **Step 1: Create the Home section component**

Create `components/home/drop-leaderboard.tsx` following the pattern of `components/home/trending-section.tsx`. The component:

- Imports `computeLocalDrops` from `@/lib/price-leaderboard`
- Uses `useWatchlist()` from hooks
- Has state: `window` (default "7d"), `sortBy` (default "pct")
- Computes drops via `useMemo(() => computeLocalDrops(products, window, displayCurrency, sortBy, 5), [products, window, displayCurrency, sortBy])`
- Renders: header "Biggest Drops" + time-range chips (24h/7d/30d) + sort toggle (%/$)
- Renders: 5 product rows (product name, distributor badge, drop %, drop $)
- Footer: "See all →" link to `/drops`
- Uses `useColors()` for theming, `useRouter()` for navigation
- Follows NativeWind + inline style pattern from trending-section

- [ ] **Step 2: Wire into Home screen**

In `app/(tabs)/index.tsx`, add import and insert the section between Trending and Quick Access:

```typescript
import { DropLeaderboard } from "@/components/home/drop-leaderboard";
```

After the Trending section (around line 717):

```tsx
{/* Price Drop Leaderboard */}
<View style={{ paddingHorizontal: 16 }}>
  <DropLeaderboard />
</View>
```

- [ ] **Step 3: Run check and lint**

Run: `pnpm check && pnpm lint`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add components/home/drop-leaderboard.tsx app/\(tabs\)/index.tsx
git commit -m "feat(drops): home section with top 5 price drops"
```

---

### Task 4: Full screen route (mobile)

**Files:** Create `app/drops.tsx`

- [ ] **Step 1: Create the full screen**

Create `app/drops.tsx`:

- Header: back button + "Price Drops" title + share button
- Time-range chips: 24h / 7d / 30d (default 7d)
- Rank toggle: % / $ (default %)
- Tab selector: "Your Drops" / "Global Drops" (when signed in)
- "Your Drops" tab: uses `computeLocalDrops(products, window, displayCurrency, sortBy, 20)`
- "Global Drops" tab: calls `trpc.prices.topDrops.query({ window, limit: 20, sortBy })` via tRPC
- 20 rows in a FlatList: product image, name, distributor, old→new price, drop %, drop $
- Tap row: navigate to `/product/[id]` if on watchlist, else to search
- Empty state per tab
- Share button: clipboard copy (implement in Task 6)
- Uses `ScreenContainer` wrapper, `useColors()`, `useRouter()`

- [ ] **Step 2: Run check**

Run: `pnpm check`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add app/drops.tsx
git commit -m "feat(drops): full screen with Your/Global tabs"
```

---

### Task 5: Desktop parity

**Files:** Create `desktop/src/pages/Drops.tsx`, Create `desktop/src/components/DropLeaderboard.tsx`, Modify `desktop/src/components/Sidebar.tsx`, Modify `desktop/src/App.tsx`

- [ ] **Step 1: Create desktop full screen**

Create `desktop/src/pages/Drops.tsx` following the pattern of `desktop/src/pages/Stats.tsx`:
- Same controls (time-range chips, sort toggle, Your/Global tabs)
- Table layout (not FlatList — desktop uses HTML tables)
- 20 rows with product image, name, distributor, prices, drop %, drop $
- Tap row navigates to `/product/:id`
- Share button (clipboard)

- [ ] **Step 2: Create desktop Home section**

Create `desktop/src/components/DropLeaderboard.tsx`:
- Same data logic as mobile but renders with Tailwind
- Top 5 drops, "See all →" link to `/drops`

- [ ] **Step 3: Wire into desktop Home**

In `desktop/src/pages/Home.tsx`, import and render `<DropLeaderboard />` after TrendingSection.

- [ ] **Step 4: Add sidebar entry**

In `desktop/src/components/Sidebar.tsx`, add to `navItems` after "Alerts":

```typescript
{ to: "/drops", icon: TrendingDown, label: "Drops" },
```

Import `TrendingDown` from lucide-react.

- [ ] **Step 5: Register route**

In `desktop/src/App.tsx`, add lazy import and route:

```typescript
const Drops = lazy(() =>
  import("./pages/Drops").then((m) => ({ default: m.Drops })),
);
```

Add route in the Routes block:

```tsx
<Route path="/drops" element={<Drops />} />
```

- [ ] **Step 6: Run desktop tests**

Run: `pnpm --filter desktop test`
Expected: all pass

- [ ] **Step 7: Commit**

```bash
git add desktop/src/pages/Drops.tsx desktop/src/components/DropLeaderboard.tsx desktop/src/pages/Home.tsx desktop/src/components/Sidebar.tsx desktop/src/App.tsx
git commit -m "feat(drops): desktop parity — full screen + home section + sidebar"
```

---

### Task 6: Sharing

**Files:** Modify `app/drops.tsx`, Modify `desktop/src/pages/Drops.tsx`

- [ ] **Step 1: Add clipboard share function**

In `lib/price-leaderboard.ts`, add:

```typescript
export function buildDropShareText(
  drops: PriceDrop[],
  window: DropWindow,
  sortBy: DropSortBy,
): string {
  const windowLabel = { "24h": "24h", "7d": "7d", "30d": "30d" }[window];
  const sortLabel = sortBy === "pct" ? "%" : "$";
  const lines = drops.slice(0, 10).map((d, i) => {
    const pct = `−${d.dropPct.toFixed(0)}%`;
    const abs = `−${formatPrice(d.dropAbs, d.currency)}`;
    return `${i + 1}. ${d.productName} (${d.distributorName}) — ${formatPrice(d.previousPrice, d.currency)} → ${formatPrice(d.currentPrice, d.currency)} (${pct}, ${abs})`;
  });
  return `📉 Price Drops (${windowLabel}, by ${sortLabel})\n${lines.join("\n")}\n\nvia Product Stock Finder`;
}
```

Import `formatPrice` from `@shared/currency`.

- [ ] **Step 2: Wire share button in mobile full screen**

In `app/drops.tsx`, the share button calls:
```typescript
const text = buildDropShareText(drops, window, sortBy);
await copyTextWithFallback(text);
showToast("Copied to clipboard");
```

- [ ] **Step 3: Wire share button in desktop full screen**

Same pattern in `desktop/src/pages/Drops.tsx`.

- [ ] **Step 4: Test the share function**

Add to `tests/price-leaderboard.test.ts`:

```typescript
describe("buildDropShareText", () => {
  it("formats drops into shareable text", () => {
    const drops: PriceDrop[] = [{
      productId: "p1", productName: "Widget", modelNumber: "W1",
      distributorId: "d1", distributorName: "D1",
      previousPrice: 100, currentPrice: 70, currency: "USD",
      dropPct: 30, dropAbs: 30, droppedAt: "2026-10-01",
    }];
    const text = buildDropShareText(drops, "7d", "pct");
    expect(text).toContain("Price Drops");
    expect(text).toContain("Widget");
    expect(text).toContain("−30%");
    expect(text).toContain("Product Stock Finder");
  });
});
```

- [ ] **Step 5: Run all tests and check**

Run: `pnpm check && pnpm exec vitest run tests/price-leaderboard.test.ts`
Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add lib/price-leaderboard.ts app/drops.tsx desktop/src/pages/Drops.tsx tests/price-leaderboard.test.ts
git commit -m "feat(drops): share leaderboard to clipboard"
```

---

### Task 7: Wiring guards + full verification

**Files:** Create `tests/drops-wiring-guard.test.ts`, Create `desktop/tests/drops-parity.test.tsx`

- [ ] **Step 1: Create mobile wiring guard**

Create `tests/drops-wiring-guard.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("drops feature wiring", () => {
  it("Home screen imports DropLeaderboard", () => {
    expect(read("app/(tabs)/index.tsx")).toContain("drop-leaderboard");
  });

  it("full screen route exists", () => {
    expect(read("app/drops.tsx")).toContain("export");
  });

  it("computeLocalDrops is defined", () => {
    expect(read("lib/price-leaderboard.ts")).toContain("export function computeLocalDrops");
  });

  it("buildDropShareText is defined", () => {
    expect(read("lib/price-leaderboard.ts")).toContain("export function buildDropShareText");
  });

  it("server has topDrops query", () => {
    expect(read("server/routers/prices.ts")).toContain("topDrops");
  });
});
```

- [ ] **Step 2: Create desktop wiring guard**

Create `desktop/tests/drops-parity.test.tsx`:

```typescript
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("desktop drops parity", () => {
  it("Drops page exists", () => {
    expect(read("src/pages/Drops.tsx")).toContain("export function Drops");
  });

  it("DropLeaderboard component exists", () => {
    expect(read("src/components/DropLeaderboard.tsx")).toContain("DropLeaderboard");
  });

  it("Sidebar has Drops entry", () => {
    expect(read("src/components/Sidebar.tsx")).toContain('"/drops"');
  });

  it("App.tsx registers /drops route", () => {
    expect(read("src/App.tsx")).toContain('path="/drops"');
  });
});
```

- [ ] **Step 3: Run all tests**

Run: `pnpm exec vitest run tests/drops-wiring-guard.test.ts tests/drops-server.test.ts tests/price-leaderboard.test.ts`
Expected: all pass

- [ ] **Step 4: Run desktop tests**

Run: `pnpm --filter desktop test`
Expected: all pass

- [ ] **Step 5: Run full verification**

Run: `pnpm verify`
Expected: exit 0

- [ ] **Step 6: Commit**

```bash
git add tests/drops-wiring-guard.test.ts desktop/tests/drops-parity.test.tsx
git commit -m "test(drops): wiring guards + desktop parity guards"
```

---

## Self-Review

**Spec coverage:**
- ✅ Pure function `computeLocalDrops` (Task 1)
- ✅ Server `prices.topDrops` query against `priceHistory` (Task 2)
- ✅ Home section with top 5 (Task 3)
- ✅ Full screen with Your/Global tabs, time-range, sort-by (Task 4)
- ✅ Desktop parity — full screen, Home section, sidebar, route (Task 5)
- ✅ Clipboard sharing (Task 6)
- ✅ Wiring guards + full verify (Task 7)
- ❌ Server share link (`prices.createDropShare` + `/drops/[token]` public page) — deferred per YAGNI; clipboard covers the core use case. Can add later if users request it.

**Placeholder scan:** None found.

**Type consistency:** `PriceDrop`, `DropWindow`, `DropSortBy` defined in Task 1 and reused in all subsequent tasks. `computeLocalDrops` signature matches test expectations.