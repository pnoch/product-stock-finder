# Redesign Plan C — Home Priority Feed

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Home as a priority feed answering "do I need to act?" — greeting header, urgency-ordered cards (alerts fired → big drops → restocks → all-quiet), watchlist preview; remove stat cards, recent activity, away card, and the Available/Trending sections (now on Discover).

**Architecture:** Pure `lib/home-feed.ts` builds ordered feed items from alerts + drops + away-summary restocks. New `components/home/feed-card.tsx` renders the four card types. `app/(tabs)/index.tsx` rewired: greeting header + feed + watchlist preview; stat cards, recent activity feed, AwaySummaryCard, AvailableSection, TrendingSection removed (DropLeaderboard stays as the drops source — feed reuses its data via `computeLocalDrops` directly).

**Tech Stack:** TypeScript, Expo Router, React Native, NativeWind + `useColors()`.

**Spec:** `docs/superpowers/specs/2026-10-11-android-redesign-design.md` (Section 3)

---

## File Structure

| File | Purpose |
|------|---------|
| Create `lib/home-feed.ts` | `greetingFor`, `buildFeedItems` pure helpers |
| Create `components/home/feed-card.tsx` | AlertFiredCard, DropCard, RestockCard, QuietCard |
| Modify `app/(tabs)/index.tsx` | Rewire to feed |
| Create `tests/home-feed.test.ts` | Unit tests |
| Create `tests/home-feed-guard.test.ts` | Wiring guards |

---

### Task 1: Pure helpers (`lib/home-feed.ts` + tests)

**Files:**
- Create: `lib/home-feed.ts`
- Create: `tests/home-feed.test.ts`

- [ ] **Step 1: Write `lib/home-feed.ts`**

```typescript
import type { PriceAlert, Product } from "@/lib/types";
import type { AwaySummary } from "@/lib/away-summary";
import { computeLocalDrops, type PriceDrop } from "@/lib/price-leaderboard";

export type FeedItem =
  | { kind: "alerts"; alerts: PriceAlert[] }
  | { kind: "drops"; drops: PriceDrop[] }
  | { kind: "restocks"; productIds: string[]; names: Map<string, string> }
  | { kind: "quiet"; dropCount: number };

export function greetingFor(hour: number): string {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function buildFeedItems(input: {
  alerts: PriceAlert[];
  products: Product[];
  awaySummary: AwaySummary | null;
  displayCurrency: string;
}): FeedItem[] {
  const { alerts, products, awaySummary, displayCurrency } = input;
  const items: FeedItem[] = [];

  const fired = alerts.filter((a) => a.triggeredAt != null);
  if (fired.length > 0) items.push({ kind: "alerts", alerts: fired });

  const drops = computeLocalDrops(products, "7d", displayCurrency, "pct", 3);
  if (drops.length > 0) items.push({ kind: "drops", drops });

  const restocks = awaySummary?.restocks ?? [];
  if (restocks.length > 0) {
    items.push({
      kind: "restocks",
      productIds: restocks.map((r) => r.productId),
      names: new Map(restocks.map((r) => [r.productId, r.name])),
    });
  }

  if (items.length === 0) {
    items.push({ kind: "quiet", dropCount: drops.length });
  }
  return items;
}
```

Before writing, verify: `AwayItem` shape in `lib/away-summary.ts` (confirm fields `productId` and `name` exist — lines 14-20 show `AwaySummary`; read the `AwayItem` interface to confirm). If fields differ, adapt.

- [ ] **Step 2: Write tests**

Create `tests/home-feed.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { greetingFor, buildFeedItems } from "../lib/home-feed";
import type { PriceAlert, Product } from "../lib/types";

const alert = (over: Partial<PriceAlert> = {}): PriceAlert => ({
  id: "a1", productId: "p1", targetPrice: 90, currency: "USD",
  isActive: true, createdAt: new Date().toISOString(), ...over,
});

describe("greetingFor", () => {
  it("returns time-of-day greetings", () => {
    expect(greetingFor(3)).toBe("Good night");
    expect(greetingFor(9)).toBe("Good morning");
    expect(greetingFor(14)).toBe("Good afternoon");
    expect(greetingFor(21)).toBe("Good evening");
  });
});

describe("buildFeedItems", () => {
  it("returns quiet when nothing to show", () => {
    expect(buildFeedItems({ alerts: [], products: [], awaySummary: null, displayCurrency: "USD" }))
      .toEqual([{ kind: "quiet", dropCount: 0 }]);
  });

  it("orders alerts before drops before restocks", () => {
    const now = Date.now();
    const older = new Date(now - 3 * 86400000).toISOString();
    const newer = new Date(now - 86400000).toISOString();
    const products = [{
      id: "p1", name: "W", modelNumber: "W1", brand: "T", category: "Switch",
      description: "", isWatched: true, addedAt: newer,
      listings: [{
        distributorId: "d1", distributorName: "D1", price: 70, currency: "USD",
        stockStatus: "in_stock", url: "", lastChecked: newer,
        priceHistory: [
          { date: older, price: 100, currency: "USD" },
          { date: newer, price: 70, currency: "USD" },
        ],
      }],
    } as unknown as Product];
    const items = buildFeedItems({
      alerts: [alert({ triggeredAt: newer })],
      products,
      awaySummary: { priceDrops: [], priceRises: [], restocks: [{ productId: "p1", name: "W" }], stockOuts: [], since: 0 } as any,
      displayCurrency: "USD",
    });
    expect(items.map((i) => i.kind)).toEqual(["alerts", "drops", "restocks"]);
  });

  it("omits empty sections", () => {
    const items = buildFeedItems({ alerts: [alert()], products: [], awaySummary: null, displayCurrency: "USD" });
    // alert without triggeredAt is not fired; nothing else -> quiet
    expect(items).toEqual([{ kind: "quiet", dropCount: 0 }]);
  });
});
```

Read `AwayItem` first — if `restocks` items need more required fields than `productId`/`name`, fill them in the fixture.

- [ ] **Step 3: Run tests + check**

Run: `pnpm exec vitest run tests/home-feed.test.ts && pnpm check`
Expected: all pass, 0 errors.

- [ ] **Step 4: Commit**

```bash
git add lib/home-feed.ts tests/home-feed.test.ts
git commit -m "feat(redesign): home feed helpers + tests"
```

---

### Task 2: Feed cards + Home rewire

**Files:**
- Create: `components/home/feed-card.tsx`
- Modify: `app/(tabs)/index.tsx`

- [ ] **Step 1: Study card patterns**

Skim `components/home/away-summary-card.tsx` (card container style) and `components/home/drop-leaderboard.tsx` (row style, chips, navigation). Copy the card container (surface bg, 16px radius, 14px padding, border).

- [ ] **Step 2: Create `components/home/feed-card.tsx`**

Four exported memo components, all themed via `useColors()`:

- `AlertFiredCard({ alerts, onView(productId), onRearm(alertId) })` — red accent left border (or red icon `bell.fill`), rows: product name (resolve via products map prop `names: Map<string,string>` — pass it in, don't fetch), old→new price if available (`triggeredPrice` + `targetPrice` from the alert), View + Re-arm buttons per row.
- `DropCard({ drops, onSeeAll })` — emerald accent, rows: name, distributor, green −% + muted −$, footer "See all →" → `/drops` (use `useRouter` inside, no prop needed).
- `RestockCard({ productIds, names, onView(productId) })` — green accent, rows: name + "Back in stock" + chevron. (Buy/visit action: deep-link to product detail where buy lives — do NOT add distributor URL resolution here.)
- `QuietCard({ dropCount })` — neutral: "All quiet ✅" + (dropCount > 0 ? `${dropCount} prices fell this week.` : "We'll let you know when something moves.").

Props must be plain data + callbacks (no storage access inside cards — Home screen loads data). Verify every IconSymbol name against the mapping.

- [ ] **Step 3: Rewire `app/(tabs)/index.tsx`**

Changes:
1. Imports: add `buildFeedItems`, `greetingFor` from `@/lib/home-feed`; feed cards; `getStockWatches`? No — restocks come from `awaySummary` (already loaded). Remove imports that become unused: `TrendingSection`, `AvailableSection`, `AwaySummaryCard`, `DropLeaderboard` (feed uses `computeLocalDrops` via helper, not the section component), stat-card bits, `AlertBadge`? (keep alert badge hook — tab badge stays).
2. State: add `alerts` full list state (currently only `alertCount` via `countActiveAlerts` — extend `loadData` to `setAlerts(list)` too).
3. Header: replace stat-card block with greeting row: `{greetingFor(new Date().getHours())}` 28px + existing gear button (keep gear from Plan A) + connection dot (keep `ConnectionBadge` if present in header; check).
4. Feed: `const items = useMemo(() => buildFeedItems({ alerts, products: watchlist, awaySummary, displayCurrency }), [...])`, render cards in order with handlers: `onView` → `router.push('/product/${id}')`, `onRearm` → `rearmAlert(id)` then reload (check `rearmAlert` import from storage — alerts screen uses it; copy pattern + toast).
5. Keep: watchlist preview block ("Your Watchlist", top 3, view-all) unchanged. Keep pull-to-refresh, loading/error/empty states, monitoring banner, FAB (if present — check; keep whatever exists below the feed).
6. Delete: stat cards block + animations (`statAnim0/1/2`, `StatCard` component if local), recent activity section + images loading effect (if unused after removal — remove or keep only if watchlist preview needs images; it doesn't), AwaySummaryCard block, Available/Trending/DropLeaderboard sections + their imports.

Careful: `loadData` currently sets `awaySummary` only when `seen != null && list.length > 0` — keep that logic (feed needs it for restocks). `awayDismissed` state can go (no dismiss on feed; quiet card is permanent).

- [ ] **Step 4: Run check + lint**

Run: `pnpm check && pnpm lint`
Expected: 0 errors. Remove newly-unused imports until clean.

- [ ] **Step 5: Commit**

```bash
git add components/home/feed-card.tsx "app/(tabs)/index.tsx"
git commit -m "feat(redesign): Home priority feed replaces dashboard"
```

---

### Task 3: Guards + todo.md + verify

**Files:**
- Create: `tests/home-feed-guard.test.ts`
- Modify: `todo.md`

- [ ] **Step 1: Create guard**

```typescript
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("home feed wiring", () => {
  it("home uses feed helpers and cards", () => {
    const src = read("app/(tabs)/index.tsx");
    expect(src).toContain("buildFeedItems");
    expect(src).toContain("feed-card");
  });

  it("stat cards and old sections are gone", () => {
    const src = read("app/(tabs)/index.tsx");
    expect(src).not.toContain("TrendingSection");
    expect(src).not.toContain("AvailableSection");
    expect(src).not.toContain("AwaySummaryCard");
  });

  it("feed helpers exist", () => {
    const src = read("lib/home-feed.ts");
    expect(src).toContain("buildFeedItems");
    expect(src).toContain("greetingFor");
  });

  it("feed cards exist", () => {
    const src = read("components/home/feed-card.tsx");
    expect(src).toContain("AlertFiredCard");
    expect(src).toContain("QuietCard");
  });
});
```

- [ ] **Step 2: Run tests + verify**

Run: `pnpm exec vitest run tests/home-feed.test.ts tests/home-feed-guard.test.ts`, then `pnpm check && pnpm lint`, then `pnpm verify` (exit 0; fix in-scope, BLOCKED otherwise).

- [ ] **Step 3: todo.md entry**

Next number (expect 1142):

```markdown
## Phase 1142: Redesign C — Home priority feed

- [x] `lib/home-feed.ts` (greetingFor, buildFeedItems) + tests.
- [x] Feed cards (alerts/drops/restocks/quiet) + Home rewire.
- [x] Stat cards, recent activity, away card, Available/Trending sections removed.
- [x] Watchlist preview kept. TypeScript: 0 errors.
```

- [ ] **Step 4: Commit**

```bash
git add tests/home-feed-guard.test.ts todo.md
git commit -m "test(redesign): home feed guards + Phase entry"
```

---

## Self-Review

**Spec coverage (§3):**
- ✅ Greeting header + gear (Task 2 — gear from Plan A kept)
- ✅ Alerts fired / big drops / restocks / all-quiet in order (Tasks 1-2)
- ✅ Watchlist preview kept (Task 2)
- ✅ Away-summary dissolved into feed (Task 2 — restocks from awaySummary; card removed)
- ✅ Trending/Available moved out (Task 2 — they live on Discover)
- ✅ Pull-to-refresh kept (Task 2)

**Placeholder scan:** None.

**Type consistency:** `FeedItem` kinds `alerts|drops|restocks|quiet` used consistently; `buildFeedItems({ alerts, products, awaySummary, displayCurrency })` signature matches tests and Home usage.
