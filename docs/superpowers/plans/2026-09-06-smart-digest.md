# Smart Digest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Digest cards rank top deals with a best-time-to-buy section on both platforms.

**Architecture:** Pure `rankDeals` helper (unit-tested) + sections in both digest cards with identical strings. No server changes.

**Tech Stack:** TypeScript, vitest.

**Spec:** `docs/superpowers/specs/2026-09-06-smart-digest-design.md`

---

### Task 1: Ranking helper + tests

**Files:**
- Modify: `lib/deal-score.ts`
- Create: extend `tests/deal-score.test.ts` (append — do NOT create a second file)

- [ ] **Step 1: Write the failing tests**

Append to `tests/deal-score.test.ts` (read its fixture style first and reuse):
```ts
describe("rankDeals", () => {
  it("ranks by score desc, drops nulls, honors limit", async () => {
    const { rankDeals } = await import("../lib/deal-score");
    ...build 3 products: hot (falling to low, 90d span), fair (flat mid), unscorable (<3 points)...
    const ranked = rankDeals(products, "USD", 2);
    expect(ranked).toHaveLength(2);
    expect(ranked[0].productId).toBe("hot-id");
    expect(ranked[0]).toMatchObject({ name: expect.any(String), band: "hot" });
    expect(ranked.map((r) => r.productId)).not.toContain("thin-id");
  });

  it("returns [] when nothing scores", async () => {
    const { rankDeals } = await import("../lib/deal-score");
    expect(rankDeals([], "USD")).toEqual([]);
  });
});
```
(Static import at top is fine too — use whichever matches the file's existing style; read first.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/deal-score.test.ts 2>&1 | tail -3`
Expected: FAIL (rankDeals missing).

- [ ] **Step 3: Implement the helper**

Append to `lib/deal-score.ts`:
```ts
export interface RankedDeal {
  productId: string;
  name: string;
  score: number;
  band: DealBand;
}

export function rankDeals(products: Product[], currency: string, limit = 3): RankedDeal[] {
  return products
    .map((p) => ({ product: p, result: computeDealScore(p.listings ?? [], currency) }))
    .filter((e): e is { product: Product; result: DealScore } => e.result !== null)
    .sort((a, b) => b.result.score - a.result.score)
    .slice(0, limit)
    .map((e) => ({
      productId: e.product.id,
      name: e.product.name,
      score: e.result.score,
      band: e.result.band,
    }));
}
```
`Product` type import exists in the file already (used by computeDealScore? It takes listings — check imports; add `import type { Product }` if missing).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/deal-score.test.ts` (all pass) + `pnpm check` (clean).

- [ ] **Step 5: Commit**

```bash
git add lib/deal-score.ts tests/deal-score.test.ts
git commit -m "Feat: deal ranking helper with unit tests. TypeScript: 0 errors."
```

---

### Task 2: Digest sections both platforms

**Files:**
- Modify: `components/stats/digest-card.tsx`, `desktop/src/pages/Stats.tsx`
- Test: `tests/desktop-smart-digest.test.ts` (new guard)

- [ ] **Step 1: Write the failing guard**

```ts
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("smart digest", () => {
  it("ranks best time to buy in both digest cards", async () => {
    const mobile = await readFile("components/stats/digest-card.tsx", "utf8");
    const desktop = await readFile("desktop/src/pages/Stats.tsx", "utf8");
    expect(mobile).toContain("Best time to buy");
    expect(desktop).toContain("Best time to buy");
    expect(mobile).toContain("rankDeals");
    expect(desktop).toContain("rankDeals");
  });
});
```
Run to confirm FAIL, but do NOT commit yet (commit with implementation in step 4).

- [ ] **Step 2: Mobile section**

Read `components/stats/digest-card.tsx` props first (receives result? watchlist? displayCurrency?). Compute `rankDeals(watchlist, displayCurrency)` — if the card lacks watchlist, compute in `app/stats.tsx` and pass as prop (read both first; prefer computing in stats screen and passing `topDeals` prop to keep the card presentational — check how result/summary flow first and mirror). Render after summary, before change lists:
```tsx
{topDeals.length > 0 && (
  <>
    <Text ...section header style...>
      Best time to buy
    </Text>
    {topDeals.map((d) => (
      <TouchableOpacity key={d.productId} onPress={() => router.push(`/product/${d.productId}`)} ...row style...>
        <Text ...name flex...>{d.name}</Text>
        <Text ...score...>{d.score}</Text>
        <Text ...band chip...>{d.band === "hot" ? "Hot deal" : d.band === "fair" ? "Fair price" : "Wait"}</Text>
      </TouchableOpacity>
    ))}
  </>
)}
```
Mirror sibling row styles exactly (read the priceChanges rows). Verify `router` import (expo-router — check file; add if missing). Band copy must match deal card strings ("Hot deal" etc. — same as detail card).

- [ ] **Step 3: Desktop section**

In the desktop digest card area: same strings, rows as `Link to={\`/product/${d.productId}\`}`. Compute via `rankDeals` memo off products (verify products/displayCurrency names in Stats.tsx).

- [ ] **Step 4: Verify + commit**

Run: guard file (passes) + `pnpm check` (clean) + workdir `desktop/` `pnpm build` (exit 0).
```bash
git add components/stats/digest-card.tsx desktop/src/pages/Stats.tsx "app/stats.tsx" tests/desktop-smart-digest.test.ts
```
(Include `app/stats.tsx` ONLY if step 2 computed there — check `git status` and stage exactly what's changed.)
```bash
git commit -m "Feat: best-time-to-buy ranking in both digest cards. TypeScript: 0 errors."
```

---

### Task 3: Full verification + push

**Files:** none (verification only)

- [ ] **Step 1: Lint + full suite**

`pnpm lint` (0 errors, no new warnings in touched files), `pnpm test` (all pass, 0 failures).

- [ ] **Step 2: Desktop build**

Workdir `desktop/`: `pnpm build` (exit 0).

- [ ] **Step 3: Push**

`git push origin main` (`main -> main`), `git status --short` empty.
