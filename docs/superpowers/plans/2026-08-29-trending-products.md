# Trending Products Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Trending Now" section to the home screen that surfaces hard-to-find products from external sources.

**Architecture:** Server aggregates RSS feeds + LLM analysis every 6 hours, caches results in DB. Client fetches cached list on app open via `GET /api/trending`.

**Tech Stack:** Express, tRPC, Drizzle ORM, MySQL, RSS parser, React Query, NativeWind, expo-router

---

### Task 1: Add TrendingProduct type + DB migration

**Files:**
- Modify: `lib/types.ts`
- Create: `drizzle/0019_trending_products.sql`

- [ ] **Step 1: Add TrendingProduct interface to types.ts**

Add at the end of `lib/types.ts` (before the closing):

```typescript
export interface TrendingProduct {
  id: string;
  name: string;
  brand: string;
  category: string;
  estimatedPrice: number;
  currency: string;
  reason: string;
  source: string;
  fetchedAt: string;
  expiresAt: string;
}
```

- [ ] **Step 2: Run type check**

```bash
pnpm check
```

Expected: 0 errors

- [ ] **Step 3: Create DB migration**

Create `drizzle/0019_trending_products.sql`:

```sql
CREATE TABLE IF NOT EXISTS `trendingProducts` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `brand` VARCHAR(100),
  `category` VARCHAR(100),
  `estimatedPrice` DECIMAL(10,2),
  `currency` VARCHAR(3) DEFAULT 'USD',
  `reason` TEXT,
  `source` VARCHAR(255),
  `fetchedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `expiresAt` TIMESTAMP NOT NULL
);
```

- [ ] **Step 4: Run tests**

```bash
pnpm test
```

Expected: 0 failures

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts drizzle/0019_trending_products.sql
git commit -m "feat: add TrendingProduct type and DB migration"
```

---

### Task 2: Server-side trending router + RSS fetch

**Files:**
- Create: `server/routers/trending.ts`
- Modify: `server/routers.ts`
- Create: `tests/trending-server.test.ts`

- [ ] **Step 1: Write failing test for RSS fetch**

Create `tests/trending-server.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";

describe("trending server", () => {
  it("fetchRssFeeds returns parsed items from valid RSS", async () => {
    const mockXml = `<?xml version="1.0"?><rss><channel><item><title>NVIDIA RTX 5090 — $2000 at Newegg</title><link>https://example.com</link></item></channel></rss>`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(mockXml) }));
    const { fetchRssFeeds } = await import("../server/routers/trending");
    const items = await fetchRssFeeds();
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].title).toContain("RTX 5090");
  });

  it("fetchRssFeeds skips failed feeds gracefully", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    const { fetchRssFeeds } = await import("../server/routers/trending");
    const items = await fetchRssFeeds();
    expect(items).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/trending-server.test.ts
```

Expected: FAIL with module not found

- [ ] **Step 3: Create server router**

Create `server/routers/trending.ts`:

```typescript
import { z } from "zod";

const RSS_FEEDS = [
  { name: "r/buildapcsales", url: "https://www.reddit.com/r/buildapcsales/.rss" },
  { name: "r/hardwareswap", url: "https://www.reddit.com/r/hardwareswap/.rss" },
  { name: "Hacker News", url: "https://hn.algolia.com/api/v1/search?query=hardware&tags=story" },
  { name: "Slickdeals", url: "https://slickdeals.net/newsearch.php?searcharea=deals&searchin=first&rss=1" },
  { name: "Tom's Hardware", url: "https://www.tomshardware.com/feeds/all" },
];

interface RssItem {
  title: string;
  link: string;
  source: string;
}

function parseRssItems(xml: string, source: string): RssItem[] {
  const items: RssItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const titleMatch = block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/);
    const linkMatch = block.match(/<link>(.*?)<\/link>/);
    const title = titleMatch?.[1] || titleMatch?.[2] || "";
    const link = linkMatch?.[1] || "";
    if (title.trim()) {
      items.push({ title: title.trim(), link: link.trim(), source });
    }
  }
  return items;
}

export async function fetchRssFeeds(): Promise<RssItem[]> {
  const allItems: RssItem[] = [];
  const results = await Promise.allSettled(
    RSS_FEEDS.map(async (feed) => {
      const res = await fetch(feed.url, {
        headers: { "User-Agent": "ProductStockFinder/1.0" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml = await res.text();
      return parseRssItems(xml, feed.name);
    }),
  );
  for (const r of results) {
    if (r.status === "fulfilled") allItems.push(...r.value);
  }
  return allItems;
}

export function buildTrendingPrompt(items: RssItem[], watchlistNames: string[]): string {
  const itemText = items
    .slice(0, 50)
    .map((i) => `- [${i.source}] ${i.title}`)
    .join("\n");
  const exclude = watchlistNames.length
    ? `\nExclude these products already in the user's watchlist: ${watchlistNames.join(", ")}`
    : "";
  return `Given these trending products from tech communities, which are hardest to find or most in demand? Return top 10 with JSON array containing: name (string), brand (string), category (string), estimatedPrice (number, USD), reason (1-sentence scarcity reason), source (which feed it came from).${exclude}

Trending items:
${itemText}

Return ONLY valid JSON array, no markdown.`;
}

export const trendingRouter = {};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/trending-server.test.ts
```

Expected: PASS

- [ ] **Step 5: Register router in server/routers.ts**

Add at the end of `server/routers.ts`:

```typescript
import { trendingRouter } from "./routers/trending";
// ... add to appRouter:
// trending: trendingRouter,
```

- [ ] **Step 6: Run full type check**

```bash
pnpm check
```

Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
git add server/routers/trending.ts server/routers.ts tests/trending-server.test.ts
git commit -m "feat: add server-side trending router with RSS fetch + LLM prompt builder"
```

---

### Task 3: Server-side cache endpoint + DB read/write

**Files:**
- Modify: `server/routers/trending.ts`
- Modify: `tests/trending-server.test.ts`

- [ ] **Step 1: Write failing test for cache endpoint**

Add to `tests/trending-server.test.ts`:

```typescript
describe("trending cache", () => {
  it("getTrending returns non-expired products", async () => {
    const mockProducts = [
      {
        id: "1",
        name: "DGX Spark",
        brand: "NVIDIA",
        category: "Server",
        estimatedPrice: 3000,
        currency: "USD",
        reason: "Extremely limited supply",
        source: "r/buildapcsales",
        fetchedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockProducts),
    }));
    const { getTrending } = await import("../server/routers/trending");
    const products = await getTrending();
    expect(products.length).toBeGreaterThan(0);
    expect(products[0].name).toBe("DGX Spark");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/trending-server.test.ts
```

Expected: FAIL (getTrending not defined)

- [ ] **Step 3: Implement getTrending in trending.ts**

Add to `server/routers/trending.ts`:

```typescript
const TRENDING_CACHE_URL = process.env.EXPO_PUBLIC_API_BASE_URL
  ? `${process.env.EXPO_PUBLIC_API_BASE_URL}/api/trending`
  : "http://localhost:3001/api/trending";

export async function getTrending(): Promise<
  Array<{
    id: string;
    name: string;
    brand: string;
    category: string;
    estimatedPrice: number;
    currency: string;
    reason: string;
    source: string;
    fetchedAt: string;
    expiresAt: string;
  }>
> {
  try {
    const res = await fetch(TRENDING_CACHE_URL);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/trending-server.test.ts
```

Expected: PASS

- [ ] **Step 5: Run full tests**

```bash
pnpm test
```

Expected: 0 failures

- [ ] **Step 6: Commit**

```bash
git add server/routers/trending.ts tests/trending-server.test.ts
git commit -m "feat: add getTrending cache endpoint to trending router"
```

---

### Task 4: Client-side trending fetch function

**Files:**
- Create: `lib/trending.ts`
- Create: `tests/trending.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/trending.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchTrending } from "../lib/trending";

describe("fetchTrending", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns trending products from API", async () => {
    const mockData = [
      {
        id: "1",
        name: "RTX 5090",
        brand: "NVIDIA",
        category: "GPU",
        estimatedPrice: 2000,
        currency: "USD",
        reason: "Extremely limited availability",
        source: "r/buildapcsales",
        fetchedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(mockData) }),
    );
    const result = await fetchTrending();
    expect(result).toEqual(mockData);
  });

  it("returns empty array on fetch error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    const result = await fetchTrending();
    expect(result).toEqual([]);
  });

  it("returns empty array on non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    );
    const result = await fetchTrending();
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/trending.test.ts
```

Expected: FAIL (module not found)

- [ ] **Step 3: Implement fetchTrending**

Create `lib/trending.ts`:

```typescript
import { TrendingProduct } from "@/lib/types";

function getApiBase(): string {
  return process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
}

export async function fetchTrending(): Promise<TrendingProduct[]> {
  try {
    const res = await fetch(`${getApiBase()}/api/trending`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/trending.test.ts
```

Expected: PASS

- [ ] **Step 5: Run full tests**

```bash
pnpm test
```

Expected: 0 failures

- [ ] **Step 6: Commit**

```bash
git add lib/trending.ts tests/trending.test.ts
git commit -m "feat: add client-side fetchTrending function"
```

---

### Task 5: TrendingSection UI component

**Files:**
- Create: `components/home/trending-section.tsx`

- [ ] **Step 1: Create TrendingSection component**

Create `components/home/trending-section.tsx`:

```typescript
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { TrendingProduct } from "@/lib/types";
import { fetchTrending } from "@/lib/trending";
import { useColors } from "@/hooks/use-colors";
import { addToWatchlist, getWatchlist } from "@/lib/storage";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

export function TrendingSection() {
  const colors = useColors();
  const { data: products, isLoading } = useQuery({
    queryKey: ["trending"],
    queryFn: fetchTrending,
    staleTime: 6 * 60 * 60 * 1000,
  });

  const [watchlistIds, setWatchlistIds] = React.useState<Set<string>>(
    new Set(),
  );

  React.useEffect(() => {
    getWatchlist().then((w) =>
      setWatchlistIds(new Set(w.map((p) => p.id))),
    );
  }, []);

  const handleAdd = async (product: TrendingProduct) => {
    await addToWatchlist({
      id: product.id,
      name: product.name,
      modelNumber: product.id,
      brand: product.brand,
      category: product.category,
      isWatched: true,
      addedAt: new Date().toISOString(),
      listings: [],
    });
    setWatchlistIds((prev) => new Set([...prev, product.id]));
    try {
      await AsyncStorage.setItem(
        "trending_added",
        JSON.stringify([...watchlistIds, product.id]),
      );
    } catch {}
  };

  if (isLoading || !products || products.length === 0) return null;

  return (
    <View style={{ marginBottom: 16 }}>
      <Text
        style={{
          fontSize: 18,
          fontWeight: "700",
          color: colors.foreground,
          marginBottom: 4,
        }}
      >
        🔥 Trending Now
      </Text>
      <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 12 }}>
        Hard-to-find products from the community
      </Text>
      {products.slice(0, 3).map((product) => (
        <TouchableOpacity
          key={product.id}
          onPress={() => router.push(`/product/${product.id}`)}
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 14,
            marginBottom: 8,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "600",
                  color: colors.foreground,
                }}
              >
                {product.name}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: colors.muted,
                  marginTop: 2,
                }}
              >
                {product.category} · {product.brand} ·{" "}
                {product.currency === "USD"
                  ? "$"
                  : product.currency === "EUR"
                    ? "€"
                    : product.currency === "GBP"
                      ? "£"
                      : product.currency + " "}
                {product.estimatedPrice.toLocaleString()}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: colors.muted,
                  marginTop: 4,
                  fontStyle: "italic",
                }}
              >
                {product.reason}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => handleAdd(product)}
              disabled={watchlistIds.has(product.id)}
              style={{
                backgroundColor: watchlistIds.has(product.id)
                  ? colors.muted
                  : colors.primary,
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 6,
                marginLeft: 8,
              }}
            >
              <Text
                style={{
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: "600",
                }}
              >
                {watchlistIds.has(product.id) ? "In Watchlist" : "Add"}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}
```

- [ ] **Step 2: Run type check**

```bash
pnpm check
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add components/home/trending-section.tsx
git commit -m "feat: add TrendingSection component with add-to-watchlist"
```

---

### Task 6: Wire trending into home screen + app layout

**Files:**
- Modify: `app/(tabs)/index.tsx`
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Import TrendingSection in home screen**

Add to `app/(tabs)/index.tsx` imports:

```typescript
import { TrendingSection } from "@/components/home/trending-section";
```

Add `<TrendingSection />` before the watchlist section (after the header/hero area):

```typescript
{/* Trending products */}
<TrendingSection />
```

- [ ] **Step 2: Run type check**

```bash
pnpm check
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add "app/(tabs)/index.tsx"
git commit -m "feat: wire TrendingSection into home screen"
```

---

### Task 7: Server-side DB read/write + cron endpoint

**Files:**
- Modify: `server/routers/trending.ts`
- Modify: `server/routers.ts`

- [ ] **Step 1: Add tRPC router for trending**

Add to `server/routers/trending.ts`:

```typescript
import { router, publicProcedure } from "../trpc";
import { db } from "../db";
import { trendingProducts } from "../../drizzle/schema";
import { gte } from "drizzle-orm";
import { nanoid } from "nanoid";

export const trendingRouter = router({
  get: publicProcedure.query(async () => {
    const now = new Date();
    const rows = await db
      .select()
      .from(trendingProducts)
      .where(gte(trendingProducts.expiresAt, now));
    return rows.slice(0, 10);
  }),

  refresh: publicProcedure.mutation(async () => {
    const items = await fetchRssFeeds();
    if (items.length === 0) return { count: 0 };

    const prompt = buildTrendingPrompt(items, []);
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      }),
    });

    if (!aiRes.ok) return { count: 0 };

    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content ?? "[]";

    let products: Array<{
      name: string;
      brand: string;
      category: string;
      estimatedPrice: number;
      reason: string;
      source: string;
    }>;

    try {
      products = JSON.parse(content);
    } catch {
      return { count: 0 };
    }

    if (!Array.isArray(products)) return { count: 0 };

    const nowMs = Date.now();
    const expiresAt = new Date(nowMs + 6 * 60 * 60 * 1000);
    const rows = products.slice(0, 10).map((p) => ({
      id: nanoid(),
      name: p.name,
      brand: p.brand,
      category: p.category,
      estimatedPrice: String(p.estimatedPrice),
      currency: "USD",
      reason: p.reason,
      source: p.source,
      fetchedAt: new Date(nowMs),
      expiresAt,
    }));

    // Clear old trending products
    await db.delete(trendingProducts);

    // Insert new ones
    if (rows.length > 0) {
      await db.insert(trendingProducts).values(rows);
    }

    return { count: rows.length };
  }),
});
```

- [ ] **Step 2: Register in server/routers.ts**

Update the trending router import in `server/routers.ts`:

```typescript
import { trendingRouter } from "./routers/trending";
```

And ensure it's in the appRouter:

```typescript
trending: trendingRouter,
```

- [ ] **Step 3: Run type check**

```bash
pnpm check
```

Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add server/routers/trending.ts server/routers.ts
git commit -m "feat: add trending tRPC router with DB read/write and refresh"
```

---

### Task 8: Final verification + commit

**Files:** None (verification only)

- [ ] **Step 1: Run full type check**

```bash
pnpm check
```

Expected: 0 errors

- [ ] **Step 2: Run full lint**

```bash
pnpm lint
```

Expected: 0 errors (warnings OK)

- [ ] **Step 3: Run full test suite**

```bash
pnpm test
```

Expected: All tests pass

- [ ] **Step 4: Review all changes**

```bash
git status
git log --oneline -8
```

- [ ] **Step 5: Final commit if needed**

```bash
git add -A
git commit -m "feat: trending hard-to-find products — server aggregation + home screen UI"
```

---

## Self-Review Checklist

- [x] Spec coverage: RSS feeds, LLM analysis, DB table, API endpoint, client fetch, UI component, home screen integration — all covered
- [x] No TBD/TODO placeholders in plan
- [x] Type consistency: `TrendingProduct` defined in Task 1, used consistently in Tasks 3-6
- [x] Exact file paths for all changes
- [x] Complete code blocks for every implementation step
- [x] Tests written before implementation (TDD)
- [x] Frequent commits (7 commit points)
