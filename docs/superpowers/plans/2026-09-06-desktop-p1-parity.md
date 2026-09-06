# Desktop P1 Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desktop opens shared watchlist links and never spins forever on Alerts reminders.

**Architecture:** New `SharedWatchlist` page (vanilla tRPC client in `useEffect`, mirroring `Watchlist.tsx`'s server-fetch pattern — no `useQuery` precedent exists in desktop) + `/w/:token` route; Alerts reminders load extracted to a callback with error state + retry. No server or mobile changes.

**Tech Stack:** React, react-router, tRPC vanilla client, vitest.

**Spec:** `docs/superpowers/specs/2026-09-06-desktop-p1-parity-design.md`

---

### Task 1: Guard tests for P1 parity

**Files:**
- Create: `tests/desktop-p1-parity.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop P1 parity", () => {
  it("registers the shared watchlist route", async () => {
    const app = await readFile("desktop/src/App.tsx", "utf8");
    expect(app).toContain("/w/:token");
    expect(app).toContain("SharedWatchlist");
  });

  it("fetches the share and offers bulk add", async () => {
    const page = await readFile("desktop/src/pages/SharedWatchlist.tsx", "utf8");
    expect(page).toContain("sharedWatchlists");
    expect(page).toContain("addToWatchlist");
    expect(page).toContain("Share not found");
  });

  it("gives Alerts reminders an error path with retry", async () => {
    const alerts = await readFile("desktop/src/pages/Alerts.tsx", "utf8");
    expect(alerts).toContain("remindersError");
    expect(alerts).toContain("loadReminders");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/desktop-p1-parity.test.ts 2>&1 | tail -4`
Expected: FAIL (3 failed — no route, no page, no error path).

- [ ] **Step 3: Commit the failing tests**

```bash
git add tests/desktop-p1-parity.test.ts
git commit -m "test: guard desktop P1 parity (shared route + alerts retry)"
```

---

### Task 2: SharedWatchlist page + route

**Files:**
- Create: `desktop/src/pages/SharedWatchlist.tsx`
- Modify: `desktop/src/App.tsx` (import + route)

- [ ] **Step 1: Create the page**

Write `desktop/src/pages/SharedWatchlist.tsx` with EXACTLY this content (desktop storage exposes `addToWatchlist` via `createStorage` like `lib/storage` — verify by grepping `desktop/src/storage.ts` for `addToWatchlist`; if missing, read how `desktop/src/pages/Search.tsx` bulk-adds products and match that call instead, keeping everything else identical):

```tsx
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, PackagePlus } from "lucide-react";
import { createTRPCClient } from "../lib/trpc";
import { storage } from "../storage";
import { normalizeSharedWatchlistProduct } from "../../../lib/shared-watchlist";
import { formatPrice } from "@shared/currency";
import { getDistributorById } from "@shared/distributors";
import { StockBadge } from "../components/StockBadge";
import { EmptyState } from "../components/EmptyState";
import { LoadingSpinner } from "../components/LoadingSpinner";

interface SharedProduct {
  id: string;
  name: string;
  brand?: string;
  modelNumber?: string;
  listings?: Array<{
    distributorId: string;
    price: number;
    currency: string;
    stockStatus: "in_stock" | "back_order" | "out_of_stock" | "unknown";
  }>;
}

interface SharedData {
  title: string;
  products: unknown[];
  createdAt: string | null;
  expiresAt: string | null;
}

export function SharedWatchlist() {
  const { token } = useParams();
  const [data, setData] = useState<SharedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    if (!token) {
      setError("Share not found");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const client = createTRPCClient();
        const result = await client.sharedWatchlists.get.query({ token });
        if (!cancelled) {
          setData(result as SharedData);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Share not found");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleAddAll = useCallback(async () => {
    const products = data?.products ?? [];
    if (products.length === 0 || adding) return;
    setAdding(true);
    let added = 0;
    let failed = 0;
    for (const p of products) {
      try {
        await storage.addToWatchlist(normalizeSharedWatchlistProduct(p));
        added += 1;
      } catch {
        failed += 1;
      }
    }
    setAdding(false);
    if (added > 0 && failed === 0) showToast(`Added ${added} product${added === 1 ? "" : "s"}.`);
    else if (added > 0) showToast(`Added ${added}. Skipped ${failed} invalid.`);
    else showToast("Nothing added");
  }, [data, adding]);

  if (loading) {
    return (
      <div className="p-6">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold">Share not found</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{error ?? "This share link is invalid or expired."}</p>
        <Link to="/watchlist" className="inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to watchlist
        </Link>
      </div>
    );
  }

  const products = (data.products ?? []) as SharedProduct[];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{data.title}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {products.length} product{products.length === 1 ? "" : "s"}
            {data.expiresAt ? ` · Expires ${new Date(data.expiresAt).toLocaleDateString()}` : ""}
          </p>
        </div>
        <button
          onClick={handleAddAll}
          disabled={adding || products.length === 0}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 shrink-0"
          aria-label="Add all to watchlist"
        >
          <PackagePlus className="w-4 h-4" />
          {adding ? "Adding" : "Add all to watchlist"}
        </button>
      </div>
      {toast && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 text-sm" role="status">
          {toast}
        </div>
      )}
      {products.length === 0 ? (
        <EmptyState title="No products" message="This shared watchlist is empty." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {products.map((p) => {
            const first = p.listings?.[0];
            return (
              <div key={p.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="font-semibold text-sm">{p.name}</div>
                {p.brand && <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{p.brand}</div>}
                <div className="flex items-center gap-2 mt-2">
                  {first && (
                    <>
                      <span className="text-sm font-semibold">
                        {formatPrice(first.price, first.currency)}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {getDistributorById(first.distributorId)?.name ?? first.distributorId}
                      </span>
                      <StockBadge status={first.stockStatus} />
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```
Adaptation rules (no other changes): if `EmptyState` props differ (read `desktop/src/components/EmptyState.tsx` — use its actual prop names; `title`/`message` assumed), adjust props only. If `StockBadge` needs different props, read it and adjust. If `storage.addToWatchlist` doesn't exist, mirror `Search.tsx` bulk-add instead. If `LoadingSpinner` takes props, pass none only if optional.

- [ ] **Step 2: Register the route**

In `desktop/src/App.tsx`: add `import { SharedWatchlist } from "./pages/SharedWatchlist";` with the other page imports, and add `<Route path="/w/:token" element={<SharedWatchlist />} />` immediately BEFORE `<Route path="*" element={<NotFound />} />`.

- [ ] **Step 3: Run guard tests for route + page**

Run: `pnpm vitest run tests/desktop-p1-parity.test.ts -t "shared watchlist route" 2>&1 | tail -2` and `-t "bulk add"` — both pass (alerts test still fails — Task 3).

- [ ] **Step 4: Typecheck**

Run: `pnpm check 2>&1 | tail -1` (clean) and with workdir `desktop/`: `pnpm build 2>&1 | tail -2` (exit 0 — new page must bundle).

- [ ] **Step 5: Commit**

```bash
git add desktop/src/pages/SharedWatchlist.tsx desktop/src/App.tsx
git commit -m "Feat: desktop shared watchlist (/w/:token) page with bulk add. TypeScript: 0 errors."
```

---

### Task 3: Alerts reminders error path

**Files:**
- Modify: `desktop/src/pages/Alerts.tsx`

- [ ] **Step 1: Add error state + loader callback**

Read the current reminders `useEffect` first (around line 99-108). Replace:
```tsx
  useEffect(() => {
    (async () => {
      const [r, w] = await Promise.all([
        storage.getBackOrderReminders(),
        storage.getStockWatches(),
      ]);
      setReminders(r);
      setWatches(w);
      setRemindersLoading(false);
    })();
  }, []);
```
with:
```tsx
  const [remindersError, setRemindersError] = useState<string | null>(null);

  const loadReminders = useCallback(async () => {
    setRemindersLoading(true);
    setRemindersError(null);
    try {
      const [r, w] = await Promise.all([
        storage.getBackOrderReminders(),
        storage.getStockWatches(),
      ]);
      setReminders(r);
      setWatches(w);
    } catch (e) {
      setRemindersError(e instanceof Error ? e.message : "Couldn't load reminders");
    } finally {
      setRemindersLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReminders();
  }, [loadReminders]);
```
Add `useCallback` to the react import (line 1: `import { useState, useEffect, useMemo } from "react";` → `import { useState, useEffect, useMemo, useCallback } from "react";`).

- [ ] **Step 2: Render error banner with retry**

Read the reminders-tab render section first. Above the reminders list (inside the reminders tab panel, before the list/empty state), insert:
```tsx
        {remindersError && (
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-800 dark:text-red-200 flex items-center gap-2">
            <span className="flex-1">{remindersError}</span>
            <button
              onClick={() => void loadReminders()}
              className="px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-800 text-sm font-semibold hover:bg-red-200 dark:hover:bg-red-700 shrink-0"
              aria-label="Retry loading reminders"
            >
              Retry
            </button>
          </div>
        )}
```

- [ ] **Step 3: Run guard + typecheck**

Run: `pnpm vitest run tests/desktop-p1-parity.test.ts 2>&1 | tail -3` (all 3 pass) and `pnpm check 2>&1 | tail -1` (clean).

- [ ] **Step 4: Commit**

```bash
git add desktop/src/pages/Alerts.tsx
git commit -m "Fix: desktop Alerts reminders load has error state with retry. TypeScript: 0 errors."
```

---

### Task 4: Full verification + push

**Files:** none (verification only)

- [ ] **Step 1: Lint + full suite**

Run: `pnpm lint 2>&1 | tail -2` (0 errors, no new warnings in the 3 touched files) and `pnpm test 2>&1 | grep -E "^ *(Test Files|Tests) "` (all pass, 0 failures).

- [ ] **Step 2: Desktop build**

Run with workdir `desktop/`: `pnpm build 2>&1 | tail -3` (exit 0).

- [ ] **Step 3: Push**

Run: `git push origin main 2>&1 | tail -1` (`main -> main`). Confirm `git status --short` is empty.
