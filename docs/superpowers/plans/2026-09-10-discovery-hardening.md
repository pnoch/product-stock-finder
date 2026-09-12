# Discovery Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bounded, surfaced, single-implementation manual-add discovery across all three flows — no success-path behavior change.

**Architecture:** Reject-semantics timeout helper joins `withTimeout` in `lib/`; one `manualAddProduct` flow helper with injected deps; call sites keep UI (progress/toasts/dialogs/reset) and unmount guards.

**Tech Stack:** TypeScript, vitest root (`pnpm test`) + desktop (`desktop/ pnpm test`), `pnpm check`, `pnpm lint`.

---

### Task 1: Shared reject-timeout helper

**Files:**
- Modify: `lib/with-timeout.ts` (add `withTimeoutReject`)
- Modify: `components/search/manual-add-sheet.tsx` (adopt, delete local)
- Test: `tests/with-timeout.test.ts` (append)

Verified facts (re-confirm): shared helper has `withTimeout` (null semantics, finally-clear); sheet-local `withTimeoutReject` (reject `Error("timeout")`, NO finally-clear — hygiene fix rides along); mobile branches `e.message === "timeout"`; sheet imports shared `withTimeout`? (check — if it imports anything from lib/with-timeout already, extend that import).

- [ ] **Step 1: Write the failing tests** (append to tests/with-timeout.test.ts — read it first):

```ts
import { withTimeoutReject } from "../lib/with-timeout";

describe("withTimeoutReject", () => {
  it("resolves fast values", async () => {
    await expect(withTimeoutReject(Promise.resolve(3), 15000)).resolves.toBe(3);
  });
  it("rejects with timeout error and clears its timer", async () => {
    vi.useFakeTimers();
    const p = withTimeoutReject(new Promise<string>(() => {}), 15000);
    expect(vi.getTimerCount()).toBe(1);
    const assertion = expect(p).rejects.toThrow("timeout");
    await vi.advanceTimersByTimeAsync(15100);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm vitest run tests/with-timeout.test.ts` (root)
Expected: FAIL — no such export.

- [ ] **Step 3: Write minimal implementation**

```ts
export function withTimeoutReject<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}
```

Sheet: delete local, import from `@/lib/with-timeout` (verify alias form in that file — it uses `@/`? check first). Message `"timeout"` preserved (mobile branches on it).

- [ ] **Step 4: Run to verify**

Run: `pnpm vitest run tests/with-timeout.test.ts` (root); manual-add mobile suites (grep tests for manual-add coverage — run any found); `pnpm check` (root, 0 errors).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/with-timeout.ts tests/with-timeout.test.ts components/search/manual-add-sheet.tsx
git commit -m "Refactor: shared reject-timeout helper. TypeScript: 0 errors."
```

---

### Task 2: Shared `manualAddProduct` flow

**Files:**
- Create: `lib/manual-add.ts`
- Test: `tests/manual-add.test.ts` (new)

Verified facts: mobile flow (guard → add empty → bounded discover → update → toasts) is the reference; desktop flows mirror minus timeout/guard-uniformity; `discoverListings(model, {productId, onProgress})` signature; `customProductSlug`, `addToWatchlist`, `updateProductListings` shapes.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { manualAddProduct, DISCOVER_TIMEOUT_MS } from "../lib/manual-add";

function deps(overrides = {}) {
  return {
    storage: {
      addToWatchlist: vi.fn(async () => {}),
      updateProductListings: vi.fn(async () => {}),
    },
    trackedIds: new Set<string>(),
    discover: vi.fn(async () => []),
    timeoutMs: DISCOVER_TIMEOUT_MS,
    ...overrides,
  };
}

const input = { id: "crs326", name: "CRS326", modelNumber: "CRS326-24G", brand: "MikroTik", category: "Switches", description: "" };

describe("manualAddProduct", () => {
  it("returns duplicate without writing", async () => {
    const d = deps({ trackedIds: new Set(["crs326"]) });
    await expect(manualAddProduct({ ...d, input })).resolves.toEqual({ status: "duplicate" });
    expect(d.storage.addToWatchlist).not.toHaveBeenCalled();
  });
  it("creates, discovers, and updates", async () => {
    const found = [{ distributorId: "d1" }];
    const d = deps({ discover: vi.fn(async () => found) });
    await expect(manualAddProduct({ ...d, input })).resolves.toEqual({ status: "created", discovered: 1, timedOut: false });
    expect(d.storage.addToWatchlist).toHaveBeenCalledWith(expect.objectContaining({ id: "crs326", listings: [] }));
    expect(d.storage.updateProductListings).toHaveBeenCalledWith("crs326", found);
  });
  it("times out to empty without throwing", async () => {
    vi.useFakeTimers();
    const d = deps({ discover: vi.fn(() => new Promise(() => {})) });
    const p = manualAddProduct({ ...d, input });
    await vi.advanceTimersByTimeAsync(DISCOVER_TIMEOUT_MS + 100);
    await expect(p).resolves.toEqual({ status: "created", discovered: 0, timedOut: true });
    expect(d.storage.updateProductListings).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
  it("rethrows add failures", async () => {
    const d = deps({ storage: { addToWatchlist: vi.fn(async () => { throw new Error("db"); }), updateProductListings: vi.fn() } });
    await expect(manualAddProduct({ ...d, input })).rejects.toThrow("db");
  });
  it("propagates onProgress", async () => {
    const onProgress = vi.fn();
    const d = deps({ discover: vi.fn(async (_m, o) => { o?.onProgress?.(1, 2); return []; }) });
    await manualAddProduct({ ...d, input, onProgress });
    expect(onProgress).toHaveBeenCalledWith(1, 2);
  });
});
```

Timeout constant: `DISCOVER_TIMEOUT_MS = 15_000` — move from sheet to `lib/manual-add.ts` and export (sheet imports it; desktop uses it too). Fixture listings: use minimal casts (`as never` if the DistributorListing type is heavy — verify; prefer valid partial fixtures).

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm vitest run tests/manual-add.test.ts` (root)
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/manual-add.ts
import { customProductSlug } from "./listing-discovery";
import { withTimeoutReject } from "./with-timeout";
import type { DistributorListing } from "./types";

export const DISCOVER_TIMEOUT_MS = 15_000;

export interface ManualAddInput {
  id: string; // NOTE: callers pass customProductSlug(modelNumber) — mobile mints it, desktop too (post slug-alignment)
  name: string;
  modelNumber: string;
  brand: string;
  category: string;
  description: string;
}

export type ManualAddResult =
  | { status: "duplicate" }
  | { status: "created"; discovered: number; timedOut: boolean };

export async function manualAddProduct(deps: {
  storage: {
    addToWatchlist(product: {...}): Promise<unknown>;
    updateProductListings(id: string, listings: DistributorListing[]): Promise<unknown>;
  };
  trackedIds: { has(id: string): boolean };
  discover: (model: string, opts: { productId: string; onProgress?: (done: number, total: number) => void }) => Promise<DistributorListing[]>;
  input: ManualAddInput;
  onProgress?: (done: number, total: number) => void;
  timeoutMs?: number;
}): Promise<ManualAddResult> {
  const { storage, trackedIds, discover, input, onProgress, timeoutMs = DISCOVER_TIMEOUT_MS } = deps;
  if (trackedIds.has(input.id)) return { status: "duplicate" };
  await storage.addToWatchlist({
    ...input,
    isWatched: true,
    addedAt: new Date().toISOString(),
    listings: [],
  });
  let listings: DistributorListing[];
  let timedOut = false;
  try {
    listings = await withTimeoutReject(
      discover(input.modelNumber, { productId: input.id, onProgress }),
      timeoutMs,
    );
  } catch (e) {
    if (e instanceof Error && e.message === "timeout") {
      listings = [];
      timedOut = true;
    } else {
      throw e;
    }
  }
  if (listings.length > 0) await storage.updateProductListings(input.id, listings);
  return { status: "created", discovered: listings.length, timedOut };
}
```

Type the storage/product params with real `Product`/`Storage` types if assignable from all three callers (prefer real; fall back to structural on mismatch — verify at check). `isWatched/addedAt` match all three current call sites (verify desktop passes the same — it does: `isWatched: true, addedAt`).

- [ ] **Step 4: Run to verify**

Run: `pnpm vitest run tests/manual-add.test.ts tests/with-timeout.test.ts` (root); `pnpm check` (root, 0 errors).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/manual-add.ts lib/with-timeout.ts tests/manual-add.test.ts tests/with-timeout.test.ts
git commit -m "Feat: shared manual-add flow helper. TypeScript: 0 errors."
```

(Task 1's file `components/search/manual-add-sheet.tsx` adopts in Task 3 below — NOT here. Task 2 is helper-only.)

---

### Task 3: Adopt in all three flows + desktop retry

**Files:**
- Modify: `components/search/manual-add-sheet.tsx` (adopt + DISCOVER_TIMEOUT_MS import)
- Modify: `desktop/src/pages/Search.tsx` (adopt + retry box)
- Modify: `desktop/src/components/SearchModal.tsx` (adopt + retry box)
- Test: extend `desktop/tests/manual-add-ai.test.tsx` (timeout + retry + shared-flow cases)

Verified facts (re-confirm per file): mobile activeRef/active unmount guards stay OUTSIDE the helper (helper has no lifecycle); mobile toast/reset/close/Haptics unchanged; desktop toasts/progress UI; `discoverError` taxonomy is parse-only (helper covers ADD flow).

**Retry design (spec §B):** `lib/manual-add.ts` also exports `rediscoverProduct({storage, discover, productId, modelNumber, onProgress, timeoutMs})` — bounded discover + update-if-hits, returns `{discovered, timedOut}` (no add, no guard). Desktop modals: on timeout the modal STAYS OPEN showing inline "Discovery timed out" + Retry (re-runs rediscover with progress) + Done (closes). Mobile sheet: timeout path unchanged (background price checks self-heal listings; existing "we'll keep watching" copy covers it) — documented platform-UX asymmetry, not a behavior gap.

- [ ] **Step 1: Extend tests FIRST** (desktop manual-add-ai.test.tsx):

```tsx
it("times out hung discovery and keeps the product", async () => {
  // discoverListings never-resolves; fake timers advance 15.1s;
  // assert timeout toast ("Added X with no listings — discovery found nothing" — verify current copy) + addToWatchlist called + updateProductListings NOT called + Add re-enabled + modal STAYS OPEN with Retry visible.
});
it("retries discovery after timeout without duplicating", async () => {
  // first attempt times out; mock discoverListings to resolve 2 listings; click Retry;
  // assert updateProductListings called once with found + no second addToWatchlist + trackedIds unchanged.
});
```

Mobile: no dedicated sheet suite exists? (grep tests for manual-add-sheet coverage — if none, the root helper tests + check carry it; note in report.)

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm test manual-add-ai` (workdir: `desktop/`)
Expected: FAIL — hangs (test would time out itself! Use fake timers BEFORE the hang: with real timers a never-resolving discovery hangs the test — write the test with `vi.useFakeTimers()` + advance from the start, so pre-fix code... pre-fix has NO timeout: advancing timers does nothing, promise never resolves → test times out. That's still a "fail" (timeout). Acceptable RED: configure `testTimeout: 10_000`? Default 5s vitest timeout → fails by timeout. OK — document that RED = test timeout.)

- [ ] **Step 3: Adopt in all three**

Mobile sheet `handleAdd`: replace guard→update block with:

```tsx
import { manualAddProduct, DISCOVER_TIMEOUT_MS } from "@/lib/manual-add"; // verify alias; drop local DISCOVER_TIMEOUT_MS + withTimeoutReject import (now shared)
...
const result = await manualAddProduct({
  storage: { addToWatchlist, updateProductListings }, // verify these are imported fns in the sheet (it calls them bare — confirm import source)
  trackedIds,
  discover: discoverListings, // verify current call form `discoverListings(modelNumber, {...})` — pass through directly
  input: { id, name, modelNumber, brand: draft.brand.trim(), category: draft.category.trim() || "Other", description: draft.description.trim() },
  onProgress: (done, total) => { if (active && activeRef.current) setProgress(`Searching distributors ${done}/${total}…`); },
});
```

Keep: outer try/catch (add-failure + non-timeout errors → "Couldn't add product"), `active` guards AROUND the call (if unmounted → return before toasts), progress/reset/close/Haptics/toasts. The helper throws only on non-timeout discovery errors + add failures — mobile's catch handles both as today (verify current catch covers both — yes, single outer catch).

Desktop Search + Modal: replace create→discover→update blocks with the helper; keep toasts/modal-close/progress UI; keep `discoverError` taxonomy for PARSE errors (helper only covers the ADD flow, not parsing — parse stays as-is).

- [ ] **Step 4: Run to verify**

Run: `pnpm test manual-add-ai` (desktop); mobile manual-add suites if any; `pnpm check` (root, 0 errors); `pnpm build` (desktop, exit 0).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/search/manual-add-sheet.tsx desktop/src/pages/Search.tsx desktop/src/components/SearchModal.tsx desktop/tests/manual-add-ai.test.tsx
git commit -m "Refactor: all manual-add flows share one helper. TypeScript: 0 errors."
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
