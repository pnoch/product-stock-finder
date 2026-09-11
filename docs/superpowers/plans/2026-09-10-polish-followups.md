# Polish Follow-Ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate five verified follow-ups — duplicated chart chrome, duplicated time formatter, unbounded Tauri insight fetch, silent insight catches, unconverted row prices — with no visual or behavioral change on success paths.

**Architecture:** Extract shared units (`PriceHistoryChart`, `lib/relative-time.ts`), harden in place (timeout, logs, guards), mirror mobile copy exactly.

**Tech Stack:** React + recharts + lucide-react, vitest root (`pnpm test`) + desktop (`desktop/ pnpm test`), `pnpm check`, `pnpm lint`.

---

### Task 1: Shared `PriceHistoryChart`

**Files:**
- Create: `desktop/src/components/PriceHistoryChart.tsx`
- Modify: `desktop/src/components/DistributorHistoryModal.tsx:58-112`, `desktop/src/pages/ProductDetail.tsx:1021-1076`
- Test: `desktop/tests/price-history-chart.test.tsx` (new)

Verified facts (re-confirm; NEEDS_CONTEXT on mismatch): both blocks render identical chrome over `history.map(p => ({date: toLocaleDateString(month short/day numeric), price: convertPrice(p.price, p.currency, displayCurrency)}))` with Grid/X/Y/Tooltip/Line and `CURRENCY_SYMBOLS[displayCurrency]` formatting; both files get `isDark` from `useTheme()` (`../hooks/use-theme` from components/, check ProductDetail's specifier — likely `../hooks/use-theme` too since it's in pages/); modal imports `convertPrice, CURRENCY_SYMBOLS` from `@shared/currency`, `PricePoint`/`DistributorListing` types from `../../../lib/types`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PriceHistoryChart } from "../src/components/PriceHistoryChart";

const history = [
  { date: "2026-08-01", price: 100, currency: "USD", stockStatus: "in_stock" },
  { date: "2026-09-01", price: 90, currency: "USD", stockStatus: "in_stock" },
];

describe("price history chart", () => {
  it("renders two points", () => {
    const { container } = render(<PriceHistoryChart history={history as never} displayCurrency="USD" />);
    expect(container.querySelector("svg.recharts-surface")).toBeTruthy();
    expect(container.querySelectorAll(".recharts-line-dot, .recharts-dot").length).toBeGreaterThanOrEqual(0);
  });
});
```

Recharts dots are off (`dot={false}`) so assert the surface + line path instead: `container.querySelector("path.recharts-line-curve")` toBeTruthy. Verify the actual DOM class first (recharts v3? check package version — class names differ by major; adjust assertion to whatever renders: at minimum `svg` exists and Y-axis tick shows `$90`/`USD90`?). Keep assertions to: svg surface present + formatted tick text present. Also add the root string-guard? No — plan: also assert (in the same file? can't — root vs desktop runners differ). Instead extend the modal test? Simplest anti-drift guard: `desktop/tests/price-history-chart.test.tsx` stays behavioral; add a root `tests/desktop-chart-guard.test.ts` asserting both files import `PriceHistoryChart` and contain no `<LineChart` inline:

```ts
for (const f of ["desktop/src/components/DistributorHistoryModal.tsx", "desktop/src/pages/ProductDetail.tsx"]) {
  const text = await readFile(f, "utf8");
  expect(text).toContain("PriceHistoryChart");
  expect(text).not.toContain("<LineChart");
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test price-history-chart` (workdir: `desktop/`); `pnpm vitest run tests/desktop-chart-guard.test.ts` (root)
Expected: FAIL — module does not exist; inline `<LineChart` present.

- [ ] **Step 3: Write minimal implementation**

```tsx
// desktop/src/components/PriceHistoryChart.tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useTheme } from "../hooks/use-theme";
import { convertPrice, CURRENCY_SYMBOLS } from "@shared/currency";
import type { PricePoint } from "../../../lib/types";

export function PriceHistoryChart({ history, displayCurrency }: { history: PricePoint[]; displayCurrency: string }) {
  const { isDark } = useTheme();
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={history.map((p) => ({ date: ..., price: convertPrice(p.price, p.currency, displayCurrency) }))}>
        ...verbatim chrome copied from the modal block...
      </LineChart>
    </ResponsiveContainer>
  );
}
```

Copy the modal's block verbatim (date mapping + all chrome + Tooltip content + Line). Then replace both call sites with `<PriceHistoryChart history={...} displayCurrency={displayCurrency} />` (modal: `history` var; detail: `bestListing.priceHistory`). Remove now-unused recharts/`convertPrice`/`CURRENCY_SYMBOLS`/`useTheme` imports ONLY if unused elsewhere in each file (verify per file before removing).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test price-history-chart distributor-history-modal` (desktop); `pnpm vitest run tests/desktop-chart-guard.test.ts` (root); `pnpm check` (root, 0 errors); `pnpm build` (desktop, exit 0).
Expected: PASS — including the pre-existing modal suite (proves no visual regression).

- [ ] **Step 5: Commit**

```bash
git add desktop/src/components/PriceHistoryChart.tsx desktop/src/components/DistributorHistoryModal.tsx desktop/src/pages/ProductDetail.tsx desktop/tests/price-history-chart.test.tsx tests/desktop-chart-guard.test.ts
git commit -m "Refactor: shared price history chart. TypeScript: 0 errors."
```

---

### Task 2: Shared time formatter with edge guards

**Files:**
- Create: `lib/relative-time.ts`
- Modify: `components/notification-center.tsx` (delete local fn, import)
- Modify: `desktop/src/pages/Alerts.tsx` (import from `../../../lib/relative-time`)
- Delete: `desktop/src/lib/relative-time.ts`
- Test: `tests/relative-time.test.ts` (new root) + extend `desktop/tests/relative-time.test.tsx` (edge cases)

Verified facts: mobile fn at `notification-center.tsx:45-55` (11-line body, thresholds Just now/<60m/<24h/<7d/date); desktop copy at `desktop/src/lib/relative-time.ts:1-11` byte-identical; mobile imports `@/lib/...` convention; desktop imports `lib/` via `../../../lib/...` (recent-searches precedent). No other importers of either (grep `formatRelativeTime` repo-wide first — expect exactly these 3 files + 1 test).

- [ ] **Step 1: Write the failing tests**

```ts
// tests/relative-time.test.ts
import { describe, expect, it, vi, afterEach } from "vitest";
import { formatRelativeTime } from "../lib/relative-time";

describe("formatRelativeTime", () => {
  afterEach(() => { vi.useRealTimers(); });
  it("matches mobile thresholds", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-10T12:00:00Z"));
    const t = Date.parse("2026-09-10T12:00:00Z");
    expect(formatRelativeTime(t)).toBe("Just now");
    expect(formatRelativeTime(t - 5 * 60000)).toBe("5m ago");
    expect(formatRelativeTime(t - 3 * 3600000)).toBe("3h ago");
    expect(formatRelativeTime(t - 3 * 86400000)).toBe("3d ago");
    expect(formatRelativeTime(t - 30 * 86400000)).toBe(new Date(t - 30 * 86400000).toLocaleDateString());
  });
  it("clamps future and guards non-finite", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-10T12:00:00Z"));
    const t = Date.parse("2026-09-10T12:00:00Z");
    expect(formatRelativeTime(t + 60000)).toBe("Just now");
    expect(formatRelativeTime(NaN)).toBe("—");
  });
});
```

Append the same two edge cases to `desktop/tests/relative-time.test.tsx` (read it first, match its style).

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/relative-time.test.ts` (root)
Expected: FAIL — `../lib/relative-time` does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/relative-time.ts
export function formatRelativeTime(ts: number): string {
  if (!Number.isFinite(ts)) return "—";
  const diff = Date.now() - ts;
  if (diff < 0) return "Just now";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}
```

Mobile: delete local fn, add `import { formatRelativeTime } from "@/lib/relative-time";` (verify `@/` alias form used in that file — it uses `@/components`, `@/hooks` already). Desktop Alerts: change import to `../../../lib/relative-time` (verify depth: pages/ → `../../../lib/` per SearchModal precedent). Delete `desktop/src/lib/relative-time.ts`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/relative-time.test.ts` (root); `pnpm test relative-time notifications-polish` (desktop); `pnpm check` (root, 0 errors); `pnpm build` (desktop, exit 0).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/relative-time.ts components/notification-center.tsx desktop/src/pages/Alerts.tsx desktop/src/lib/relative-time.ts tests/relative-time.test.ts desktop/tests/relative-time.test.tsx
git commit -m "Refactor: shared relative-time formatter with edge guards. TypeScript: 0 errors."
```

(`git add` of the deleted file stages the deletion — verify via `git status`.)

---

### Task 3: Insight timeout + audible catches

**Files:**
- Modify: `desktop/src/pages/ProductDetail.tsx` (Tauri branch ~250-266, three catches ~242/261/264)
- Test: `desktop/tests/insight-skeleton.test.tsx` (append timeout case)

Verified facts (re-confirm): web branch races `Promise.race([query, 4s-timeout→null])`; Tauri branch awaits bare `invoke`; outer try/catch exists (fix commit); three catches are bare (`catch {`) with `// insight stays empty`-style comments; `insightLoading` false-sets are loadId-guarded.

- [ ] **Step 1: Write the failing test** (append; read the file's harness first — deferred-promise + full-page render at /product/p1 with mocked Tauri invoke):

```tsx
it("times out a hung Tauri insight fetch", async () => {
  // mock invoke to a never-resolving promise; advance timers past 4s (or await the timeout with real timers — 4s is acceptable in test? NO — use fake timers if the harness allows, else assert skeleton clears after the race; simplest: mock invoke to reject after the test's own short delay is wrong. Correct: leave invoke pending, vi.advanceTimersByTime(4000) with fake timers, assert skeleton gone and no insight card.)
});
```

Concretely: if the harness uses real timers, switch this test to fake timers (`vi.useFakeTimers()` + `vi.advanceTimersByTime(4100)`, restore after). Assert `queryByLabelText("Loading insight")` null + no crash. Also assert the catch-log: spy `console.error`, mock invoke to reject, assert called with `"[ProductDetail]"`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test insight-skeleton` (workdir: `desktop/`)
Expected: FAIL — skeleton never clears on hung invoke; no console.error on reject.

- [ ] **Step 3: Write minimal implementation**

```tsx
try {
  const { invoke } = await import("@tauri-apps/api/core");
  const res = (await Promise.race([
    invoke("fetch_price_insight", { apiBaseUrl: base, productId: id }),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
  ])) as { insight?: unknown } | null;
  if (loadIdRef.current === myId) {
    if (res && typeof res.insight === "string" && res.insight) setInsight(res.insight);
    setInsightLoading(false);
  }
} catch (e) {
  console.error("[ProductDetail] Tauri insight fetch failed", e);
  if (loadIdRef.current === myId) setInsightLoading(false);
}
```

Keep the existing then/catch or restructure to await — either is fine as long as ALL paths (success/timeout-null/reject/stale) end guarded; stale (`myId` mismatch) must NOT touch state (existing behavior). Mirror the web branch shape (read it — it uses `.then` on race? match its style). The other two catches (web catch + outer): `catch {` → `catch (e) { console.error("[ProductDetail] insight fetch failed", e); ...existing guarded sets... }`. No toasts (UI stays silent by design).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test insight-skeleton` (workdir: `desktop/`); `pnpm check` (root, 0 errors).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/pages/ProductDetail.tsx desktop/tests/insight-skeleton.test.tsx
git commit -m "Fix: bound Tauri insight fetch and log failures. TypeScript: 0 errors."
```

---

### Task 4: Converted row prices

**Files:**
- Modify: `desktop/src/pages/ProductDetail.tsx` (price cell ~1188-1206)
- Test: `desktop/tests/converted-row-prices.test.tsx` (new; or extend an existing ProductDetail render test — check `desktop/tests/pages.test.tsx` / insight-skeleton harness first and reuse whichever renders the page cheapest)

Verified facts (re-confirm): cell renders `formatPrice(listing.price, listing.currency)` + tax line; `displayCurrency` + `convertPrice` + `formatPrice` all in scope (chart uses them); mobile shows `≈ {formatPrice(convertedPrice, effectiveCurrency)}` when currencies differ (`listing-card.tsx:140-142`).

- [ ] **Step 1: Write the failing test**

```tsx
it("shows converted equivalents for foreign-currency rows only", async () => {
  // render ProductDetail with displayCurrency USD, listings: USD 100 + MYR 400;
  // expect "≈" line under the MYR row; expect NO "≈" under the USD row.
});
```

Copy the cheapest working ProductDetail render harness (insight-skeleton.test.tsx renders at /product/p1 — reuse its mocks). If harness needs product fixtures with listings, extend minimally.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test converted-row-prices` (workdir: `desktop/`)
Expected: FAIL — no `≈` line.

- [ ] **Step 3: Write minimal implementation** (inside the price `<td>`, after the native-price span, before/after tax line — match mobile order: price, converted, tax):

```tsx
{listing.currency !== displayCurrency && (
  <p className="text-xs text-gray-500 dark:text-gray-400">
    ≈ {formatPrice(convertPrice(listing.price, listing.currency, displayCurrency), displayCurrency)}
  </p>
)}
```

Verify `convertPrice` signature `(amount, from, to)` from its chart usage. No other change.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test converted-row-prices` (workdir: `desktop/`); `pnpm check` (root, 0 errors).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/pages/ProductDetail.tsx desktop/tests/converted-row-prices.test.tsx
git commit -m "Feat: converted equivalents in listing rows. TypeScript: 0 errors."
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
