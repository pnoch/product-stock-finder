# Desktop Refresh Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Server price refresh can't hang on slow listings and reports progress.

**Architecture:** Per-query 20s timeout raced into the existing miss path; `onProgress` callback threaded to the Refresh button label. Same workers, same rate profile. All in `desktop/src/pages/Watchlist.tsx`.

**Tech Stack:** TypeScript, vitest.

**Spec:** `docs/superpowers/specs/2026-09-06-desktop-refresh-hardening-design.md`

---

### Task 1: Guard tests for refresh hardening

**Files:**
- Create: `tests/desktop-refresh-hardening.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop refresh hardening", () => {
  it("times out slow price queries", async () => {
    const text = await readFile("desktop/src/pages/Watchlist.tsx", "utf8");
    expect(text).toContain("QUERY_TIMEOUT_MS");
    expect(text).toContain("onProgress");
  });

  it("shows refresh progress on the button", async () => {
    const text = await readFile("desktop/src/pages/Watchlist.tsx", "utf8");
    expect(text).toContain("refreshProgress");
    expect(text).toContain("Refreshing");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/desktop-refresh-hardening.test.ts 2>&1 | tail -4`
Expected: FAIL (2 failed — verify strings truly absent first).

- [ ] **Step 3: Commit the failing tests**

```bash
git add tests/desktop-refresh-hardening.test.ts
git commit -m "test: guard desktop refresh hardening"
```

---

### Task 2: Timeout + progress

**Files:**
- Modify: `desktop/src/pages/Watchlist.tsx`

Current code (lines 84-122, read first to confirm): `MAX_CONCURRENT_SERVER_FETCHES = 3`, `fetchServerPricesForWatchlist()` with 3 workers, sequential per-listing `await client.prices.get.query(...)` in try/catch, `refreshed`/`total` return. `handleRefresh` (~line 340) calls it in the non-Tauri branch with try/catch → toasts, `finally setRefreshing(false)`.

- [ ] **Step 1: Add timeout const + onProgress param**

```tsx
const MAX_CONCURRENT_SERVER_FETCHES = 3;
const QUERY_TIMEOUT_MS = 20_000;

async function fetchServerPricesForWatchlist(
  onProgress?: (done: number, total: number) => void,
): Promise<{ refreshed: number; total: number } | null> {
```
Inside, add `let done = 0;` beside `let refreshed = 0;`. Replace the per-listing try block:
```tsx
        for (const listing of job.listings) {
          try {
            results.push(
              await Promise.race([
                client.prices.get.query({
                  distributorId: listing.distributorId,
                  modelNumber: job.modelNumber,
                }),
                new Promise<never>((_resolve, reject) =>
                  setTimeout(() => reject(new Error("price query timeout")), QUERY_TIMEOUT_MS),
                ),
              ]),
            );
          } catch {
            results.push(null);
          }
          done += 1;
          onProgress?.(done, total);
        }
```
Timeout rejection lands in the existing catch → null (miss). Counts attempts including misses.

- [ ] **Step 2: Wire progress to the Refresh button**

Add state near `refreshing`: `const [refreshProgress, setRefreshProgress] = useState<{ current: number; total: number } | null>(null);`
In the non-Tauri branch, change `result = await fetchServerPricesForWatchlist();` to:
```tsx
        result = await fetchServerPricesForWatchlist((done, total) =>
          setRefreshProgress({ current: done, total }),
        );
```
In the `finally` (the one with `setRefreshing(false)`), add `setRefreshProgress(null);`. Read the Refresh button markup first; change its label to show `refreshing && refreshProgress ? \`Refreshing ${refreshProgress.current}/${refreshProgress.total}\` : <existing label>` (mirror the Check-Now progress pattern in the same file — read it first and match).

- [ ] **Step 3: Verify**

Run: `pnpm vitest run tests/desktop-refresh-hardening.test.ts` (both pass) and `pnpm check` (clean).

- [ ] **Step 4: Commit**

```bash
git add desktop/src/pages/Watchlist.tsx
git commit -m "Feat: timeout + progress for desktop server price refresh. TypeScript: 0 errors."
```

---

### Task 3: Full verification + push

**Files:** none (verification only)

- [ ] **Step 1: Lint + full suite**

`pnpm lint` (0 errors, no new warnings in Watchlist.tsx), `pnpm test` (all pass, 0 failures).

- [ ] **Step 2: Desktop build**

Workdir `desktop/`: `pnpm build` (exit 0).

- [ ] **Step 3: Push**

`git push origin main` (`main -> main`), `git status --short` empty.
