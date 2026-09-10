# Server-Side Health Checks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Web/PWA desktop users can run distributor health checks via a new server-side `health.check` endpoint with automatic fallback when Tauri is unavailable.

**Architecture:** New `server/health.ts` reuses `createHealthService` + `testAllDistributors` with an in-memory adapter (client persists results, as today); router entry mirrors `prices.get` (public + rate limit); desktop tries Tauri first, falls back to tRPC, shares the save/stats path.

**Tech Stack:** tRPC v11 (server `server/routers.ts`, `server/_core/trpc`), vitest (root `tests/`, `pnpm test`; desktop `desktop/tests/`, `desktop/ pnpm test`), `pnpm check`, `pnpm lint`.

---

### Task 1: Server `health.check` endpoint

**Files:**
- Create: `server/health.ts`
- Modify: `server/routers.ts` (add `health` router next to `prices`)
- Test: `tests/health-router.test.ts` (new; mock pattern from `tests/prices-router.test.ts`) + `tests/server-health.test.ts` (new contract test)

Verified facts (re-confirm; NEEDS_CONTEXT on mismatch): `createHealthService(adapter)` at `lib/scrapers/health.ts:268`; `StorageAdapter` at `lib/storage/adapter.ts:1` (`getItem/setItem/removeItem/multiRemove`, all async); `testAllDistributors(onProgress?)` handles concurrency/probes/classification internally; `checkRateLimit` imported in routers.ts:49 from `./rate-limit`; `publicProcedure`/`router` from `./_core/trpc`; router test pattern = `vi.mock` server module + `appRouter.createCaller(publicContext)` (read `tests/prices-router.test.ts` fully first for the exact caller form + `TrpcContext` shape).

- [ ] **Step 1: Write the failing router test**

```ts
import { describe, expect, it, vi } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

vi.mock("../server/health", () => ({
  checkAllDistributors: vi.fn().mockResolvedValue([
    {
      distributorId: "test-dist",
      status: "working",
      responseTimeMs: 123,
      lastChecked: new Date().toISOString(),
    },
  ]),
}));

import { checkAllDistributors } from "../server/health";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", hostname: "localhost", headers: {} } as TrpcContext["req"],
    res: { clearCookie: (_name: string, _options: Record<string, unknown>) => {} } as TrpcContext["res"],
    deviceId: null,
  };
}

describe("health.check", () => {
  it("returns server-side distributor health", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.health.check();
    expect(vi.mocked(checkAllDistributors)).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ distributorId: "test-dist", status: "working" });
  });
});
```

Verify `appRouter.createCaller` is the exact form prices-router.test.ts uses (adjust if it uses a different caller construction). If `checkRateLimit` blocks repeated calls in-test (in-memory store keyed by IP), a single call is fine.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/health-router.test.ts tests/server-health.test.ts` (repo root)
Expected: FAIL — `../server/health` does not exist (import error; write the contract test file in Step 1 too — see below — so both fail on missing module).

Contract test (`tests/server-health.test.ts`) — write in Step 1 as well:

```ts
import { describe, expect, it, vi } from "vitest";
import { PARSERS } from "../lib/scrapers/registry";

vi.mock("../lib/scrapers/resilient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/scrapers/resilient")>();
  return {
    ...actual,
    resilientFetch: vi.fn().mockResolvedValue({ status: "ok", html: "<html>probe</html>" }),
  };
});

import { checkAllDistributors } from "../server/health";

describe("checkAllDistributors", () => {
  it("returns one shaped entry per parser", async () => {
    const results = await checkAllDistributors();
    expect(results).toHaveLength(PARSERS.length);
    for (const r of results) {
      expect(typeof r.distributorId).toBe("string");
      expect(["working", "blocked", "error"]).toContain(r.status);
      expect(Number.isNaN(Date.parse(r.lastChecked))).toBe(false);
    }
  });
});
```

Verify the `PARSERS` export name in `lib/scrapers/registry.ts` first (health.ts uses it — confirm exact export). Verify `resilientFetch` is exported from `lib/scrapers/resilient` (server/prices.ts imports it from there — confirmed). If `classifyProbeOutcome` throws on the canned html (parse errors are caught per-parser → "error" status — still in enum, test holds).

- [ ] **Step 3: Write minimal implementation**

```ts
// server/health.ts
import { createHealthService } from "../lib/scrapers/health";
import type { StorageAdapter } from "../lib/storage/adapter";

function memoryAdapter(): StorageAdapter {
  const store = new Map<string, string>();
  return {
    async getItem(key) { return store.get(key) ?? null; },
    async setItem(key, value) { store.set(key, value); },
    async removeItem(key) { store.delete(key); },
    async multiRemove(keys) { keys.forEach((k) => store.delete(k)); },
  };
}

export async function checkAllDistributors() {
  const svc = createHealthService(memoryAdapter());
  return svc.testAllDistributors();
}
```

Note: `testAllDistributors` also writes health + history into the memory adapter (throwaway per call — intended; the CLIENT persists via its own service). Return type flows from the service (no explicit annotation needed, but add it if `pnpm check` wants it).

```ts
// server/routers.ts — add next to `prices` (verify exact insertion point; import checkAllDistributors at top with other server imports):
health: router({
  check: publicProcedure.query(async ({ ctx }) => {
    checkRateLimit(ctx, "health.check", 5, 60_000);
    return checkAllDistributors();
  }),
}),
```

Rate limit 5/min (25 fetches per call vs 1 for prices.get's 60/min).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/health-router.test.ts tests/server-health.test.ts` (root)
Expected: PASS (router 1/1, contract 1/1).

- [ ] **Step 5: Commit**

```bash
git add server/health.ts server/routers.ts tests/health-router.test.ts tests/server-health.test.ts
git commit -m "Feat: server-side distributor health endpoint. TypeScript: 0 errors."
```

---

### Task 2: Desktop web fallback in Health page

**Files:**
- Modify: `desktop/src/pages/Health.tsx` (`runTest` ~87-125)
- Test: `desktop/tests/health-fallback.test.tsx` (new; harness per `desktop/tests/error-paths-safety.test.tsx`: QueryClientProvider + MemoryRouter + mocked storage)

Verified facts (re-confirm; NEEDS_CONTEXT on mismatch): `runTest` calls `invoke("check_distributor_health")` then saves via `createHealthService(localAdapter)` + `recordSample` loop + `computeHealthStats`; `createTRPCClient` from `../lib/trpc` (server-notifications.ts:2,41 uses `createTRPCClient()` then `client.<router>.<proc>.query({})`); Health.tsx already imports `invoke` from `@tauri-apps/api/core`. For the Tauri mock, check `desktop/tests/error-paths-safety.test.tsx` for an existing `@tauri-apps/api/core` mock pattern and copy it; if none exists use `vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }))`.

Server progress channel does not exist — use indeterminate progress: set `setProgress(50)`? Better: animate 0→90 while awaiting (interval), jump 100 on resolve, clear on settle. Simplest robust: `setProgress(0)` at start, `setProgress(100)` on success (skip animation — the button already shows `testing` spinner state; verify a spinner/disabled state exists on the button first and use it).

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";

const mockInvoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke: mockInvoke }));

const mockHealthQuery = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/trpc", () => ({
  createTRPCClient: () => ({ health: { check: { query: mockHealthQuery } } }),
}));

const mockStorage = vi.hoisted(() => ({
  getWatchlist: vi.fn().mockResolvedValue([]),
  getSettings: vi.fn().mockResolvedValue({ displayCurrency: "USD" }),
}));
vi.mock("../src/storage", () => ({ storage: mockStorage }));

import { Health } from "../src/pages/Health";
```

Wait — Health.tsx uses `createHealthService(localAdapter)` directly (real lib service with localAdapter), NOT storage mocks. Read the full Health.tsx first: `localAdapter` import source (`../lib/...`?) and whether `svc.saveDistributorHealth` writes to real localStorage (jsdom has localStorage — fine, no mock needed). The test then:

```tsx
beforeEach(() => { vi.clearAllMocks(); });

function renderHealth() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={qc}><MemoryRouter><Health /></MemoryRouter></QueryClientProvider>);
}

describe("health web fallback", () => {
  it("falls back to the server endpoint when Tauri invoke fails", async () => {
    mockInvoke.mockRejectedValue(new Error("no tauri"));
    mockHealthQuery.mockResolvedValue([
      { distributorId: "d1", status: "working", responseTimeMs: 100, lastChecked: new Date().toISOString() },
    ]);
    renderHealth();
    await userEvent.click(screen.getByRole("button", { name: /test all/i }));
    await waitFor(() => expect(mockHealthQuery).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText(/d1|working/i)).toBeInTheDocument());
  });
  it("still uses Tauri when invoke succeeds", async () => {
    mockInvoke.mockResolvedValue([
      { distributorId: "d1", status: "working", responseTimeMs: 100, lastChecked: new Date().toISOString() },
    ]);
    renderHealth();
    await userEvent.click(screen.getByRole("button", { name: /test all/i }));
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith("check_distributor_health"));
    expect(mockHealthQuery).not.toHaveBeenCalled();
  });
});
```

Verify the "Test All" button's accessible name first (read the JSX); verify `Health` is the exact export name. Adjust queries to match (result rows render distributor names via `getDistributorById` — assert on `mockHealthQuery` call + absence of `healthError`, which is more robust than row text; use both where stable).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test health-fallback` (workdir: `desktop/`)
Expected: FAIL — no fallback branch (invoke rejection → healthError, `mockHealthQuery` never called).

- [ ] **Step 3: Write minimal implementation** — restructure only the fetch half of `runTest` (read lines 87-125 first; keep the listen/progress setup, save/stats path, error box, finally-cleanup byte-identical):

```tsx
let results: DistributorHealth[];
try {
  results = await invoke<DistributorHealth[]>("check_distributor_health");
} catch {
  // Web/PWA: Tauri unavailable — run checks server-side instead.
  console.error("[Health] Tauri check unavailable, falling back to server");
  const { createTRPCClient } = await import("../lib/trpc");
  const client = createTRPCClient();
  results = await client.health.check.query();
}
setHealth(results);
```

Dynamic `import("../lib/trpc")` keeps the Tauri bundle from statically pulling tRPC into the Health chunk? Both are already in the app bundle (App imports both) — so a STATIC import is simpler and equivalent: add `import { createTRPCClient } from "../lib/trpc";` at top (verify no cycle: lib/trpc imports only tRPC client libs — read it first). Prefer static; use dynamic only if check/lint complains.

`DistributorHealth` type: the page defines a LOCAL interface (lines 9-15) — server returns lib's `DistributorHealth` (`lib/scrapers/health`); verify field-compatibility (server: distributorId/status/reason?/responseTimeMs?/lastChecked — local: same). If compatible, the existing `setHealth(results)` needs at most a cast (the Tauri path already does `results as unknown as ...` casts at save time — follow that precedent, do not retype the page).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test health-fallback` (workdir: `desktop/`)
Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add desktop/src/pages/Health.tsx desktop/tests/health-fallback.test.tsx
git commit -m "Feat: server fallback for desktop health checks on web. TypeScript: 0 errors."
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
