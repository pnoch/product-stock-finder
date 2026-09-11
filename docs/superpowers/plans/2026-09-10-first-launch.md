# First-Launch Bundle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fresh desktop installs boot useful (seeded products, running poller, warm FX) and discovery matches mobile ordering.

**Architecture:** Mirror mobile logic verbatim into App mount + pages; extract one pure preview helper to `lib/` used by both platforms.

**Tech Stack:** React, vitest root (`pnpm test`) + desktop (`desktop/ pnpm test`), `pnpm check`, `pnpm lint`.

---

### Task 1: App launch sequence

**Files:**
- Modify: `desktop/src/App.tsx` (mount effect)
- Test: `desktop/tests/app-launch.test.tsx` (new — but rendering full App may be impractical; see Step 1)

Verified facts (re-confirm; NEEDS_CONTEXT on mismatch): desktop `storage` is the shared `createStorage` factory → `getWatchlist/addToWatchlist/updateProductListings` exist with mobile-identical signatures; `PRODUCT_CATALOG` from `@shared/catalog`, `SAMPLE_LISTINGS` + `freshenSampleListings` from `lib/sample-data` (verify specifiers: desktop already imports `@shared/catalog`; `lib/sample-data` imports? check for RN deps first — if it pulls expo/RN, fall back to `../../../lib/sample-data` only if build-clean, else NEEDS_CONTEXT); Settings poller effect (`Settings.tsx:61-84`) is the start/stop pattern to mirror; `loadFxRates/maybeRefreshFxRates(storage?)` from `lib/fx` (defaultStorage param — pass desktop `storage` if type-compatible, else default; verify).

- [ ] **Step 1: Assess App testability FIRST**

Try rendering `<App />` in jsdom with mocked storage/tRPC/Tauri (read App.tsx fully: providers, router, effects). If a full render is practical, write behavioral tests (seed-on-empty: empty watchlist → 7 products added; skip: pre-seeded → no writes; poller: non-manual → startPricePoller called; manual → not; FX: loadFxRates attempted). If full-App render is impractical (effect cascade, provider weight), STOP → NEEDS_CONTEXT with specifics (do not write a white-box grep test as the deliverable — but DO propose the fallback: extract `runLaunchSequence()` pure-ish function into `desktop/src/lib/launch.ts` and test THAT behaviorally with mocked deps).

- [ ] **Step 2: Implement** (only after Step 1 resolves — either inline in App or the extracted module; same logic):

```tsx
// seed (verbatim mobile, incl. SEED_IDS + MikroTik backfill + per-id try/catch + [Seed] log)
async function seedProducts() { ... }
// poller (mirror Settings effect start half):
const settings = await storage.getSettings();
if (settings?.checkInterval && settings.checkInterval !== "manual") {
  const minutes = settings.checkInterval === "hourly" ? 60 : 1440;
  try { await startPricePoller(minutes, getApiBaseUrl()); }
  catch (e) { console.error("[App] launch poller start failed", e); }
}
// fx (best-effort):
try { await loadFxRates(storage); await maybeRefreshFxRates(storage); }
catch (e) { console.error("[App] fx warm failed", e); }
```

All three fire-and-forget inside one mount effect (or the extracted module called from it); none blocks boot; none throws (each guarded). Settings page keeps managing later interval changes (no change there).

- [ ] **Step 3: Verify**

Run: new suite PASS; `pnpm check` (root, 0 errors); `pnpm build` (desktop, exit 0 — proves `lib/sample-data` + `lib/fx` bundle-clean; if the build fails on transitive RN imports, fall back per Step 1's NEEDS_CONTEXT rule... no — fallback: import ONLY the needed pure functions; if still dirty, report BLOCKED with the exact import chain).
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add desktop/src/App.tsx desktop/tests/app-launch.test.tsx (or desktop/src/lib/launch.ts + its test — verify via git status, stage exactly touched files)
git commit -m "Feat: desktop first-launch seeding, poller, FX warm. TypeScript: 0 errors."
```

---

### Task 2: Shared preview ordering

**Files:**
- Create: `lib/search-preview.ts`
- Modify: `app/search.tsx` (adopt)
- Modify: `desktop/src/pages/Search.tsx` (adopt for empty query)
- Test: `tests/search-preview.test.ts` (new root)

Verified facts: mobile `previewStockScore` (SAMPLE_LISTINGS in-stock×10 + listings) + `sortPreviewByStock` + `PREVIEW_LIMIT = 10` at app/search.tsx:41-55; mobile empty-query paths at :257/:260 (`sortPreviewByStock(...).slice(0, PREVIEW_LIMIT)`); desktop `results` at Search.tsx:148-159 (no slice; `base = combinedCatalog` when query empty). `SAMPLE_LISTINGS` importable from `lib/sample-data` on mobile already (search.tsx uses it — verify specifier).

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { sortPreviewByStock, PREVIEW_LIMIT } from "../lib/search-preview";

describe("preview ordering", () => {
  it("caps at 10 and weights in-stock first", () => {
    expect(PREVIEW_LIMIT).toBe(10);
    // craft items with ids present/absent in SAMPLE_LISTINGS? That couples to catalog data.
    // Better: unit-test with stubbed listings? previewStockScore reads SAMPLE_LISTINGS directly (like mobile).
    // Pragmatic: assert sortPreviewByStock(PRODUCT_CATALOG).length <= 10 + first item has listings.
  });
});
```

Concretely: import `PRODUCT_CATALOG`, assert `sortPreviewByStock(PRODUCT_CATALOG)` returns ≤10 items, is sorted non-increasing by score (recompute score via the module's exported `previewStockScore` — export it for testability), and doesn't mutate the input. Export all three (`previewStockScore`, `sortPreviewByStock`, `PREVIEW_LIMIT`).

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm vitest run tests/search-preview.test.ts` (root)
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write minimal implementation** (`lib/search-preview.ts` — move mobile's three verbatim, importing SAMPLE_LISTINGS from `./sample-data`):

```ts
import { SAMPLE_LISTINGS } from "./sample-data";

export const PREVIEW_LIMIT = 10;

export function previewStockScore(productId: string): number {
  const listings = SAMPLE_LISTINGS[productId] ?? [];
  if (listings.length === 0) return 0;
  const inStock = listings.filter((l) => l.stockStatus === "in_stock").length;
  return inStock * 10 + listings.length;
}

export function sortPreviewByStock<T extends { id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => previewStockScore(b.id) - previewStockScore(a.id));
}
```

Mobile `app/search.tsx`: delete locals, import from `@/lib/search-preview` (verify alias form in that file). Desktop `Search.tsx`: empty-query branch becomes `base = sortPreviewByStock(combinedCatalog).slice(0, PREVIEW_LIMIT)` — WAIT: mobile slices `combined` (watchlist-aware combined catalog) at :260 and bare `PRODUCT_CATALOG` at :257. Read both mobile lines + desktop's `combinedCatalog` construction first; mirror: desktop's empty-query `base = combinedCatalog` → `sortPreviewByStock(combinedCatalog).slice(0, PREVIEW_LIMIT)` (check whether desktop has the two-path structure or one — adapt faithfully, don't force).

- [ ] **Step 4: Run to verify**

Run: `pnpm vitest run tests/search-preview.test.ts` + mobile search suites (grep tests for search-preview/app-search coverage — run any found); `pnpm check` (root, 0 errors); `pnpm build` (desktop, exit 0).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/search-preview.ts tests/search-preview.test.ts app/search.tsx desktop/src/pages/Search.tsx
git commit -m "Refactor: shared search preview ordering. TypeScript: 0 errors."
```

---

### Task 3: Activity dedup + restock CTA

**Files:**
- Modify: `desktop/src/pages/Home.tsx` (recentActivity)
- Modify: `desktop/src/pages/RestockWatches.tsx` (empty CTA)
- Test: `desktop/tests/home-activity.test.tsx` (new; or extend home-refresh.test.tsx if its harness renders Home cheaply — read first)

Verified facts (re-confirm): desktop activity at Home.tsx:155-168 (flatMap→sort→slice 5); mobile at app/(tabs)/index.tsx:204-226 (per-product freshest + slice 5 + recentIdsKey — the key is for a downstream effect? read surrounding code: `recentIdsKey` feeds what? If it drives a refresh effect, desktop may not need it — port ONLY the collapse logic, not the key, unless the key serves the memo itself); desktop CTA at RestockWatches.tsx:80-93 (`to="/watchlist"`, "Browse watchlist"); mobile at restock-watches.tsx:103-114 (`router.push("/search")`, "Browse Products").

- [ ] **Step 1: Write the failing tests**

```tsx
it("shows five distinct products in recent activity", async () => {
  // Home with ONE product carrying 5 fresh listings + others stale;
  // assert 5 distinct product names rendered in the activity section.
});
it("restock empty state links to search", async () => {
  // render RestockWatches empty; assert link to="/search" with "Browse Products"; no link to watchlist in the empty state.
});
```

Reuse cheapest harnesses (home-refresh for Home; check for a RestockWatches render test or write minimal with mocked storage).

- [ ] **Step 2: Run to verify they fail**

Run: new suite(s) (workdir: `desktop/`)
Expected: FAIL — one product fills feed; CTA points to watchlist.

- [ ] **Step 3: Write minimal implementation**

Home: replace flatMap block with per-product freshest collapse verbatim mobile (product with no listings → addedAt fallback? mobile includes listing:null fallback — desktop ActivityRow expects listing? read ActivityRow first: if it requires non-null listing, keep desktop's shape `{product, listing}` but pick freshest per product then slice 5 (drop the null-fallback only if ActivityRow can't render it — verify)).

RestockWatches: `to="/watchlist"` → `to="/search"`, "Browse watchlist" → "Browse Products" (verbatim mobile copy).

- [ ] **Step 4: Run to verify**

Run: new suite(s) (desktop); `pnpm check` (root, 0 errors).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/pages/Home.tsx desktop/src/pages/RestockWatches.tsx <test files> (verify via git status)
git commit -m "Fix: distinct activity feed and restock CTA target. TypeScript: 0 errors."
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
