# Correctness Leftovers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shared seed logic, stable preview tail, documented timeout contract with unregister retry, and recorded platform limits — no success-path behavior change.

**Architecture:** Extract pure shared units to `lib/`; retry flag in localStorage consumed by the existing sync; comments at Rust limits.

**Tech Stack:** TypeScript, vitest root (`pnpm test`) + desktop (`desktop/ pnpm test`), Rust comments only (no Rust behavior change), `pnpm check`, `pnpm lint`.

---

### Task 1: Shared seed logic

**Files:**
- Create: `lib/launch-seed.ts`
- Modify: `desktop/src/lib/launch.ts` (delegate)
- Modify: `app/_layout.tsx` (delegate — read its seed block + imports first)
- Test: `tests/launch-seed.test.ts` (new)

Verified facts (re-confirm): desktop seed lives behind `LaunchDeps` DI (`storage/catalog/sampleListings/freshen`); mobile block at `app/_layout.tsx:188-233` uses `getWatchlist/addToWatchlist/updateProductListings` + `PRODUCT_CATALOG` + `SAMPLE_LISTINGS` + `freshenSampleListings` (verify each import specifier in that file first).

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { seedWatchlistProducts, SEED_IDS } from "../lib/launch-seed";

function mockStorage(existing: Array<{ id: string; listings?: unknown[] }> = []) {
  return {
    getWatchlist: vi.fn(async () => existing),
    addToWatchlist: vi.fn(async () => {}),
    updateProductListings: vi.fn(async () => {}),
  };
}

describe("seedWatchlistProducts", () => {
  it("seeds all ids on empty watchlist", async () => {
    const storage = mockStorage();
    const catalog = SEED_IDS.map((id) => ({ id }));
    await seedWatchlistProducts({ storage, catalog, sampleListings: {}, freshen: (l) => l });
    expect(storage.addToWatchlist).toHaveBeenCalledTimes(SEED_IDS.length);
  });
  it("skips present ids and backfills empty MikroTik listings", async () => {
    const storage = mockStorage([
      { id: "nvidia-rtx-4090", listings: [{ x: 1 }] },
      { id: "mikrotik-crs804-4ddq-hrm", listings: [] },
    ]);
    const catalog = SEED_IDS.map((id) => ({ id }));
    await seedWatchlistProducts({ storage, catalog, sampleListings: {}, freshen: (l) => l });
    expect(storage.addToWatchlist).toHaveBeenCalledTimes(SEED_IDS.length - 2);
    expect(storage.updateProductListings).toHaveBeenCalledTimes(1);
    expect(storage.updateProductListings).toHaveBeenCalledWith("mikrotik-crs804-4ddq-hrm", []);
  });
});
```

Fixture types: `seedWatchlistProducts` deps must accept these minimal shapes — define the deps interface with structural (not `Product`) types where the seed only needs `{id, listings?}` + catalog `{id}` (verify against real `Product`/`DistributorListing` assignability at `pnpm check`; widen only as needed).

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm vitest run tests/launch-seed.test.ts` (root)
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write minimal implementation** (`lib/launch-seed.ts` — move desktop's loop verbatim, generalized over the deps interface; keep `[Seed]` logs + per-id try/catch):

```ts
import type { DistributorListing } from "./types";

export const SEED_IDS = [ ...same 7... ] as const;

export interface SeedDeps {
  storage: {
    getWatchlist(): Promise<Array<{ id: string; listings?: DistributorListing[] }>>;
    addToWatchlist(product: unknown): Promise<unknown>;
    updateProductListings(id: string, listings: DistributorListing[]): Promise<unknown>;
  };
  catalog: Array<{ id: string; [k: string]: unknown }>;
  sampleListings: Record<string, DistributorListing[]>;
  freshen(listings: DistributorListing[]): DistributorListing[];
}

export async function seedWatchlistProducts(deps: SeedDeps): Promise<void> { ...verbatim loop... }
```

Type strictness: avoid `unknown`-heavy signatures if check complains — prefer the real `Product`/`Storage` types when assignable from both callers (mobile passes real storage fns; desktop passes its factory). If the shared `Storage` type (`lib/storage`) satisfies both, use it directly (check `Storage` interface first — `getWatchlist/addToWatchlist/updateProductListings` all on it? verify). Prefer real types; fall back to structural only on mismatch.

Desktop `launch.ts`: replace loop with `await seedWatchlistProducts({storage, catalog, sampleListings, freshen})` (keep its outer try/catch? The shared fn never throws by contract? Mobile/desktop both wrap in outer catch — keep a single outer guard at each call site OR inside shared fn: mirror mobile (outer `seedProducts().catch`) — decide: shared fn handles per-id errors internally; outer catch stays at call sites (both already have it). Re-export `SEED_IDS` from launch.ts if anything imports it from there (grep first).

Mobile `_layout.tsx`: replace block with the shared call (same deps from its existing imports). Keep its outer `.catch`.

- [ ] **Step 4: Run to verify**

Run: `pnpm vitest run tests/launch-seed.test.ts` (root); `pnpm test app-launch` (desktop — launch suite must stay green using the shared fn); `pnpm check` (root, 0 errors); `pnpm build` (desktop, exit 0).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/launch-seed.ts tests/launch-seed.test.ts desktop/src/lib/launch.ts app/_layout.tsx desktop/tests/app-launch.test.tsx (last ONLY if its mocks changed — verify via git status, stage exactly touched files)
git commit -m "Refactor: shared watchlist seeding. TypeScript: 0 errors."
```

---

### Task 2: Stable preview tail

**Files:**
- Modify: `lib/search-preview.ts` (stable partition)
- Test: `tests/search-preview.test.ts` (append order test)

Verified facts: `sortPreviewByStock` pure sort; `previewStockScore` 0-for-unknown (test pins it — keep); call sites slice after sort (both platforms).

- [ ] **Step 1: Write the failing test** (append):

```ts
it("keeps unscored items in original order after scored ones", () => {
  const items = [{ id: "no-such-1" }, { id: "crs804-present" }, { id: "no-such-2" }];
  // needs a scored id — use a REAL catalog id with listings (find one via previewStockScore > 0 in the test setup; e.g. iterate PRODUCT_CATALOG for first id with score > 0 — deterministic, data-driven, no hardcoding).
  const scored = PRODUCT_CATALOG.map((p) => p.id).find((id) => previewStockScore(id) > 0)!;
  const input = [{ id: "no-such-1" }, { id: scored }, { id: "no-such-2" }];
  const out = sortPreviewByStock(input);
  expect(out.map((i) => i.id)).toEqual([scored, "no-such-1", "no-such-2"]);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run tests/search-preview.test.ts` (root)
Expected: FAIL — V8 `Array.sort` is stable, so actually... wait: scores 0,0 tie between no-such-1/no-such-2, scored first. Current pure sort: `[scored, no-such-1, no-such-2]` ALREADY (stable sort preserves tie order)! The test PASSES pre-fix. Hmm — so when does the bug manifest? Only if some unscored item sorts... all unscored tie at 0, stable sort keeps original order. The "bug" (discovered at bottom) is BY DESIGN and already stable. So the fix is documentation, not code!

REVISED Step 1: instead of changing sort, assert + document the contract:

```ts
it("documents unscored tail stability", () => {
  // unscored items keep catalog order after scored ones (stable sort over ties at 0)
  ...same assertion (passes now, pins the contract)...
});
```

And add the contract comment to `sortPreviewByStock` (Step 3 = comment-only + test). If the assertion passes pre-change, that's CORRECT here (pinning, not fixing) — report it as such. The real product question (should discovered rank by insertion?) is answered: they keep catalog order, which IS insertion order for combined catalog. No code change needed.

- [ ] **Step 3: Add contract comment + test**

```ts
// Unscored ids (unknown to SAMPLE_LISTINGS, e.g. AI-discovered) tie at 0 and
// keep their input order (stable sort) after scored items — no fake scores.
export function sortPreviewByStock<T extends { id: string }>(items: T[]): T[] {
```

- [ ] **Step 4: Run to verify**

Run: `pnpm vitest run tests/search-preview.test.ts` (root).
Expected: PASS (pinning).

- [ ] **Step 5: Commit**

```bash
git add lib/search-preview.ts tests/search-preview.test.ts
git commit -m "Docs: pin preview tail stability contract. TypeScript: 0 errors."
```

---

### Task 3: Timeout contract + unregister retry

**Files:**
- Modify: `lib/with-timeout.ts` (contract comment)
- Modify: `desktop/src/lib/web-push.ts` (bounded unregister + flag)
- Modify: `desktop/src/hooks/use-auth.ts` (logout flag path)
- Modify: `desktop/src/server-notifications.ts` (retry flag first)
- Test: `desktop/tests/web-push.test.tsx` (extend) + use-auth suite (extend)

Verified facts (re-confirm): withTimeout callers race non-null types (sync upload boolean, pull object, insight objects — audit each: `uploadConfig` mutate→boolean ✓, `pull.query` object ✓, ProductDetail insight objects ✓; document the rule); disablePush/logout fire-and-forget unregister; syncDesktopNotifications structure (settings → retract → upload → pull).

- [ ] **Step 1: Write the failing tests**

```tsx
// web-push.test.tsx: disable with failing mutate sets the retry flag:
it("flags unregister for retry when offline", async () => {
  mockUnregisterMutate.mockRejectedValue(new Error("offline"));
  localStorage.removeItem("pending_push_unregister");
  await disablePush();
  expect(localStorage.getItem("pending_push_unregister")).toBe("1");
});
it("clears the flag when unregister succeeds", ...);
// sync suite: flag set + upload ok → unregister attempted first, flag cleared; flag set + upload fails → flag retained.
```

Key name: `"pending_push_unregister"` (constant in web-push.ts, exported for sync module? — define + export `PENDING_UNREGISTER_KEY` from web-push.ts; sync module imports it).

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm test web-push` (workdir: `desktop/`)
Expected: FAIL — no flag logic.

- [ ] **Step 3: Write minimal implementation**

```ts
// with-timeout.ts — contract comment:
// Contract: null means TIMEOUT (or, if T includes null/undefined, ambiguous).
// Never race a nullable-typed promise — callers must race non-null success
// types (boolean/object/string) so null unambiguously signals timeout.
```

```ts
// web-push.ts:
export const PENDING_UNREGISTER_KEY = "pending_push_unregister";

async function unregisterServerToken(): Promise<boolean> {
  try {
    const client = createTRPCClient();
    await withTimeout(client.notifications.unregisterPushToken.mutate(), 5000);
    return true;
  } catch {
    return false;
  }
}
```

Wait — withTimeout resolves null on timeout (not throw), rejects only if mutate rejects. `unregisterServerToken` returns true iff mutate succeeded: `const ok = await withTimeout(mutate(), 5000); return ok !== null` — hmm, mutate returns `{accepted: true}` (object, non-null) on success. So `return (await withTimeout(...)) !== null`. Rejection → catch → false. Write it that way (verify mutate's success type is non-null object first).

```ts
// disablePush: replace bare mutate with:
const ok = await unregisterServerToken();
try { localStorage.removeItem(PENDING_UNREGISTER_KEY); } catch {}
if (!ok) { try { localStorage.setItem(PENDING_UNREGISTER_KEY, "1"); } catch {} }
// (clear-then-set: success clears stale flags too)
```

Hmm — localStorage may be unavailable? Desktop always has it (webview). Keep direct calls (existing code uses localStorage directly elsewhere — e.g. launch probe key; verify precedent — yes, `last_health_probe_at` direct). Drop the try/catch wrappers; match file style (check web-push.ts current style first).

```ts
// use-auth logout: replace fire-and-forget with flag fallback:
void (async () => {
  const ok = await unregisterServerToken().catch(() => false);
  — wait, unregisterServerToken never throws (inner try/catch) — just:
  const ok = await unregisterServerToken();
  if (!ok) localStorage.setItem(PENDING_UNREGISTER_KEY, "1");
})();
```

But `unregisterServerToken` lives in web-push.ts — use-auth importing it: check cycle (web-push imports trpc only? verify its imports — if it imports use-auth, cycle! Check first; if cycle, duplicate the 8-line helper or move helper to a neutral module. Decide by reading imports.)

```ts
// server-notifications.ts syncDesktopNotifications — FIRST thing after settings load (before retract? The flag retry needs auth: place after the notificationsEnabled check? If master switch off, skip retry too (retract clears health, not push)... place right after settings load, gated on nothing else? It needs auth for mutate — sync only runs signed-in? Desktop sync runs... App poller gates sync on auth (yes, isAuthenticatedRef). So inside sync, auth holds. Place at top after settings:
const needsUnregister = localStorage.getItem(PENDING_UNREGISTER_KEY) === "1";
if (needsUnregister) {
  const ok = await unregisterServerToken();
  if (ok) localStorage.removeItem(PENDING_UNREGISTER_KEY);
}
```

Import `unregisterServerToken, PENDING_UNREGISTER_KEY` from `./web-push` (check cycle: web-push imports trpc; server-notifications imports trpc too — no cycle with use-auth involved. Verify.)

- [ ] **Step 4: Run to verify**

Run: `pnpm test web-push use-auth` + sync suite (desktop); `pnpm check` (root, 0 errors); `pnpm build` (desktop, exit 0).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/with-timeout.ts desktop/src/lib/web-push.ts desktop/src/hooks/use-auth.ts desktop/src/server-notifications.ts desktop/tests/web-push.test.tsx <use-auth test> (verify via git status)
git commit -m "Fix: bounded unregister with sync retry. TypeScript: 0 errors."
```

---

### Task 4: Document platform limits

**Files:**
- Modify: `desktop/src-tauri/src/lib.rs` (2 comments)
- Test: none (comments only — `cargo check` proves no breakage... comments can't break; run `cargo check` anyway for hygiene? Skip — no, run it: cheap proof of untouched build. Actually comments literally cannot break the build; skip cargo. Hmm — discipline: any src-tauri edit gets `cargo check`. Keep it.)

Verified facts: fallback path location + spawn_blocking site (lib.rs ~95-135 — read first).

- [ ] **Step 1: Add the two comments**

```rust
// macOS/Windows: notify-rust backends expose no click-callback API, so the
// route is intentionally dropped here — the toast focuses the app via OS
// default. Full deep-linking is Linux-only (see spawn path below).
#[cfg(not(target_os = "linux"))]
let _ = route;
```

```rust
// Blocking wait is acceptable: alerts are rare (price/health transitions),
// and Tokio's blocking pool (512 threads) cannot be exhausted by notification
// bursts. No timeout — a late click still deep-links correctly.
tauri::async_runtime::spawn_blocking(move || { ... })
```

Match surrounding comment style (// ─── banners? plain // — copy file idiom).

- [ ] **Step 2: Verify + commit**

Run: `cargo check` (workdir `desktop/src-tauri`, expect 0 errors).
```bash
git add desktop/src-tauri/src/lib.rs
git commit -m "Docs: record tray notification platform limits."
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
