# Desktop P2 Watchlist Actions + Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desktop Watchlist gains Share, Check-Now, persisted In-stock + price-range filters, and an empty-state CTA.

**Architecture:** All work in `desktop/src/pages/Watchlist.tsx` (+ optional action prop on `EmptyState`), reusing mobile's helpers (`buildWatchlistShareText`, `checkPriceDropsNow`, settings keys) adapted to desktop idioms (clipboard, toasts, Tailwind). New filters extend the existing inline `filtered` memo (not the shared `filterWatchlist` helper — switching would change query semantics). No server or mobile changes.

**Tech Stack:** React, react-router, vitest.

**Spec:** `docs/superpowers/specs/2026-09-06-desktop-p2-watchlist-design.md`

---

### Task 1: Guard tests for P2 watchlist

**Files:**
- Create: `tests/desktop-p2-watchlist.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop P2 watchlist", () => {
  it("has a share action", async () => {
    const text = await readFile("desktop/src/pages/Watchlist.tsx", "utf8");
    expect(text).toContain("buildWatchlistShareText");
  });

  it("has a check-now price scan", async () => {
    const text = await readFile("desktop/src/pages/Watchlist.tsx", "utf8");
    expect(text).toContain("checkPriceDropsNow");
  });

  it("persists in-stock and price-range filters", async () => {
    const text = await readFile("desktop/src/pages/Watchlist.tsx", "utf8");
    expect(text).toContain("watchlistInStockOnly");
    expect(text).toContain("watchlistPriceRange");
  });

  it("links the empty state to search", async () => {
    const text = await readFile("desktop/src/pages/Watchlist.tsx", "utf8");
    expect(text).toContain('to="/search"');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/desktop-p2-watchlist.test.ts 2>&1 | tail -4`
Expected: FAIL (4 failed).

- [ ] **Step 3: Commit the failing tests**

```bash
git add tests/desktop-p2-watchlist.test.ts
git commit -m "test: guard desktop P2 watchlist actions and filters"
```

---

### Task 2: Share action + empty-state CTA

**Files:**
- Modify: `desktop/src/pages/Watchlist.tsx`, `desktop/src/components/EmptyState.tsx`

- [ ] **Step 1: Extend EmptyState with an optional action**

Read `desktop/src/components/EmptyState.tsx` first (props: `icon`, `title`, `description`). Add optional prop + render (add `Link` import from `react-router`):
```tsx
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: { label: string; to: string };
}) {
```
Inside, after the description `<p>`, insert:
```tsx
      {action && (
        <Link
          to={action.to}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
        >
          {action.label}
        </Link>
      )}
```
Existing callers (no `action`) render unchanged.

- [ ] **Step 2: Add Share handler + button**

Read the header button row first (Refresh button with `RefreshCw`, `handleRefresh`, `showToast` all exist). Add import:
```tsx
import { buildWatchlistShareText } from "../../../lib/watchlist-share";
```
Add handler (place beside `handleRefresh`; `products` is the watchlist state, `displayCurrency` exists as `settings?.displayCurrency ?? "USD"`, `refresh` reloads):
```tsx
  const handleShare = useCallback(async () => {
    if (products.length === 0) return;
    const message = buildWatchlistShareText({ watchlist: products, displayCurrency, days: 30, now: Date.now() });
    try {
      await navigator.clipboard.writeText(message);
      showToast("Copied to clipboard");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = message;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        showToast("Copied to clipboard");
      } catch {
        showToast("Couldn't copy share text");
      }
      document.body.removeChild(ta);
    }
  }, [products, displayCurrency]);
```
Check `useCallback` is imported in the file; if not, add it to the react import. Add a Share button next to Refresh mirroring its classes (outline style like the Distributor Analysis button), with `Share2` lucide icon (verify export exists in lucide-react; else reuse `Copy` — check), `aria-label="Share watchlist"`, `disabled={refreshing || products.length === 0}` (reuse existing `refreshing`/products names; verify exact state names by reading).

- [ ] **Step 3: Wire the empty-state CTA**

Find the empty-watchlist `EmptyState` (title "No products in watchlist") and add `action={{ label: "Add products", to: "/search" }}`.

- [ ] **Step 4: Verify**

Run: `pnpm vitest run tests/desktop-p2-watchlist.test.ts -t "has a share action"` (passes; other 3 still fail) and `pnpm check` (0 errors).

- [ ] **Step 5: Commit**

```bash
git add desktop/src/pages/Watchlist.tsx desktop/src/components/EmptyState.tsx
git commit -m "Feat: desktop watchlist share-to-clipboard and empty-state CTA. TypeScript: 0 errors."
```

---

### Task 3: Persisted in-stock + price-range filters

**Files:**
- Modify: `desktop/src/pages/Watchlist.tsx`

- [ ] **Step 1: Add state + persistence**

Read the existing settings `useEffect` (loads tag definitions from `storage.getSettings()`) and the filter state block first. Add:
```tsx
  const [inStockOnly, setInStockOnly] = useState(false);
  const [priceMinInput, setPriceMinInput] = useState("");
  const [priceMaxInput, setPriceMaxInput] = useState("");
```
Derived (place near other memos):
```tsx
  const priceRange = useMemo<[number, number] | undefined>(() => {
    if (priceMinInput.trim() === "" && priceMaxInput.trim() === "") return undefined;
    const min = priceMinInput.trim() === "" ? 0 : Number(priceMinInput);
    const max = priceMaxInput.trim() === "" ? Number.MAX_SAFE_INTEGER : Number(priceMaxInput);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min) return undefined;
    return [min, max];
  }, [priceMinInput, priceMaxInput]);
```
Load (extend the existing settings effect — read it first, merge into it):
```tsx
      setInStockOnly(s.watchlistInStockOnly ?? false);
      const storedRange = s.watchlistPriceRange ?? null;
      if (storedRange && Array.isArray(storedRange) && storedRange.length === 2) {
        const [min, max] = storedRange;
        setPriceMinInput(min === 0 ? "" : String(min));
        setPriceMaxInput(max === Number.MAX_SAFE_INTEGER ? "" : String(max));
      }
```
Persist (new effect; `storage.saveSettings` exists via createStorage — verify; `loading` is the page loading state — verify exact name):
```tsx
  useEffect(() => {
    if (loading) return;
    storage
      .getSettings()
      .then((s) => storage.saveSettings({ ...s, watchlistInStockOnly: inStockOnly, watchlistPriceRange: priceRange ?? null }))
      .catch(() => {});
  }, [inStockOnly, priceRange, loading]);
```
Mirror `app/(tabs)/watchlist.tsx:189-208` if shape differs (read it). `watchlistPriceRange` type in AppSettings must accept `[number, number] | null` — verify in `lib/types.ts`; if the type differs, match it.

- [ ] **Step 2: Apply in the filtered memo + render controls**

In the existing single-pass `filtered` memo (read exact text first), add after the status-filter clause:
```tsx
    if (inStockOnly) {
      result = result.filter((p) => getDominantStatus(p) === "in_stock");
    }
    if (priceRange) {
      const [min, max] = priceRange;
      result = result.filter((p) => {
        const best = getBestPrice(p.listings, displayCurrency);
        return best !== null && best.price >= min && best.price <= max;
      });
    }
```
`getDominantStatus` is already used in the file — reuse. `getBestPrice` is already imported (used by sort) — verify import source and reuse; do NOT add a second import. Add `inStockOnly`/`priceRange` to the memo dep array.
Render (in the filter row, beside status pills — read exact markup first): an In-stock toggle (checkbox + label "In stock only") and two number inputs (Min/Max, placeholders, `value={priceMinInput}` / `onChange` setters, `inputMode="decimal"`, small width classes matching sibling controls).

- [ ] **Step 3: Verify**

Run: `pnpm vitest run tests/desktop-p2-watchlist.test.ts -t "persists in-stock"` (passes) and `pnpm check` (clean).

- [ ] **Step 4: Commit**

```bash
git add desktop/src/pages/Watchlist.tsx
git commit -m "Feat: desktop watchlist in-stock and price-range filters with settings persistence. TypeScript: 0 errors."
```

---

### Task 4: Check-Now price scan

**Files:**
- Modify: `desktop/src/pages/Watchlist.tsx`

- [ ] **Step 1: Add checking state + handler**

```tsx
  const [checking, setChecking] = useState(false);
  const [checkProgress, setCheckProgress] = useState<{ current: number; total: number } | null>(null);
  const checkingRef = useRef(false);
```
`useRef` import — verify present, else add. Handler (beside `handleShare`):
```tsx
  const handleCheckNow = useCallback(async () => {
    if (checkingRef.current || products.length === 0) return;
    checkingRef.current = true;
    setChecking(true);
    setCheckProgress({ current: 0, total: products.length });
    try {
      const { checkPriceDropsNow } = await import("../../../lib/background-price-check");
      await checkPriceDropsNow((current, total) => setCheckProgress({ current, total }));
      await refresh();
    } catch {
      showToast("Couldn't complete price check");
    } finally {
      checkingRef.current = false;
      setChecking(false);
      setCheckProgress(null);
    }
  }, [products.length, refresh]);
```
Verify `refresh` is the exact reload function name in the file (the `useWatchlist` refresh). Dynamic `import()` keeps `expo-notifications` out of the initial bundle; a module-init failure rejects into the catch → toast (acceptable per spec).

- [ ] **Step 2: Add button + progress label**

Next to the Share button: Check-Now button (activity/zap icon — verify lucide export, else `RotateCcw` already imported), `aria-label="Check prices now"`, `disabled={refreshing || checking || products.length === 0}`. Below the header (or beside the button), when `checking && checkProgress`, render `<span className="text-xs ...">Checking {checkProgress.current}/{checkProgress.total}</span>`.

- [ ] **Step 3: Verify incl. bundle safety**

Run: `pnpm vitest run tests/desktop-p2-watchlist.test.ts` (all 3 pass), `pnpm check` (clean), workdir `desktop/` `pnpm build` (exit 0 — proves the dynamic import resolves). If the build fails on the background-price-check import, FALL BACK: replace the dynamic import + call with `await fetchServerPricesForWatchlist()` (already in this file from the Refresh work — reuse it) + counts toast, re-run build, and report the fallback in the final message.

- [ ] **Step 4: Commit**

```bash
git add desktop/src/pages/Watchlist.tsx
git commit -m "Feat: desktop watchlist Check-Now price scan with progress. TypeScript: 0 errors."
```

---

### Task 5: Full verification + push

**Files:** none (verification only)

- [ ] **Step 1: Lint + full suite**

`pnpm lint` (0 errors, no new warnings in touched files), `pnpm test` (all pass, 0 failures).

- [ ] **Step 2: Desktop build**

Workdir `desktop/`: `pnpm build` (exit 0).

- [ ] **Step 3: Push**

`git push origin main` (`main -> main`), `git status --short` empty.
