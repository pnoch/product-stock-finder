# Small Leftovers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace a white-box test with a behavioral one, surface connection status on Home, and make the Compare chart fluid — no visual or behavioral change otherwise.

**Architecture:** Test-only replacement; existing-component reuse (`ConnectionBadge`, `useConnection`); container-measured SVG width with clamped fallback.

**Tech Stack:** React + Testing Library + jsdom (`desktop/ pnpm test`), `ResizeObserver` (guarded), `pnpm check`, `pnpm lint`.

---

### Task 1: Behavioral modal-wiring test

**Files:**
- Modify: `desktop/tests/distributor-history-modal.test.tsx` (replace white-box test)

Verified facts (re-confirm; NEEDS_CONTEXT on mismatch): white-box test at lines ~88-93 (`readFile("src/pages/ProductDetail.tsx")` + three `toContain`s); converted-row + insight-skeleton tests render `ProductDetail` at `/product/p1` with mocked storage/api-base/tRPC/Tauri — copy the cheapest harness (converted-row-prices.test.tsx: fixtures USD-100 + MYR-400; extend the fixture product with a ≥2-point history on one listing, or reuse insight-skeleton's product if it already has one — read both first).

- [ ] **Step 1: Replace the test**

```tsx
it("opens the modal from a listing row with >=2 points", async () => {
  // render ProductDetail (copied harness); click the "View <name> price history" button;
  // assert Download CSV button + distributor name appear; assert compare fallback link absent for that row.
});
```

Keep the test's existing imports (drop `readFile` if now unused — verify no other test in the file uses it). If the click-through proves impractical after a genuine attempt (harness can't produce the row), STOP → NEEDS_CONTEXT with the specific blocker (do not keep the grep test silently).

- [ ] **Step 2: Run test to verify it passes**

Run: `pnpm test distributor-history-modal` (workdir: `desktop/`)
Expected: PASS — all tests behavioral (the two pre-existing render tests + the new one).

- [ ] **Step 3: Commit**

```bash
git add desktop/tests/distributor-history-modal.test.tsx
git commit -m "Test: behavioral modal-wiring coverage. TypeScript: 0 errors."
```

---

### Task 2: Home connection badge

**Files:**
- Modify: `desktop/src/pages/Home.tsx` (header ~201-210)
- Test: `desktop/tests/home-refresh.test.tsx` (append badge case — read it first for the harness)

Verified facts (re-confirm): Home imports `useNavigate` from react-router already; needs `useConnection` from `../hooks/use-connection` + `ConnectionBadge` from `../components/ConnectionBadge` (App.tsx:8-9 specifiers — copy); `ConnectionStatus = "connected"|"signed-out"|"offline"|"local"`; App passes `status` + signed-out→`/settings` navigate. `useConnection()` returns `{status}` at least (use-connection.ts:53-60 — verify exact return shape; if it returns more, ignore the rest).

- [ ] **Step 1: Write the failing test** (append to home-refresh.test.tsx):

```tsx
it("shows connection status in the header", async () => {
  // with connection mocked signed-out (mock ../hooks/use-connection — check how: does the harness already mock it? useConnection likely reads navigator.onLine + auth state; simplest: mock the module with signed-out status);
  // assert "Signed out" badge visible in header; click → navigates to /settings (MemoryRouter assertion).
});
```

Read the existing harness first: if `useConnection` isn't mocked, add `vi.mock("../src/hooks/use-connection", ...)`? Careful — module path from test file is `../src/hooks/use-connection`. Mock `{useConnection: () => ({status: "signed-out"})}` — verify the real return shape first so the mock satisfies consumers (other components in the tree may use more fields — Home tree only: check).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test home-refresh` (workdir: `desktop/`)
Expected: FAIL — no badge in Home header.

- [ ] **Step 3: Write minimal implementation** (Home header, beside Add Product link):

```tsx
const connection = useConnection();
...
<div className="flex items-center gap-2">
  <ConnectionBadge
    status={connection.status}
    onPress={connection.status === "signed-out" ? () => navigate("/settings") : undefined}
  />
  <Link ...Add Product (existing, unchanged)...>...</Link>
</div>
```

Verify `navigate` is in scope (imported line 1 — confirm it's actually used/bound in the component; if `useNavigate()` isn't called yet, add `const navigate = useNavigate();` near other hooks). Copy App.tsx:65-71 props exactly.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test home-refresh` (workdir: `desktop/`); `pnpm check` (root, 0 errors).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/pages/Home.tsx desktop/tests/home-refresh.test.tsx
git commit -m "Feat: connection badge on desktop dashboard. TypeScript: 0 errors."
```

---

### Task 3: Responsive Compare chart

**Files:**
- Modify: `desktop/src/pages/Compare.tsx` (`SeriesChart`, ~51-112 + usage ~621/626 untouched)
- Test: `desktop/tests/compare-chart-width.test.tsx` (new; check for an existing Compare render test first — if `pages.test.tsx` or similar renders Compare, extend it instead of a new file)

Verified facts (re-confirm): `const width = 640; height = 280;` with pads; hover math uses `getBoundingClientRect` (CSS px) so measured-width SVG keeps it exact; wrapper `div.w-full.overflow-x-auto` + inner `div.relative.mx-auto style={{width, height}}`; two `SeriesChart` usages share the component (both become responsive automatically); jsdom has no `ResizeObserver` (fallback required).

- [ ] **Step 1: Write the failing test**

```tsx
it("falls back to 640px without ResizeObserver", () => {
  // render Compare/SeriesChart in jsdom (no ResizeObserver) and assert svg width 640.
});
```

Concretely: if a Compare page harness exists, render with 2-point series and assert `svg[width="640"]`. If none exists, create the minimal render (mock storage + route `/compare/p1` — check how pages.test.tsx renders routed pages first and copy). The clamp helper is a pure reusable unit: export `clampChartWidth(measured: number)` from Compare.tsx and unit-test it directly (`clamp(200)→320`, `clamp(640)→640`, `clamp(2000)→960`).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test compare-chart-width` (or the extended file; workdir: `desktop/`)
Expected: FAIL — no `clampChartWidth` export / fixed 640 only.

- [ ] **Step 3: Write minimal implementation**

```tsx
export function clampChartWidth(measured: number): number {
  return Math.min(960, Math.max(320, Math.floor(measured)));
}

// inside SeriesChart:
const wrapRef = useRef<HTMLDivElement | null>(null);
const [measured, setMeasured] = useState<number | null>(null);
useEffect(() => {
  const el = wrapRef.current;
  if (!el || typeof ResizeObserver === "undefined") return;
  const ro = new ResizeObserver((entries) => {
    const w = entries[0]?.contentRect.width;
    if (typeof w === "number" && Number.isFinite(w)) setMeasured(w);
  });
  ro.observe(el);
  return () => ro.disconnect();
}, []);
const width = measured === null ? 640 : clampChartWidth(measured);
```

Verify `useRef/useEffect/useState` imported in Compare.tsx (likely — check). Wrapper becomes `<div ref={wrapRef} className="w-full">` (drop `overflow-x-auto`; inner div keeps `relative mx-auto` + measured style). Everything else (pads, coords, hover, a11y label) untouched — all derive from `width`.

- [ ] **Step 4: Run test to verify it passes**

Run: new/extended suite (workdir: `desktop/`); `pnpm check` (root, 0 errors); `pnpm build` (workdir: `desktop/`, exit 0).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/pages/Compare.tsx desktop/tests/compare-chart-width.test.tsx
git commit -m "Feat: responsive desktop compare chart. TypeScript: 0 errors."
```

(Adjust staged test path if an existing file was extended instead; verify via `git status`.)

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
