# Desktop List Awareness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Watchlist shows offline queue state and buy-signal badges; Alerts tabs show counts.

**Architecture:** `useConnection` + `countQueuedEdits` banner, `computeProductInsights` chips in name cells, counts in tab labels — Watchlist + Alerts pages only. No server or mobile changes.

**Tech Stack:** React, vitest.

**Spec:** `docs/superpowers/specs/2026-09-06-desktop-list-awareness-design.md`

---

### Task 1: Guard tests for list awareness

**Files:**
- Create: `tests/desktop-list-awareness.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop list awareness", () => {
  it("shows the offline queued-edits banner", async () => {
    const text = await readFile("desktop/src/pages/Watchlist.tsx", "utf8");
    expect(text).toContain("countQueuedEdits");
    expect(text).toContain("edits queued");
  });

  it("badges buy signals and counts tabs", async () => {
    const watchlist = await readFile("desktop/src/pages/Watchlist.tsx", "utf8");
    const alerts = await readFile("desktop/src/pages/Alerts.tsx", "utf8");
    expect(watchlist).toContain("computeProductInsights");
    expect(watchlist).toContain("All-time low");
    expect(alerts).toMatch(/Alerts \(\{/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/desktop-list-awareness.test.ts 2>&1 | tail -4`
Expected: FAIL (2 failed — verify strings truly absent first).

- [ ] **Step 3: Commit the failing tests**

```bash
git add tests/desktop-list-awareness.test.ts
git commit -m "test: guard desktop list awareness"
```

---

### Task 2: Offline banner + insight badges

**Files:**
- Modify: `desktop/src/pages/Watchlist.tsx`

- [ ] **Step 1: Banner state**

Add imports: `useConnection` from `"../hooks/use-connection"`; `countQueuedEdits` from `"../../../lib/sync"` (verify path from desktop/src/pages — mirror the watchlist-org import style; check how lib/sync is imported elsewhere in desktop, e.g. getSyncMeta usage — mirror it). Add:
```tsx
  const connection = useConnection();
  const [queuedCount, setQueuedCount] = useState(0);

  const refreshQueuedCount = useCallback(async () => {
    try {
      const meta = await storage.getSyncMeta();
      setQueuedCount(countQueuedEdits(meta));
    } catch {
      // best-effort
    }
  }, []);

  useEffect(() => {
    void refreshQueuedCount();
    window.addEventListener("focus", refreshQueuedCount);
    return () => window.removeEventListener("focus", refreshQueuedCount);
  }, [refreshQueuedCount]);
```
Verify `storage.getSyncMeta` exists on desktop storage (used at line 83 per exploration — yes). Check useCallback import.
Render above the table (read exact spot near other banners):
```tsx
      {connection.status === "offline" && queuedCount > 0 && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm font-semibold" role="alert">
          Offline — {queuedCount} edit{queuedCount === 1 ? "" : "s"} queued. Will sync when back online.
        </div>
      )}
```
Verify `connection.status` values include `"offline"` (use-connection returns status string — check the type/values first; adapt comparison).

- [ ] **Step 2: Insight chips**

Add import: `computeProductInsights` from `"../../../lib/product-insights"` (verify path). Add memo:
```tsx
  const insightMap = useMemo(() => {
    const insights = computeProductInsights(products, displayCurrency);
    return new Map(insights.products.map((p) => [p.productId, p]));
  }, [products, displayCurrency]);
```
Verify `computeProductInsights` return shape (`{products: [{productId, atAllTimeLow, dropStreak...}]}` — read lib/product-insights.ts first; adapt field access). In the product name cell (read exact markup): after the name,
```tsx
{(() => {
  const ins = insightMap.get(product.id);
  if (!ins || (!ins.atAllTimeLow && ins.dropStreak < 2)) return null;
  return (
    <span className="ml-2 inline-flex items-center gap-1">
      {ins.atAllTimeLow && (
        <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">All-time low</span>
      )}
      {ins.dropStreak >= 2 && (
        <span className="text-[11px] font-semibold text-red-600 dark:text-red-400">▼ Dropping ×{ins.dropStreak}</span>
      )}
    </span>
  );
})()}
```

- [ ] **Step 3: Verify**

Run: `pnpm vitest run tests/desktop-list-awareness.test.ts -t "offline"` (passes; second test still fails — counts is Task 3). `pnpm check` clean.

- [ ] **Step 4: Commit**

```bash
git add desktop/src/pages/Watchlist.tsx
git commit -m "Feat: desktop offline banner and insight badges. TypeScript: 0 errors."
```

---

### Task 3: Alerts tab counts

**Files:**
- Modify: `desktop/src/pages/Alerts.tsx`

- [ ] **Step 1: Count labels**

Read the tab bar first (labels "Alerts" / "Reminders" + Notifications unread). Change to `Alerts ({alerts.length})` / `Reminders ({reminders.length})` using existing state arrays (verify variable names — `alerts`, `reminders`/`watches`? read first; use lengths of the arrays rendered in each tab).

- [ ] **Step 2: Verify**

Run: full guard file (both pass) + `pnpm check` (clean).

- [ ] **Step 3: Commit**

```bash
git add desktop/src/pages/Alerts.tsx
git commit -m "Feat: desktop Alerts tab counts. TypeScript: 0 errors."
```

---

### Task 4: Full verification + push

**Files:** none (verification only)

- [ ] **Step 1: Lint + full suite**

`pnpm lint` (0 errors, no new warnings in the 2 touched files), `pnpm test` (all pass, 0 failures).

- [ ] **Step 2: Desktop build**

Workdir `desktop/`: `pnpm build` (exit 0).

- [ ] **Step 3: Push**

`git push origin main` (`main -> main`), `git status --short` empty.
