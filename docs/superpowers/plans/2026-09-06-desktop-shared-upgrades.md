# Desktop Shared Upgrades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shared watchlist page gains retry, display-currency pricing, per-item add, and CSV export.

**Architecture:** All in `desktop/src/pages/SharedWatchlist.tsx` (143 lines, fully read): extract an `addOne` helper reused by bulk + per-card buttons; display currency from settings; refetch on the existing query; CSV via pure `lib/csv.ts`. No server or mobile changes.

**Tech Stack:** React, vitest.

**Spec:** `docs/superpowers/specs/2026-09-06-desktop-shared-upgrades-design.md`

---

### Task 1: Guard tests for shared upgrades

**Files:**
- Create: `tests/desktop-shared-upgrades.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop shared upgrades", () => {
  it("retries failed share fetches", async () => {
    const text = await readFile("desktop/src/pages/SharedWatchlist.tsx", "utf8");
    expect(text).toContain("refetch");
    expect(text).toContain("Retry");
  });

  it("prices in display currency with per-item add", async () => {
    const text = await readFile("desktop/src/pages/SharedWatchlist.tsx", "utf8");
    expect(text).toContain("displayCurrency");
    expect(text).toContain("Add ");
  });

  it("exports CSV", async () => {
    const text = await readFile("desktop/src/pages/SharedWatchlist.tsx", "utf8");
    expect(text).toContain("watchlistToDetailedCsv");
    expect(text).toContain("shared-");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/desktop-shared-upgrades.test.ts 2>&1 | tail -4`
Expected: FAIL (3 failed — verify each string is truly absent; "Add " with trailing space must not match "Add all"/"Added" accidentally... "Add all to watchlist" CONTAINS "Add " (Add+space)! The per-item test would PASS trivially. Fix: assert `aria-label="Add to watchlist"` instead — the per-card button will carry that exact label (bulk keeps "Add all to watchlist"). Corrected assertion:
```ts
    expect(text).toContain('aria-label="Add to watchlist"');
```
Use this corrected version (write it this way from the start).

- [ ] **Step 3: Commit the failing tests**

```bash
git add tests/desktop-shared-upgrades.test.ts
git commit -m "test: guard desktop shared page upgrades"
```

---

### Task 2: Retry + currency + per-item add + CSV

**Files:**
- Modify: `desktop/src/pages/SharedWatchlist.tsx`

- [ ] **Step 1: Display currency + addOne extraction**

Add state + loader (after existing state):
```tsx
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    storage
      .getSettings()
      .then((s) => setDisplayCurrency(s.displayCurrency ?? "USD"))
      .catch(() => {});
  }, []);
```
Add `useEffect` to the react import (currently `useCallback, useState`). Extract helper (place above `handleAddAll`):
```tsx
  const addOne = useCallback(async (p: unknown): Promise<boolean> => {
    try {
      await storage.addToWatchlist(normalizeSharedWatchlistProduct(p));
      return true;
    } catch {
      return false;
    }
  }, []);
```
Rewrite `handleAddAll` loop body to use it:
```tsx
    for (const p of products) {
      if (await addOne(p)) {
        added += 1;
        setAddedIds((prev) => new Set(prev).add((p as SharedProduct).id));
      } else {
        failed += 1;
      }
    }
```
Hmm — `products` is `unknown[]` (`data?.products ?? []`); existing code passes `p` directly to normalize. Keep types as-is (mirror existing): loop `for (const p of products)` where products: unknown[]; `(p as SharedProduct).id` for the set. Verify exact current typings by reading (lines 44-62 shown above: `data?.products ?? []`, `normalizeSharedWatchlistProduct(p)`).

- [ ] **Step 2: Best price in display currency**

Replace line 117:
```tsx
            const best = first ? getBestPrice(p.listings ?? [], first.currency) : null;
```
with:
```tsx
            const best = first ? getBestPrice(p.listings ?? [], displayCurrency) : null;
```
(`getBestPrice` already imported from `@/lib/currency`; `first` still drives distributor name + StockBadge.)

- [ ] **Step 3: Per-card Add button**

In the card (after the price row div, still inside the card container): add
```tsx
                <button
                  onClick={async () => {
                    if (await addOne(p)) {
                      setAddedIds((prev) => new Set(prev).add(p.id));
                      showToast(`Added ${p.name}.`);
                    } else {
                      showToast(`Couldn't add ${p.name}.`);
                    }
                  }}
                  disabled={addedIds.has(p.id)}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                  aria-label="Add to watchlist"
                >
                  {addedIds.has(p.id) ? "Added ✓" : "Add"}
                </button>
```
`p` is `SharedProduct` (has id/name) in the map — verify. Bulk-added ids also land in `addedIds` (step 1) so cards reflect bulk adds.

- [ ] **Step 4: Retry + CSV export**

Error block: after the error `<p>`, add (only when a query ran — i.e. `token` truthy; the block already handles !token):
```tsx
        <div className="flex items-center gap-3">
          {token && (
            <button
              onClick={() => void query.refetch()}
              disabled={query.isFetching}
              className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
              aria-label="Retry loading share"
            >
              {query.isFetching ? "Retrying" : "Retry"}
            </button>
          )}
          <Link to="/watchlist" ...existing Back link...>
        </div>
```
Restructure minimally: wrap existing Back link + new Retry in the flex div (read exact block lines 72-82 first).
CSV: add import `import { watchlistToDetailedCsv } from "../../../lib/csv";` (verify lib/csv.ts has no expo/RN imports first — it is pure formatting; if it imports anything non-portable, NEEDS_CONTEXT). Handler beside handleAddAll:
```tsx
  const handleExportCsv = useCallback(() => {
    const products = (data?.products ?? []) as SharedProduct[];
    const csv = watchlistToDetailedCsv(products as never[]);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shared-${token ?? "watchlist"}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Share exported as CSV");
  }, [data, token]);
```
Check `watchlistToDetailedCsv` input type in lib/csv.ts (takes Product[]? use the same cast style mobile uses: `watchlistToDetailedCsv(rawProducts as Product[])` — mirror with `as unknown as Product[]` if needed; verify Product import or use existing SharedProduct→cast). Add "Export CSV" button beside Add-all (secondary/outline style, `aria-label="Export CSV"`).
Toast message: `"Share exported as CSV"`.

- [ ] **Step 5: Verify**

Run: `pnpm vitest run tests/desktop-shared-upgrades.test.ts` (all 3 pass) and `pnpm check` (clean).

- [ ] **Step 6: Commit**

```bash
git add desktop/src/pages/SharedWatchlist.tsx
git commit -m "Feat: desktop shared page retry, display currency, per-item add, CSV export. TypeScript: 0 errors."
```

---

### Task 3: Full verification + push

**Files:** none (verification only)

- [ ] **Step 1: Lint + full suite**

`pnpm lint` (0 errors, no new warnings in SharedWatchlist.tsx), `pnpm test` (all pass, 0 failures).

- [ ] **Step 2: Desktop build**

Workdir `desktop/`: `pnpm build` (exit 0).

- [ ] **Step 3: Push**

`git push origin main` (`main -> main`), `git status --short` empty.
