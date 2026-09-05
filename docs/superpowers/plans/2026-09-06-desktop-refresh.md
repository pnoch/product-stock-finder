# Desktop Web-Preview Refresh Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desktop Watchlist Refresh fetches live prices via tRPC `prices.get` when running outside Tauri.

**Architecture:** New module-level helper in `desktop/src/pages/Watchlist.tsx` fans out over listings (concurrency 3) through the existing desktop tRPC client, merges with the pure `composeLiveListings` helper (proven desktop-safe: `desktop/src/hooks/use-connection.ts` already imports `lib/live-prices` and the bundle builds), persists via `storage.updateProductListings`. No server changes.

**Tech Stack:** React, TypeScript, tRPC vanilla client, vitest.

**Spec:** `docs/superpowers/specs/2026-09-06-desktop-refresh-design.md`

---

### Task 1: Guard test for server-backed desktop refresh

**Files:**
- Create: `tests/desktop-watchlist-refresh.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop watchlist refresh", () => {
  it("fetches live prices via tRPC when Tauri is unavailable", async () => {
    const text = await readFile("desktop/src/pages/Watchlist.tsx", "utf8");
    expect(text).toContain("prices.get");
    expect(text).toContain("Refreshed");
    expect(text).toContain("Live prices need a server");
    expect(text).not.toContain("refreshWatchlistPrices");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/desktop-watchlist-refresh.test.ts 2>&1 | tail -4`
Expected: FAIL — current `handleRefresh` calls `storage.refreshWatchlistPrices()` and shows `"Watchlist refreshed"`.

- [ ] **Step 3: Commit the failing test**

```bash
git add tests/desktop-watchlist-refresh.test.ts
git commit -m "test: guard server-backed desktop watchlist refresh"
```

---

### Task 2: Server-backed refresh in desktop Watchlist

**Files:**
- Modify: `desktop/src/pages/Watchlist.tsx` (imports + new helper + `handleRefresh` rewrite)

- [ ] **Step 1: Add imports**

After line 17 (`import { formatPrice, getBestPrice } from "@shared/currency";` region — place with the other `../../../lib/*` imports):
```tsx
import { createTRPCClient } from "../lib/trpc";
import { composeLiveListings } from "../../../lib/live-prices";
import { isFreshPriceSnapshot } from "../../../lib/price-freshness";
```
Extend the existing type import (line ~31) to include `ServerPriceResult`:
```tsx
import type { Product, ServerPriceResult, StockStatus, TagDefinition } from "../../../lib/types";
```
Keep existing names/order otherwise unchanged.

- [ ] **Step 2: Add the server-fetch helper (module scope, above the Watchlist component)**

```tsx
const MAX_CONCURRENT_SERVER_FETCHES = 3;

async function fetchServerPricesForWatchlist(): Promise<{ refreshed: number; total: number } | null> {
  if (!getApiBaseUrl()) return null;
  const products = await storage.getWatchlist();
  const jobs = products
    .filter((p) => p.listings.length > 0)
    .map((p) => ({ productId: p.id, modelNumber: p.modelNumber, listings: p.listings }));
  const total = jobs.reduce((n, j) => n + j.listings.length, 0);
  if (total === 0) return { refreshed: 0, total: 0 };
  const client = createTRPCClient();
  let refreshed = 0;
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(MAX_CONCURRENT_SERVER_FETCHES, total) }, async () => {
      while (next < jobs.length) {
        const job = jobs[next];
        next += 1;
        const results: (ServerPriceResult | null)[] = [];
        for (const listing of job.listings) {
          try {
            results.push(
              await client.prices.get.query({
                distributorId: listing.distributorId,
                modelNumber: job.modelNumber,
              }),
            );
          } catch {
            results.push(null);
          }
        }
        if (results.some((r) => r !== null)) {
          const merged = composeLiveListings(job.listings, results);
          await storage.updateProductListings(job.productId, merged);
        }
        refreshed += results.filter((r) => isFreshPriceSnapshot(r?.snapshot)).length;
      }
    }),
  );
  return { refreshed, total };
}
```
NOTE: the helper name must NOT contain the substring `refreshWatchlistPrices` (Task 1 guard asserts its absence). `next`/`refreshed` mutation is safe: increments run synchronously between awaits on one thread.

- [ ] **Step 3: Rewrite handleRefresh**

Old (the whole `handleRefresh` const including the stale comment block):
```tsx
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Attempt live price refresh via Tauri backend when available.
      // Falls back to a timestamp bump (placeholder) when running outside
      // Tauri (e.g. web preview) — live prices are kept fresh by the server
      // catalog warmer / background poller in that case.
      let liveRefreshed = false;
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const raw = await storage.getWatchlist();
        const products = raw
          .map((p) => ({
            id: p.id,
            model_number: p.modelNumber,
            distributor_ids: p.listings.map((l) => l.distributorId),
          }))
          .filter((p) => p.distributor_ids.length > 0);
        if (products.length > 0) {
          await invoke("check_all_prices", {
            products,
            apiBaseUrl: getApiBaseUrl(),
          });
          liveRefreshed = true;
        }
      } catch {
        // Not in Tauri or invoke unavailable — fall through to bump
      }
      if (!liveRefreshed) {
        await storage.refreshWatchlistPrices();
      }
      await refresh();
      showToast("Watchlist refreshed");
    } finally {
      setRefreshing(false);
    }
  };
```
New:
```tsx
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Attempt live price refresh via Tauri backend when available.
      let viaTauri = false;
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const raw = await storage.getWatchlist();
        const products = raw
          .map((p) => ({
            id: p.id,
            model_number: p.modelNumber,
            distributor_ids: p.listings.map((l) => l.distributorId),
          }))
          .filter((p) => p.distributor_ids.length > 0);
        if (products.length > 0) {
          await invoke("check_all_prices", {
            products,
            apiBaseUrl: getApiBaseUrl(),
          });
          viaTauri = true;
        }
      } catch {
        // Not in Tauri or invoke unavailable — fall through to server fetch
      }
      if (viaTauri) {
        await refresh();
        showToast("Watchlist refreshed");
      } else {
        const result = await fetchServerPricesForWatchlist();
        await refresh();
        if (!result) {
          showToast("Live prices need a server connection or the Tauri app");
        } else if (result.refreshed > 0) {
          showToast(`Refreshed ${result.refreshed} of ${result.total} prices`);
        } else {
          showToast("Couldn't refresh prices");
        }
      }
    } finally {
      setRefreshing(false);
    }
  };
```

- [ ] **Step 4: Run the guard test to verify it passes**

Run: `pnpm vitest run tests/desktop-watchlist-refresh.test.ts 2>&1 | tail -3`
Expected: 1 passed.

- [ ] **Step 5: Typecheck**

Run: `pnpm check 2>&1 | tail -1`
Expected: clean (exit 0, no `error TS` lines).

- [ ] **Step 6: Commit**

```bash
git add desktop/src/pages/Watchlist.tsx
git commit -m "Fix: desktop web-preview Refresh fetches live prices via tRPC prices.get with honest toasts. TypeScript: 0 errors."
```

---

### Task 3: Full verification + push

**Files:** none (verification only)

- [ ] **Step 1: Run lint**

Run: `pnpm lint 2>&1 | tail -2`
Expected: 0 errors, no new warnings in `desktop/src/pages/Watchlist.tsx` (11 pre-existing warnings elsewhere are acceptable).

- [ ] **Step 2: Run full test suite**

Run: `pnpm test 2>&1 | grep -E "^ *(Test Files|Tests) "`
Expected: all files pass, 0 failures (1363+ tests: 1362 before + 1 new guard).

- [ ] **Step 3: Desktop build (new lib imports must not break the web bundle)**

Run with workdir `desktop/`: `pnpm build 2>&1 | tail -6`
Expected: exit 0, `✓ built in` line. Chunk-size warnings are acceptable; errors are not.

- [ ] **Step 4: Push**

Run: `git push origin main 2>&1 | tail -1`
Expected: `main -> main` fast-forward. Confirm `git status --short` is empty.
