# Desktop Polish Bundle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Four mirror-mobile polish items on desktop — in-place distributor history modal, per-type notification icons + relative time, Home refresh, insight skeleton — with zero behavior change elsewhere.

**Architecture:** New modal component + tested util (`desktop/src/lib/`), page-level state additions following existing patterns (recharts mapping, Modal chrome, tailwind skeleton pulse).

**Tech Stack:** React + recharts + lucide-react + react-router, Testing Library + jsdom (`desktop/ pnpm test`), vitest string-guards (root), `pnpm check`, `pnpm lint`.

---

### Task 1: Per-distributor history modal

**Files:**
- Create: `desktop/src/components/DistributorHistoryModal.tsx`
- Modify: `desktop/src/pages/ProductDetail.tsx` (listing rows ~1227-1234, chart mapping ~995-1048)
- Test: `desktop/tests/distributor-history-modal.test.tsx` (new)

Verified facts (re-confirm; NEEDS_CONTEXT on mismatch): rows with a BarChart3 icon `Link` to `/compare/:id?distributor=` (aria-label `View ${name} price history`); best-listing chart maps `priceHistory` → `{date: toLocaleDateString(month short/day numeric), price: convertPrice(...)}` with full recharts chrome (copy the mapping + chrome, swapping `bestListing` for the `listing` prop); `Modal` props `{open, onClose, title}` (`components/Modal.tsx:9-15`); `priceHistoryToCsv(history, {name, modelNumber})` in `lib/csv.ts:94` (imports are type-only + `@shared/currency` + `./currency` — no storage imports, desktop-safe; verify with `pnpm build`); mobile download filename `{productId}-{distributorId}-history.csv` via blob + anchor + revoke.

- [ ] **Step 1: Write the failing tests**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { DistributorHistoryModal } from "../src/components/DistributorHistoryModal";

const listing = {
  distributorId: "d1",
  productId: "p1",
  currency: "USD",
  priceHistory: [
    { date: "2026-08-01", price: 100, currency: "USD", stockStatus: "in_stock" },
    { date: "2026-09-01", price: 90, currency: "USD", stockStatus: "in_stock" },
  ],
};

describe("distributor history modal", () => {
  it("renders the listing chart and downloads CSV", async () => {
    render(
      <MemoryRouter>
        <DistributorHistoryModal open onClose={() => {}} productId="p1" productName="Widget" listing={listing as never} distributorName="Dist One" displayCurrency="USD" />
      </MemoryRouter>,
    );
    expect(screen.getByText(/dist one/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /download csv/i }));
    // assert a download was triggered: anchor with download attr containing p1-d1-history.csv
    await waitFor(() => expect(document.querySelector('a[download*="p1-d1-history.csv"]') ?? true).toBeTruthy());
  });
});
```

The download assertion is weak by nature (jsdom doesn't download) — strengthen it the robust way: spy on `HTMLAnchorElement.prototype.click` and inspect the anchor's `download` + `href` (blob URL). Write it that way (verify `URL.createObjectURL` exists in jsdom — stub it if not: `URL.createObjectURL = vi.fn(() => "blob:mock")`). Also test the row trigger in ProductDetail? That needs full-page render (heavy — ProductDetail tests exist? check `desktop/tests/pages.test.tsx` for a ProductDetail render pattern; if cheap, add: row with ≥2 points shows chart button that opens the modal; else rely on the modal unit test + a root string-guard asserting ProductDetail wires `DistributorHistoryModal` with `listing.priceHistory.length >= 2` gating).

Props contract above (`productId/productName/listing/distributorName/displayCurrency`) is a proposal — read the row scope first (what's in scope: `listing`, `dist` via getDistributorById, `product`, `displayCurrency`) and match; keep the CSV filename `{productId}-{distributorId}-history.csv`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test distributor-history-modal` (workdir: `desktop/`)
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write minimal implementation**

```tsx
// DistributorHistoryModal.tsx
import { useMemo } from "react";
import { Link } from "react-router";
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Modal } from "./Modal";
import { priceHistoryToCsv } from "../../../lib/csv";
import { convertPrice } from "../../../lib/currency"; // verify actual import source used by ProductDetail (same file imports convertPrice — copy its specifier)
import { CURRENCY_SYMBOLS } from "@shared/currency"; // copy ProductDetail's specifier
```

Verify each import specifier against ProductDetail.tsx's own imports first (depth + alias form). Chart: copy the best-listing `<LineChart>` block verbatim, replacing `bestListing.priceHistory` with `listing.priceHistory`. CSV (mirror mobile web path):

```tsx
const handleDownloadCsv = () => {
  const csv = priceHistoryToCsv(listing.priceHistory, { name: distributorName, modelNumber: productId });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${productId}-${listing.distributorId}-history.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};
```

Verify `priceHistoryToCsv`'s exact parameter shape (`(history, {name, modelNumber})` per lib/csv.ts:94 — re-confirm) and the `PricePoint` field names it reads (date/price/currency/stockStatus — fixtures above must satisfy it; read the function body first).

Modal body: title distributorName, chart (min-height guard: only render modal content when `listing.priceHistory.length >= 2` — the trigger guarantees it; still guard), buttons row: Download CSV (aria-label "Download CSV") + `<Link to={/compare/${productId}?distributor=${listing.distributorId}}>Full comparison</Link>`.

ProductDetail wiring: add `const [historyFor, setHistoryFor] = useState<DistributorListing | null>(null);` (verify `DistributorListing` type import exists in the file; if not, import type from lib/types). Change the BarChart3 `Link` into a button when `listing.priceHistory?.length >= 2`:

```tsx
{listing.priceHistory && listing.priceHistory.length >= 2 ? (
  <button onClick={() => setHistoryFor(listing)} aria-label={`View ${dist?.name ?? listing.distributorId} price history`} title="View price history" className="<copy the Link's classes>">
    <BarChart3 className="w-3.5 h-3.5" />
  </button>
) : (
  <Link ...existing compare link as fallback...>...</Link>
)}
```

Keep the compare Link as the <2-points fallback (deep history may exist server-side) AND add the "Full comparison" link inside the modal. Render `<DistributorHistoryModal open={historyFor !== null} onClose={() => setHistoryFor(null)} ... listing={historyFor} />` near the other modals (guard null: render only when historyFor, or make `listing` nullable — choose one, keep types clean).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test distributor-history-modal` (workdir: `desktop/`); `pnpm check` (root, 0 errors); `pnpm build` (workdir: `desktop/`, exit 0 — proves `lib/csv` import is bundle-clean).
Expected: PASS. If `lib/csv` breaks the desktop build (transitive RN import), fall back to a local 10-line CSV builder in the modal (HISTORY_HEADER `product,model,date,price,currency,stockStatus` per lib/csv.ts:9) and note the fallback in the commit message.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/components/DistributorHistoryModal.tsx desktop/src/pages/ProductDetail.tsx desktop/tests/distributor-history-modal.test.tsx
git commit -m "Feat: in-place per-distributor history modal with CSV. TypeScript: 0 errors."
```

---

### Task 2: Notification icons + relative time

**Files:**
- Create: `desktop/src/lib/relative-time.ts` (verify no name clash first)
- Modify: `desktop/src/pages/Alerts.tsx:387-399` (icon + timestamp)
- Test: `desktop/tests/relative-time.test.ts` (new) + extend `desktop/tests/ux-alignment.test.tsx`? No — new `desktop/tests/notification-icons.test.tsx`? Prefer ONE new file `desktop/tests/notifications-polish.test.tsx` covering formatter (import from lib) + row icons (render Alerts notifications tab like error-paths tests do).

Verified facts: `NotificationHistoryEntry.type: "price_drop"|"price_rise"|"restock"|"reminder"|"health"` (`lib/types.ts:119-121`); row renders `<Bell>` always + `toLocaleString()`; icon container already color-codes health/reminder/others (keep those classes, swap only the icon); lucide-react is the icon library (Bell/BellRing/Clock imported in Alerts.tsx — verify `TrendingDown, TrendingUp, CircleCheck, TriangleAlert` exist in the installed lucide-react version before using; fall back to closest available and note it).

- [ ] **Step 1: Write the failing tests**

```ts
// desktop/tests/relative-time.test.ts (pure, no rendering)
import { describe, expect, it, vi, afterEach } from "vitest";
import { formatRelativeTime } from "../src/lib/relative-time";

describe("formatRelativeTime", () => {
  afterEach(() => { vi.useRealTimers(); });
  it("formats just-now, minutes, hours, days, then date", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-10T12:00:00Z"));
    const t = Date.parse("2026-09-10T12:00:00Z");
    expect(formatRelativeTime(t)).toBe("Just now");
    expect(formatRelativeTime(t - 5 * 60000)).toBe("5m ago");
    expect(formatRelativeTime(t - 3 * 3600000)).toBe("3h ago");
    expect(formatRelativeTime(t - 3 * 86400000)).toBe("3d ago");
    expect(formatRelativeTime(t - 30 * 86400000)).toBe(new Date(t - 30 * 86400000).toLocaleDateString());
  });
});
```

Mirror mobile thresholds exactly (`<1m Just now`, `<60m Xm ago`, `<24h Xh ago`, `<7d Xd ago`, else date).

```tsx
// row icons (in notifications-polish.test.tsx): render Alerts on notifications tab with one entry per type (mock getNotificationHistory), assert each row shows its icon — query by the icon's aria-hidden svg? lucide icons accept aria-label? Simplest robust: assert `svg` count = 5 AND snapshot the icon container classes? Better: give each icon a <title>? lucide-react passes `aria-label`? — verify at implementation: use `screen.getByLabelText` only if supported, else assert per-row container class (bg-emerald/bg-amber/bg-red) + title text. Keep it simple: assert the Bell-only rendering is GONE (query all svg, none is the generic Bell for typed rows) + relative time text ("5m ago") present.
```

Write the row test against what lucide supports — inspect first, keep assertions behavioral (icon varies by type; time is relative).

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test relative-time notifications-polish` (workdir: `desktop/`)
Expected: FAIL — module + behavior absent.

- [ ] **Step 3: Write minimal implementation**

```ts
// desktop/src/lib/relative-time.ts
export function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
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

Byte-identical to mobile (`notification-center.tsx:45-55`).

```tsx
// Alerts.tsx row: swap <Bell> for per-type icon, keep container classes:
import { TrendingDown, TrendingUp, CircleCheck, Clock3?, TriangleAlert } from "lucide-react";
const TYPE_ICONS = { price_drop: TrendingDown, price_rise: TrendingUp, restock: CircleCheck, reminder: Clock, health: TriangleAlert };
```

Verify each export exists in installed lucide-react (`grep node_modules/lucide-react/dist/lucide-react.d.ts` or import check via check). Health icon color already red-ish; keep container class logic, change only the glyph. Timestamp line becomes:

```tsx
<p className="text-[11px] text-gray-400 mt-1" title={new Date(n.createdAt).toLocaleString()}>{formatRelativeTime(n.createdAt)}</p>
```

Absolute time preserved as `title` (spec: secondary text — title tooltip satisfies "no information loss"; if rows have room, render absolute after relative — choose title-attr, minimal).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test relative-time notifications-polish` (workdir: `desktop/`); `pnpm check` (root, 0 errors).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/lib/relative-time.ts desktop/src/pages/Alerts.tsx desktop/tests/relative-time.test.ts desktop/tests/notifications-polish.test.tsx
git commit -m "Feat: per-type notification icons and relative time. TypeScript: 0 errors."
```

---

### Task 3: Home manual refresh

**Files:**
- Modify: `desktop/src/pages/Home.tsx` (header ~201-210, `handleRetry` ~122-139)
- Test: `desktop/tests/home-refresh.test.tsx` (new; harness per error-paths tests)

Verified facts (re-confirm): `handleRetry` runs `loadDashboard` + `refreshWatchlist` + `refreshAlerts` with loadError handling; header has title + Add Product link only; `useWatchlist`/`useAlerts`-style `refresh` fns in scope (Home.tsx:89 + alerts hook — read exact names).

- [ ] **Step 1: Write the failing test**

```tsx
it("refreshes the dashboard on demand", async () => {
  // render Home; clear storage/refresh mocks; click Refresh (aria-label "Refresh dashboard");
  // expect loadDashboard's storage calls (getBackOrderReminders) to have been called again.
});
```

Read Home.tsx fully first: mock `../src/storage` (getBackOrderReminders/getSettings/getWatchlist/getAlerts), mock the watchlist/alerts hooks ONLY if they hit network (prefer real hooks with mocked storage — check what useWatchlist does: storage-only? if it calls tRPC trending, mock `../src/lib/trpc` like health-fallback test does). `TrendingSection` may fetch — mock as needed, minimal.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test home-refresh` (workdir: `desktop/`)
Expected: FAIL — no Refresh button.

- [ ] **Step 3: Write minimal implementation** — extract `handleRetry`'s core into `refreshDashboard` (same body), keep `handleRetry = () => void refreshDashboard()` for the error banner, add header button:

```tsx
const [refreshing, setRefreshing] = useState(false);
const refreshDashboard = useCallback(async () => {
  setRefreshing(true);
  try {
    ... existing handleRetry body (setLoadError(null), loadDashboard, refreshWatchlist, refreshAlerts) ...
  } finally {
    setRefreshing(false);
  }
}, [loadDashboard, refreshWatchlist, refreshAlerts]);
```

Careful: existing handleRetry has nested try/catch with THREE sequential blocks (odd but working — read it fully and preserve semantics exactly; only add the refreshing flag + share). Header:

```tsx
<button onClick={() => void refreshDashboard()} disabled={refreshing} aria-label="Refresh dashboard">
  {refreshing ? "Refreshing" : "Refresh"}
</button>
```

Style like the Add Product link's secondary variant (read neighboring classes; keep minimal — no new design).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test home-refresh` (workdir: `desktop/`); `pnpm check` (root, 0 errors).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/pages/Home.tsx desktop/tests/home-refresh.test.tsx
git commit -m "Feat: manual refresh for desktop dashboard. TypeScript: 0 errors."
```

---

### Task 4: Insight loading skeleton

**Files:**
- Modify: `desktop/src/pages/ProductDetail.tsx` (`insight` state :121, fetch effect ~225-250, card ~908-917)
- Test: `desktop/tests/insight-skeleton.test.tsx` (new; or extend distributor-history-modal? No — separate file)

Verified facts (re-confirm): two fetch paths (web tRPC with 4s timeout race :231-234; Tauri invoke :242-246), both guarded by `loadIdRef`; card renders `{insight && (...)}`.

- [ ] **Step 1: Write the failing test**

```tsx
it("shows a skeleton while the insight loads, then the card", async () => {
  // mock trpc insights.get to a NEVER-resolving promise first render → skeleton visible (role="status"? aria-label "Loading insight");
  // then resolve → card with text visible, skeleton gone.
});
```

Simplest robust form: mock `../src/lib/trpc` client with controllable deferred; render ProductDetail (heavy? pages.test.tsx may already render it — check; if ProductDetail render needs extensive mocks, scope the test to whatever harness exists, else test via the web path with delayed resolve). Assert skeleton present while pending + `insight` text after. If full-page render is impractical, NEEDS_CONTEXT (do not fake it).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test insight-skeleton` (workdir: `desktop/`)
Expected: FAIL — no skeleton element.

- [ ] **Step 3: Write minimal implementation**

```tsx
const [insightLoading, setInsightLoading] = useState(false);
```

Set `true` where the effect starts a fetch for the current `myId` (read the effect top — mirror the `loadIdRef.current === myId` guards), `false` next to every `setInsight` and in all settle paths (both branches + catch). Render:

```tsx
{insightLoading ? (
  <div role="status" aria-label="Loading insight" className="...animate-pulse skeleton blocks...">
    <div className="h-3 w-24 rounded bg-gray-200 dark:bg-gray-700" />
    <div className="mt-2 h-4 w-full rounded bg-gray-200 dark:bg-gray-700" />
  </div>
) : insight ? (
  ...existing card unchanged...
) : null}
```

Keep card byte-identical; skeleton styled with existing tailwind idioms (`animate-pulse` — verify tailwind provides it in this project; if custom skeleton classes exist elsewhere in desktop, copy them).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test insight-skeleton` (workdir: `desktop/`); `pnpm check` (root, 0 errors).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/pages/ProductDetail.tsx desktop/tests/insight-skeleton.test.tsx
git commit -m "Feat: loading skeleton for desktop AI insight. TypeScript: 0 errors."
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
