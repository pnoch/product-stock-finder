# Desktop Compare + Shared Upgrades 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compare gains header actions, image export, and trend sort; shared rows show more listings with per-product history export.

**Architecture:** Ports of mobile logic (trend scoring verbatim) plus desktop-idiom buttons/download. All in Compare.tsx + SharedWatchlist.tsx. No server or mobile changes.

**Tech Stack:** React, html-to-image, vitest.

**Spec:** `docs/superpowers/specs/2026-09-06-desktop-compare-shared2-design.md`

---

### Task 1: Guard tests for compare/shared upgrades

**Files:**
- Create: `tests/desktop-compare-shared2.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop compare and shared upgrades", () => {
  it("navigates and refreshes comparisons", async () => {
    const text = await readFile("desktop/src/pages/Compare.tsx", "utf8");
    expect(text).toContain('to="/watchlist"');
    expect(text).toContain("loadCompare()");
  });

  it("exports chart images and sorts by trend", async () => {
    const text = await readFile("desktop/src/pages/Compare.tsx", "utf8");
    expect(text).toContain("toPng");
    expect(text).toContain('"trend"');
  });

  it("shows more listings and history export per shared product", async () => {
    const text = await readFile("desktop/src/pages/SharedWatchlist.tsx", "utf8");
    expect(text).toContain("productHistoryToCsv");
    expect(text).toContain(" more");
    expect(text).toContain("History exported");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/desktop-compare-shared2.test.ts 2>&1 | tail -4`
Expected: FAIL (3 failed — verify each string truly absent; `to="/watchlist"` especially must not already exist in Compare.tsx).

- [ ] **Step 3: Commit the failing tests**

```bash
git add tests/desktop-compare-shared2.test.ts
git commit -m "test: guard desktop compare and shared upgrades"
```

---

### Task 2: Compare header + not-found CTA

**Files:**
- Modify: `desktop/src/pages/Compare.tsx`

- [ ] **Step 1: Back + Refresh buttons**

Read the header block first (title/meta + TimeRangeChips row ~440-449). Add Back (`<Link to="/watchlist">` with back-arrow icon + `aria-label="Back to watchlist"`) and Refresh (`onClick={() => void loadCompare()}`, spinner while `loading`, `aria-label="Refresh comparison"`, disabled while loading) beside Share. `loadCompare` is a useCallback with no args — verify. Match sibling button classes.

- [ ] **Step 2: Not-found action**

Not-found `EmptyState` (title "Product not found"): add `action={{ label: "Back to watchlist", to: "/watchlist" }}` (prop exists — verified in SharedWatchlist work).

- [ ] **Step 3: Verify**

Run: `pnpm vitest run tests/desktop-compare-shared2.test.ts -t "navigates and refreshes"` (passes; others fail) and `pnpm check` (clean).

- [ ] **Step 4: Commit**

```bash
git add desktop/src/pages/Compare.tsx
git commit -m "Feat: desktop Compare header back/refresh and not-found CTA. TypeScript: 0 errors."
```

---

### Task 3: Chart image + trend sort

**Files:**
- Modify: `desktop/src/pages/Compare.tsx`

- [ ] **Step 1: Save-image button**

Read the chart container markup first. Attach `chartRef = useRef<HTMLDivElement>(null)` (check useRef import) without layout change. Add import `toPng` (specifier mirrors Stats.tsx — verify). Handler beside handleShareCompare:
```tsx
  const handleSaveImage = useCallback(async () => {
    if (!chartRef.current || !product) return;
    try {
      const dataUrl = await toPng(chartRef.current);
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `compare-${product.id}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast("Comparison image saved");
    } catch {
      showToast("Couldn't save comparison image");
    }
  }, [product]);
```
Verify showToast exists. Button "Save image" (`aria-label="Save comparison image"`) beside Share.

- [ ] **Step 2: Trend sort option**

Port mobile `priceTrends` memo verbatim (first→last per listing, `pct` abs, dir thresholds ±0.5, flat default):
```tsx
  const priceTrends = useMemo(() => {
    const map = new Map<string, { pct: number; dir: "up" | "down" | "flat" }>();
    for (const l of sortedListings /* or product.listings — read mobile line 211-229: iterates `listings`; use the same source desktop sortedListings derives from */) {
      ...
    }
    return map;
  }, [listings]);
```
Read mobile lines 211-229 fully first and mirror (input array + scoring + sort comparator at 251-261). Extend `sortBy` union with `"trend"` + add branch in `sortedListings` (score: down→+pct, up→−pct, else 0; descending). Add "Trend" option to the sort UI (read its markup — buttons or select; keep default unchanged).

- [ ] **Step 3: Verify**

Run: guard `-t "exports chart images"` (passes) + `pnpm check` (clean) + workdir `desktop/` `pnpm build` (exit 0 — toPng already bundled, but confirm).

- [ ] **Step 4: Commit**

```bash
git add desktop/src/pages/Compare.tsx
git commit -m "Feat: desktop Compare chart image export and trend sort. TypeScript: 0 errors."
```

---

### Task 4: Shared rows + history export

**Files:**
- Modify: `desktop/src/pages/SharedWatchlist.tsx`

- [ ] **Step 1: Up to 5 listings + overflow**

Read the row render first (first-listing price + distributor + badge + Add button). Replace single-listing display with `p.listings.slice(0, 5)` map of the same row content, plus `{p.listings.length > 5 && (<p className="...muted">+{p.listings.length - 5} more</p>)}`. Keep best-price header as-is. Add `productHistoryToCsv` import from `"../../../lib/csv"` (verify export in lib/csv.ts).

- [ ] **Step 2: Per-product export + meta labels**

Per card: "Export history" button (`aria-label="Export {name} history"`? keep simple `aria-label="Export product history"`):
```tsx
const csv = productHistoryToCsv(p as never); // match mobile call shape (mobile passes product; check its import type — cast as needed like mobile does)
download `{p.id}-history.csv` via Blob+anchor (Stats pattern), toast "History exported".
```
Meta line: read share data fields first (`createdAt`/`expiresAt` known; find the shared/last-shared field — SharedData interface in file). Render "Shared {date} · Last shared {date} · Expires {date}" omitting missing parts (guard each with existence checks; date via toLocaleDateString like existing expiry line).

- [ ] **Step 3: Verify**

Run: full guard file (all 3 pass) + `pnpm check` (clean).

- [ ] **Step 4: Commit**

```bash
git add desktop/src/pages/SharedWatchlist.tsx
git commit -m "Feat: desktop shared rows show more listings with history export. TypeScript: 0 errors."
```

---

### Task 5: Full verification + push

**Files:** none (verification only)

- [ ] **Step 1: Lint + full suite**

`pnpm lint` (0 errors, no new warnings in the 2 touched files), `pnpm test` (all pass, 0 failures).

- [ ] **Step 2: Desktop build**

Workdir `desktop/`: `pnpm build` (exit 0).

- [ ] **Step 3: Push**

`git push origin main` (`main -> main`), `git status --short` empty.
