# Small Correctness Leftovers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One search-chrome module, collision-safe ids, currency-correct trends, region rows with native prices — no behavior change otherwise.

**Architecture:** Extract to `desktop/src/components/`; shared id suffix; convert-before-diff; render native + converted.

**Tech Stack:** React, vitest desktop (`desktop/ pnpm test`), `pnpm check`, `pnpm lint`.

**Sweep correction (verified):** Compare's per-distributor trend (`Compare.tsx:351-356`) already guards `oldest > 0` — only ProductDetail's `trendSignal` needs the guard. No Compare trend change.

---

### Task 1: Shared search chrome

**Files:**
- Create: `desktop/src/components/search-chrome.tsx` (name: check for an existing fitting module first — `CatalogSort`? `PillFilterRow`? — create only if none fits; `search-chrome.tsx` it is unless a better home exists)
- Modify: `desktop/src/pages/Search.tsx` (delete locals ~19-78, import)
- Modify: `desktop/src/components/SearchModal.tsx` (delete locals ~17-75, import)
- Test: `desktop/tests/search-chrome-guard.test.ts` (new root? No — desktop test asserting single definition? Simplest: root string-guard `tests/desktop-search-chrome-guard.test.ts` asserting both files import the module and define no local `PillFilterRow`/`CATALOG_SORT_OPTIONS`)

Verified facts (re-confirm): byte-identical `loadRecent/saveRecent/recordRecent` (recent-searches core), `CatalogSort` + `CATALOG_SORT_OPTIONS`, `PillFilterRow` in both files; aria-labels differ ("Category All" vs none — sweep) — read BOTH variants first and keep the more accessible one (with `${label} All` / `${label} ${opt}` labels).

- [ ] **Step 1: Write the failing guard**

```ts
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("shared search chrome", () => {
  for (const f of ["desktop/src/pages/Search.tsx", "desktop/src/components/SearchModal.tsx"]) {
    it(`${f} imports shared chrome`, async () => {
      const text = await readFile(f, "utf8");
      expect(text).toContain("search-chrome");
      expect(text).not.toContain("function PillFilterRow");
      expect(text).not.toContain("CATALOG_SORT_OPTIONS =");
    });
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run tests/desktop-search-chrome-guard.test.ts` (root)
Expected: FAIL — locals defined inline.

- [ ] **Step 3: Write minimal implementation** — move (not copy) the three units + `RECENT_KEY`? (`loadRecent/saveRecent/recordRecent` wrap shared core + localStorage — move whole, they have no page deps; verify no page-specific references inside first) + `CatalogSort` type + `CATALOG_SORT_OPTIONS` + `PillFilterRow` into `search-chrome.tsx`, exporting all. Both files import them (specifiers: pages/ → `../components/search-chrome`; modal is IN components/ → `./search-chrome` — verify). Keep the better aria-labels.

- [ ] **Step 4: Run to verify**

Run: guard (root); `pnpm test search` (desktop — all search/modal suites); `pnpm check` (root, 0 errors); `pnpm build` (desktop, exit 0).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/components/search-chrome.tsx desktop/src/pages/Search.tsx desktop/src/components/SearchModal.tsx tests/desktop-search-chrome-guard.test.ts
git commit -m "Refactor: shared search chrome module. TypeScript: 0 errors."
```

---

### Task 2: Id suffixes + currency-correct trend

**Files:**
- Modify: `desktop/src/pages/ProductDetail.tsx` (4 id sites :492/:554/:619/:649, trendSignal :348-358)
- Test: extend `desktop/tests/best-price-signals.test.tsx`? No — trend tests live there? (best-price-signals covers trend badge — extend it with mixed-currency + zero-price cases.) Id uniqueness: extend the double-tap test pattern? That was alerts; add reminder/watch double-create test wherever reminder tests live (grep first — `desktop/tests/` for reminder/watch suites; if none cheap, fold into best-price-signals? Wrong theme... check `ux-alignment` (renders Alerts, not creation). Decision: add cases to the most fitting existing suite found by grep; if none fits, new `desktop/tests/creation-ids.test.tsx`.)

Verified facts (re-confirm): bare `` `reminder-${Date.now()}` `` ×2, `` `watch-${Date.now()}` `` ×2; alert uses `` `alert-${Date.now()}-${random6}` `` (commit a9c1a2e — copy its exact suffix idiom `Math.random().toString(36).slice(2, 8)`); trendSignal raw-price + unguarded.

- [ ] **Step 1: Write the failing tests**

```tsx
it("mints distinct reminder ids on rapid double-create", async () => {
  // freeze Date.now; create reminder twice; assert different ids.
});
it("computes trend in display currency", async () => {
  // history [{100 EUR}, {110 USD-as-EUR?...}] — craft: oldest 100 EUR, current 90 EUR... mixed: oldest {price: 100, currency: "EUR"}, current {price: 20000, currency: "JPY"} with display USD → trend from converted values; assert pct matches converted math, not raw.
});
it("renders no trend for zero-price history", async () => {
  // oldest price 0 → no badge (no Infinity%).
});
```

- [ ] **Step 2: Run to verify they fail**

Run: chosen suite(s) (workdir: `desktop/`)
Expected: FAIL — colliding ids; raw-currency pct; `▲ Infinity%`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// 4 sites:
id: `reminder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
id: `watch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
```

Copy the alert idiom verbatim. (No shared helper — 4 one-line sites + alert precedent; extracting a helper for 5 one-liners is over-abstraction. If a reviewer disagrees, note it.)

```tsx
const trendSignal = useMemo(() => {
  const hist = bestListing?.priceHistory;
  if (!hist || hist.length < 2) return null;
  const sorted = [...hist].sort((a, b) => +new Date(a.date) - +new Date(b.date));
  const oldest = convertPrice(sorted[0].price, sorted[0].currency, displayCurrency);
  const current = convertPrice(sorted[sorted.length - 1].price, sorted[sorted.length - 1].currency, displayCurrency);
  if (oldest === null || current === null || oldest <= 0) return null;
  if (current === oldest) return null;
  const pct = Math.round((Math.abs(oldest - current) / oldest) * 100);
  const down = current < oldest;
  return { down, pct };
}, [bestListing, displayCurrency]);
```

Verify `convertPrice` + `displayCurrency` in scope (both used by neighboring headerConversion — yes). Deps: `[bestListing, displayCurrency]` matches sibling memos.

- [ ] **Step 4: Run to verify**

Run: chosen suite(s) (desktop); `pnpm check` (root, 0 errors).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/pages/ProductDetail.tsx <test files> (verify via git status)
git commit -m "Fix: unique creation ids and currency-correct trend. TypeScript: 0 errors."
```

---

### Task 3: Region rows with native prices

**Files:**
- Modify: `desktop/src/pages/Compare.tsx` (region rows ~560-585)
- Test: extend `desktop/tests/compare-region.test.tsx` (read it first)

Verified facts (re-confirm): rows show `{region, flag, name, formatPrice(converted)}`; mobile shows native + `≈ converted`; `item.listing.price/currency` available; `formatPrice` in scope.

- [ ] **Step 1: Write the failing test** (append):

```tsx
it("shows native price alongside converted", async () => {
  // EUR listing + USD display → row contains native "€80"-ish AND converted "$86.96"-ish (use the existing fixture's real numbers — read them first).
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test compare-region` (workdir: `desktop/`)
Expected: FAIL — converted only.

- [ ] **Step 3: Write minimal implementation**

```tsx
<span className="...">
  {formatPrice(item.listing.price, item.listing.currency)}
  {item.listing.currency !== displayCurrency && (
    <> ≈ {formatPrice(item.converted, displayCurrency)}</>
  )}
</span>
```

Mirror the listing-row idiom (ProductDetail `≈` pattern). Keep BEST highlight/empty state untouched.

- [ ] **Step 4: Run to verify**

Run: `pnpm test compare-region` (desktop); `pnpm check` (root, 0 errors).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/pages/Compare.tsx desktop/tests/compare-region.test.tsx
git commit -m "Feat: native prices on region rows. TypeScript: 0 errors."
```

---

### Final verification (all tasks)

```bash
pnpm check          # expect: 0 errors
pnpm lint           # expect: 0 errors
pnpm test           # expect: 0 failures (root)
pnpm test           # workdir desktop/ — expect: 0 failures
pnpm build          # workdir desktop/ — expect: exit 0
```

Do NOT push. Report DONE (per-task outcome + verification counts) or BLOCKED/NEEDS_CONTEXT.
