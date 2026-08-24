# Watchlist Share Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Share the watchlist summary (basket value, top drops, stock health) as formatted text from a share button on the Statistics screen.

**Architecture:** Pure `buildWatchlistShareText` composing the existing `lib/watchlist-stats.ts` functions (TDD); a header share button on `app/stats.tsx` wires it to `Share.share`.

**Tech Stack:** TypeScript strict, vitest, RN Share.

---

## Task 1: Share-text module (TDD) + Stats screen button

**Files:**
- Create: `lib/watchlist-share.ts`
- Test: `tests/watchlist-share.test.ts`
- Modify: `app/stats.tsx`

- [ ] **Step 1: Write failing test `tests/watchlist-share.test.ts`**

```typescript
import { describe, expect, it } from "vitest";
import { buildWatchlistShareText } from "../lib/watchlist-share";
import type { DistributorListing, Product } from "../lib/types";

const NOW = Date.parse("2026-06-15T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function listing(
  overrides: Partial<DistributorListing> & { distributorId: string },
): DistributorListing {
  return {
    productId: "p1",
    price: 100,
    currency: "USD",
    stockStatus: "in_stock",
    url: "",
    lastChecked: new Date(NOW - DAY).toISOString(),
    priceHistory: [],
    ...overrides,
  } as DistributorListing;
}

function product(id: string, listings: DistributorListing[]): Product {
  return {
    id,
    name: id,
    brand: "MikroTik",
    category: "Routers",
    modelNumber: id.toUpperCase(),
    description: "",
    isWatched: true,
    addedAt: new Date(NOW).toISOString(),
    listings,
  } as unknown as Product;
}

describe("buildWatchlistShareText", () => {
  it("includes all sections when data is present", () => {
    const watchlist = [
      product("p1", [
        listing({
          distributorId: "mikrotikstore-de",
          priceHistory: [
            { date: new Date(NOW - 3 * DAY).toISOString(), price: 100, currency: "USD", stockStatus: "in_stock" },
            { date: new Date(NOW).toISOString(), price: 82, currency: "USD", stockStatus: "in_stock" },
          ],
        }),
      ]),
      product("p2", [listing({ distributorId: "winncom-us", price: 50 })]),
    ];
    const text = buildWatchlistShareText({
      watchlist,
      displayCurrency: "USD",
      days: 30,
      now: NOW,
    });
    expect(text).toContain("My Watchlist — 2 products");
    expect(text).toContain("Basket value:");
    expect(text).toContain("Biggest drops (30d):");
    expect(text).toContain("-18%");
    expect(text).toContain("Stock health:");
    expect(text.trimEnd().endsWith("via Product Stock Finder")).toBe(true);
  });

  it("omits sections when data is missing", () => {
    // One product, no history, no stock -> no drops, no stock-health line.
    const text = buildWatchlistShareText({
      watchlist: [product("p1", [])],
      displayCurrency: "USD",
      days: 7,
      now: NOW,
    });
    expect(text).not.toContain("Biggest drops");
    expect(text).not.toContain("Stock health");
    expect(text).toContain("My Watchlist — 1 products");
  });

  it("labels the window for each range", () => {
    const mk = (days: 7 | 30 | null) =>
      buildWatchlistShareText({
        watchlist: [product("p1", [])],
        displayCurrency: "USD",
        days,
        now: NOW,
      });
    expect(mk(7)).toContain("(7d)");
    expect(mk(30)).toContain("(30d)");
    expect(mk(null)).toContain("(all time)");
  });

  it("truncates movers to three rows", () => {
    const watchlist = Array.from({ length: 5 }, (_, i) =>
      product(`p${i}`, [
        listing({
          distributorId: "winncom-us",
          priceHistory: [
            { date: new Date(NOW - 3 * DAY).toISOString(), price: 200 - i * 10, currency: "USD", stockStatus: "in_stock" },
            { date: new Date(NOW).toISOString(), price: 100 + i * 10, currency: "USD", stockStatus: "in_stock" },
          ],
        }),
      ]),
    );
    const text = buildWatchlistShareText({
      watchlist,
      displayCurrency: "USD",
      days: 30,
      now: NOW,
    });
    const dropRows = text.split("\n").filter((l) => l.startsWith("🇺") || l.includes("— -"));
    expect(dropRows.length).toBeLessThanOrEqual(3);
  });

  it("renders minimal output for an empty watchlist", () => {
    const text = buildWatchlistShareText({
      watchlist: [],
      displayCurrency: "USD",
      days: 30,
      now: NOW,
    });
    expect(text).toContain("My Watchlist — 0 products");
    expect(text.trimEnd().endsWith("via Product Stock Finder")).toBe(true);
  });
});
```

Note: adjust fixture casts against `lib/types.ts` required fields; adjust the mover-row filter if flag characters differ (rows start with the distributor country flag).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/watchlist-share.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Create `lib/watchlist-share.ts`**

```typescript
import type { Product } from "./types";
import {
  computeBasketValue,
  computeMovers,
  computeStockHealth,
  type MoversWindow,
} from "./watchlist-stats";

export interface WatchlistShareInput {
  watchlist: Product[];
  displayCurrency: string;
  days: MoversWindow;
  now?: number;
}

function windowLabel(days: MoversWindow): string {
  if (days === 7) return "7d";
  if (days === 30) return "30d";
  return "all time";
}

export function buildWatchlistShareText(input: WatchlistShareInput): string {
  const { watchlist, displayCurrency, days } = input;

  const lines: string[] = [`My Watchlist — ${watchlist.length} products`, ""];

  const basket = computeBasketValue(watchlist, displayCurrency);
  if (basket.productCount > 0) {
    lines.push(
      `Basket value: $${basket.total.toFixed(2)} (${basket.productCount} products)`,
    );
  }

  const movers = computeMovers(
    watchlist,
    displayCurrency,
    days,
    input.now ?? Date.now(),
  );
  if (movers.drops.length > 0) {
    lines.push("", `Biggest drops (${windowLabel(days)}):`);
    for (const drop of movers.drops.slice(0, 3)) {
      lines.push(`${drop.countryFlag} ${drop.productName} — ${drop.changePct}%`.trimStart());
    }
  }

  const health = computeStockHealth(watchlist);
  if (health.totalListings > 0) {
    lines.push(
      "",
      `Stock health: ${health.inStockPct}% in stock · ${health.fullyOutOfStock} fully out of stock`,
    );
  }

  lines.push("", "via Product Stock Finder");
  return lines.join("\n");
}
```

Note: basket total is formatted with `$…toFixed(2)` here because the share text should stay plain-text friendly; keep consistent with tests.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/watchlist-share.test.ts` — PASS.
Run: `pnpm check` — 0 errors. Run: `pnpm test` — all pass.

- [ ] **Step 5: Wire into `app/stats.tsx`**

1. Add imports:

```typescript
import { Share } from "react-native";
import { buildWatchlistShareText } from "@/lib/watchlist-share";
```

(merge `Share` into the existing react-native import list.)

2. In the component body (after the memos), add:

```typescript
  const handleShare = async () => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message: buildWatchlistShareText({
          watchlist,
          displayCurrency,
          days,
        }),
        title: "My Watchlist",
      });
    } catch {
      // User cancelled share
    }
  };
```

3. In the header row, after the "Statistics" title Text (which has flex: 1), add:

```tsx
        <TouchableOpacity onPress={handleShare} style={{ padding: 4 }}>
          <IconSymbol name="square.and.arrow.up" size={22} color={colors.primary} />
        </TouchableOpacity>
```

(`square.and.arrow.up` and `Platform`/`Haptics` are already imported in this screen from Phase 79 — verify.)

- [ ] **Step 6: Verify**

Run: `pnpm check` — 0 errors.
Run: `pnpm lint` — no new errors.
Run: `pnpm test` — all pass.

- [ ] **Step 7: Update `todo.md` + commit + push**

Append Phase 84 section:

```markdown
## Phase 84: Watchlist Share (v5.32)

- [x] Add pure watchlist share-text builder (basket, top drops, stock health)
- [x] Unit-test formatting incl. section omission and window labels
- [x] Add share button to Statistics screen header
```

Then:

```bash
git add lib/watchlist-share.ts tests/watchlist-share.test.ts app/stats.tsx todo.md && git commit -m "feat: share watchlist summary from statistics screen"
git push origin main
```

---

## Summary

| Metric | Value |
|--------|-------|
| New pure module | `lib/watchlist-share.ts` (~70 lines) |
| New tests | `tests/watchlist-share.test.ts` (~5 cases) |
| Modified | `app/stats.tsx` (header share button) |
