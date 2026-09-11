# Correctness Bundle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Five verified small fixes — chart null-guard, direct storage calls, shared timeout helper, documented stateless health contract, Settings connection text — with no success-path behavior change.

**Architecture:** Filter/guard at the data edge, extract one pure helper, document a contract, mirror mobile copy. Each task is independent — any order.

**Tech Stack:** React + recharts, vitest root (`pnpm test`) + desktop (`desktop/ pnpm test`), `pnpm check`, `pnpm lint`.

---

### Task 1: Chart null-guard

**Files:**
- Modify: `desktop/src/components/PriceHistoryChart.tsx` (data mapping ~27-33, tooltip value)
- Test: `desktop/tests/price-history-chart.test.tsx` (append)

Verified facts (re-confirm): mapping `history.map(p => ({date, price: convertPrice(p.price, p.currency, displayCurrency)}))` with no null handling; tooltip `Number(entry.value).toFixed(2)`; Compare `SeriesChart` has a "No data" empty state (`<div className="text-center text-sm text-gray-400 py-8">No data</div>` — re-confirm exact copy).

- [ ] **Step 1: Write the failing tests** (append to price-history-chart.test.tsx — read it first for fixture style):

```tsx
it("drops unknown-currency points instead of rendering $0", () => {
  const { container } = render(
    <PriceHistoryChart
      history={[
        { date: "2026-08-01", price: 100, currency: "USD", stockStatus: "in_stock" },
        { date: "2026-09-01", price: 400, currency: "XXY", stockStatus: "in_stock" },
      ] as never}
      displayCurrency="USD"
    />,
  );
  // one line point only: assert no $0 tick/tooltip value — simplest: Y tick texts contain no "0" point... robust: query the line path `d` attribute point count? Keep simple: assert container text does NOT contain "$0".
  expect(container.textContent).not.toContain("$0");
});

it("shows empty state when every point is unconvertible", () => {
  const { getByText } = render(
    <PriceHistoryChart
      history={[{ date: "2026-09-01", price: 400, currency: "XXY", stockStatus: "in_stock" }] as never}
      displayCurrency="USD"
    />,
  );
  expect(getByText("No data")).toBeTruthy();
});
```

`"XXY"` must genuinely miss the FX map (verify in `shared/src/currency.ts` — any unknown 3-letter code works; confirm `convertPrice(400, "XXY", "USD")` returns null per `currency.ts:39-43`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test price-history-chart` (workdir: `desktop/`)
Expected: FAIL — `$0` present (Number(null)→0 tick) and no "No data".

- [ ] **Step 3: Write minimal implementation**

```tsx
const points = history
  .map((p) => {
    const price = convertPrice(p.price, p.currency, displayCurrency);
    if (price === null || !Number.isFinite(price)) return null;
    return { date: new Date(p.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }), price };
  })
  .filter((pt): pt is { date: string; price: number } => pt !== null);

if (points.length === 0) return <div className="text-center text-sm text-gray-400 py-8">No data</div>;
```

Then `<LineChart data={points}>`. Keep all chrome/tooltip/Line identical.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test price-history-chart distributor-history-modal` (desktop); `pnpm check` (root, 0 errors).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/components/PriceHistoryChart.tsx desktop/tests/price-history-chart.test.tsx
git commit -m "Fix: drop unconvertible points from history chart. TypeScript: 0 errors."
```

---

### Task 2: Direct storage calls in Alerts loader

**Files:**
- Modify: `desktop/src/pages/Alerts.tsx:137-144`
- Test: none new (existing error-paths tests cover catch; keep green)

Verified facts: `storage.getNotificationHistory?.() as Promise<...>|undefined` + `if (history)` / `typeof unread === "number"` guards; both methods always exist (`lib/storage/notifications.ts:35,72` via `lib/storage/index.ts:160-164` — re-confirm).

- [ ] **Step 1: Confirm current green**

Run: `pnpm test error-paths-safety` (workdir: `desktop/`)
Expected: PASS (baseline before the simplification).

- [ ] **Step 2: Write minimal implementation**

```tsx
const [history, unread] = await Promise.all([
  storage.getNotificationHistory(),
  storage.getUnreadNotificationCount(),
]);
setNotifications(history);
setUnreadCount(unread);
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `pnpm test error-paths-safety ux-alignment notifications-polish` (desktop); `pnpm check` (root, 0 errors).
Expected: PASS — retry test still fails-then-recovers through the same catch.

- [ ] **Step 4: Commit**

```bash
git add desktop/src/pages/Alerts.tsx
git commit -m "Refactor: direct storage calls in Alerts loader. TypeScript: 0 errors."
```

---

### Task 3: Shared `withTimeout`

**Files:**
- Create: `lib/with-timeout.ts`
- Modify: `desktop/src/pages/ProductDetail.tsx` (web race ~230-240, Tauri race ~244-252)
- Test: `tests/with-timeout.test.ts` (new)

Verified facts (re-confirm): both branches `Promise.race([fetch, new Promise<null>(resolve => setTimeout(() => resolve(null), 4000))])`; `lib/` home per relative-time precedent (zero-dep module; desktop imports via `../../../lib/with-timeout` — wait, ProductDetail is in pages/ so `../lib/...`? ProductDetail imports trpc via `../lib/trpc` (verified in health plan) — use `../lib/with-timeout`. Mobile would use `@/lib/with-timeout` but has no caller today — root test covers it).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi, afterEach } from "vitest";
import { withTimeout } from "../lib/with-timeout";

describe("withTimeout", () => {
  afterEach(() => { vi.useRealTimers(); });
  it("resolves the value when fast", async () => {
    await expect(withTimeout(Promise.resolve(7), 4000)).resolves.toBe(7);
  });
  it("resolves null on timeout", async () => {
    vi.useFakeTimers();
    const p = withTimeout(new Promise<string>(() => {}), 4000);
    const assertion = expect(p).resolves.toBeNull();
    await vi.advanceTimersByTimeAsync(4100);
    await assertion;
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/with-timeout.test.ts` (root)
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/with-timeout.ts
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}
```

Replace both inline races with `withTimeout(invoke/query, 4000)`; unify the two log strings to one (`"[ProductDetail] insight fetch failed"` — pick one, drop the Tauri-specific variant; verify no test asserts the old strings first — grep). Keep guarded sets + stale semantics byte-identical.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/with-timeout.test.ts` (root); `pnpm test insight-skeleton` (desktop); `pnpm check` (root, 0 errors); `pnpm build` (desktop, exit 0).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/with-timeout.ts tests/with-timeout.test.ts desktop/src/pages/ProductDetail.tsx
git commit -m "Refactor: shared insight fetch timeout. TypeScript: 0 errors."
```

---

### Task 4: Document stateless health contract

**Files:**
- Modify: `server/health.ts` (comment)
- Test: `tests/server-health.test.ts` (append independence case)

Verified facts: `memoryAdapter()` fresh Map per call; client persists (Health.tsx:117-123).

- [ ] **Step 1: Write the failing test** — there is no behavior to fail; instead write the pinning test FIRST and watch it pass on current code (documents intent). If it fails, the contract is violated → NEEDS_CONTEXT:

```ts
it("keeps no state between calls", async () => {
  const first = await checkAllDistributors();
  const second = await checkAllDistributors();
  expect(first).toHaveLength(second.length);
  // breaker state is per-call: force failure then success would need fetch control — keep the structural pin:
  expect(first.map((r) => r.distributorId).sort()).toEqual(second.map((r) => r.distributorId).sort());
});
```

Honest note: this pins shape-stability, not deep isolation. Strengthen cheaply: mock `resilientFetch` to reject on call 1 for parser X (breaker opens in-call) and resolve on call 2 → call-2 result for X must not be short-circuited by call-1's breaker. The existing contract test already mocks resilientFetch — extend with `mockRejectedValueOnce` sequencing if the mock shape allows; if awkward, keep the structural pin and note why.

- [ ] **Step 2: Add the contract comment**

```ts
// Stateless by design: a fresh adapter per call means breaker state and
// history never persist server-side. The client persists results through its
// own health service (desktop Health page, mobile probe task).
function memoryAdapter(): StorageAdapter {
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `pnpm vitest run tests/server-health.test.ts tests/health-router.test.ts` (root).
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add server/health.ts tests/server-health.test.ts
git commit -m "Docs: pin stateless server health contract. TypeScript: 0 errors."
```

---

### Task 5: Settings connection text

**Files:**
- Modify: `desktop/src/pages/Settings.tsx` (Connection section ~704-718)
- Test: `desktop/tests/settings-connection.test.tsx` (new; check for an existing Settings render harness first — pages.test.tsx renders Settings? It had a Settings trio — copy it)

Verified facts (re-confirm): section has badge + Check-now only; mobile copy at `connection-section.tsx:67-80` (three status lines + last-checked via `formatLastRefreshed(iso)`); `formatLastRefreshed` importable via `../../../lib/last-refreshed` (Home.tsx:15 specifier — same depth? Settings is also in pages/ → same `../../../lib/last-refreshed`); `connection.lastCheckedAt` exists on the hook return (Task 2 review confirmed the five-field shape).

- [ ] **Step 1: Write the failing test**

```tsx
it.each([
  ["connected", "Live price checks are active."],
  ["signed-out", "Sign in to sync prices with the backend."],
  ["offline", "Backend unreachable. Showing saved prices."],
] as const)("explains %s status", async (status, copy) => {
  // render Settings with mocked use-connection {status, lastCheckedAt: <fixed>};
  // expect copy text + "Last checked ..." visible.
});

it("shows Never checked without a timestamp", async () => {
  // lastCheckedAt: null → "Never checked".
});
```

Copy mobile strings verbatim (re-read connection-section.tsx:67-80 first — use its exact text, not my paraphrase).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test settings-connection` (workdir: `desktop/`)
Expected: FAIL — no explanation text.

- [ ] **Step 3: Write minimal implementation** (inside the Connection card, under the badge/button row):

```tsx
<p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
  {connection.status === "connected"
    ? "Live price checks are active."
    : connection.status === "signed-out"
      ? "Sign in to sync prices with the backend."
      : "Backend unreachable. Showing saved prices."}
</p>
<p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
  {connection.lastCheckedAt
    ? `Last checked ${formatLastRefreshed(new Date(connection.lastCheckedAt).toISOString())}`
    : "Never checked"}
</p>
```

Verify `connection.status` covers exactly these three (+ "local"? ConnectionStatus has four values incl. "local" — mobile's ternary lumps everything-else into unreachable; mirror that: non-connected/non-signed-out → unreachable line. Confirm the four-value type first and handle "local" via the else branch).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test settings-connection` (workdir: `desktop/`); `pnpm check` (root, 0 errors).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/pages/Settings.tsx desktop/tests/settings-connection.test.tsx
git commit -m "Feat: connection status explanation in Settings. TypeScript: 0 errors."
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
