# Small UX Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align four desktop behaviors with their tested mobile equivalents: active-only alerts count, persisted deal sort, working tags pointer, manual notification refresh.

**Architecture:** Mirror-mobile, no new infra. Each task is independent (different files) — any order works.

**Tech Stack:** React + react-router (desktop), Testing Library + jsdom (desktop/tests, `desktop/ pnpm test`), vitest string-guards (root `tests/`), `pnpm check`, `pnpm lint`.

---

### Task 1: Active-only alerts tab count

**Files:**
- Modify: `desktop/src/pages/Alerts.tsx:280` (tab label)
- Test: `desktop/tests/ux-alignment.test.tsx` (new; follow `desktop/tests/error-paths-safety.test.tsx` harness: QueryClientProvider + mocked `../src/storage`, MemoryRouter)

Desktop `useAlerts` (`desktop/src/hooks/use-storage.ts:36`) returns `{alerts, loading, refresh}` with full `PriceAlert[]` (`lib/types.ts:97-103` has `isActive`, `triggeredAt?`, `snoozedUntil?`). Compute the count in the page.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";

const mockStorage = vi.hoisted(() => ({
  getWatchlist: vi.fn().mockResolvedValue([]),
  getAlerts: vi.fn().mockResolvedValue([]),
  getSettings: vi.fn().mockResolvedValue({ displayCurrency: "USD" }),
  getBackOrderReminders: vi.fn().mockResolvedValue([]),
  getStockWatches: vi.fn().mockResolvedValue([]),
  getNotificationHistory: vi.fn().mockResolvedValue([]),
  getUnreadNotificationCount: vi.fn().mockResolvedValue(0),
}));

vi.mock("../src/storage", () => ({ storage: mockStorage }));

import { Alerts } from "../src/pages/Alerts";

function renderAlerts() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={qc}><MemoryRouter><Alerts /></MemoryRouter></QueryClientProvider>);
  return qc;
}

beforeEach(() => { vi.clearAllMocks(); });

describe("alerts tab count", () => {
  it("counts only active, untriggered, unsnoozed alerts", async () => {
    const snoozed = new Date(Date.now() + 86400000).toISOString();
    mockStorage.getAlerts.mockResolvedValue([
      { id: "a1", productId: "p", targetPrice: 10, currency: "USD", isActive: true },
      { id: "a2", productId: "p", targetPrice: 10, currency: "USD", isActive: true, triggeredAt: new Date().toISOString() },
      { id: "a3", productId: "p", targetPrice: 10, currency: "USD", isActive: true, snoozedUntil: snoozed },
      { id: "a4", productId: "p", targetPrice: 10, currency: "USD", isActive: false },
    ]);
    renderAlerts();
    await waitFor(() => expect(screen.getByRole("button", { name: /show price alerts/i })).toHaveTextContent("Alerts (1)"));
  });
});
```

Adjust ONLY if the real page demands it (verify the tab button's accessible name is "Show price alerts" at Alerts.tsx:277; verify `PriceAlert` required fields beyond the ones above — add minimal stubs). If `getByRole` matches multiple elements, scope with `within` or match exact text.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test ux-alignment` (workdir: `desktop/`)
Expected: FAIL — label reads "Alerts (4)".

- [ ] **Step 3: Write minimal implementation** — in `Alerts.tsx`, above the return (near `triggeredAlerts` useMemo ~line 546, or next to it):

```tsx
const activeAlertCount = useMemo(
  () =>
    alerts.filter(
      (a) => a.isActive && !a.triggeredAt && (!a.snoozedUntil || new Date(a.snoozedUntil).getTime() <= Date.now()),
    ).length,
  [alerts],
);
```

Change line 280 `Alerts ({alerts.length})` → `Alerts ({activeAlertCount})`. Formula is verbatim mobile (`hooks/use-alerts-data.ts:294`).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test ux-alignment` (workdir: `desktop/`)
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add desktop/src/pages/Alerts.tsx desktop/tests/ux-alignment.test.tsx
git commit -m "Fix: desktop alerts tab counts active alerts only. TypeScript: 0 errors."
```

---

### Task 2: Persist deal sort

**Files:**
- Modify: `lib/types.ts:151` (widen `watchlistSortKey`), `desktop/src/pages/Watchlist.tsx:271` (remove carve-out)
- Test: `desktop/tests/ux-alignment.test.tsx` (append)

Facts verified: `watchlistSortKey?: "name" | "price" | "trend" | "lastUpdated"` (no `"deal"`); desktop `SortKey` includes `"deal"`; saver at Watchlist.tsx:271 excludes deal; loader at :256 (`s.watchlistSortKey ?? "name"`) passes any stored value straight into `setSortKey` (typed `SortKey` — widening the shared type keeps this sound). `watchlistSortKey` appears NOWHERE in `drizzle/` or `server/` (settings sync as whole object — no migration, no server change). Mobile uses a different key (`watchlistSort`), so no cross-talk.

- [ ] **Step 1: Write the failing tests**

```tsx
it("persists the deal sort to settings", async () => {
  // render Watchlist with one product; select "Best deals" sort via its sort control;
  // expect storage.saveSettings to have been called with object containing watchlistSortKey: "deal"
});
```

Implementation detail for the test author: find the sort control by its accessible name (read Watchlist.tsx `handleSort` ~line 518 and the sort-button markup first). Mock `storage.getSettings` to resolve full settings, `storage.saveSettings` to resolve. If driving the UI control is brittle, acceptable alternative: assert via the save path — set sort through the control and await `waitFor(() => expect(mockStorage.saveSettings).toHaveBeenCalledWith(expect.objectContaining({ watchlistSortKey: "deal" })))`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test ux-alignment` (workdir: `desktop/`)
Expected: FAIL — saveSettings called with the PREVIOUS sort key, never "deal".

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/types.ts:151
watchlistSortKey?: "name" | "price" | "deal" | "trend" | "lastUpdated";
```

```tsx
// Watchlist.tsx:271 — remove carve-out:
.then((s) => storage.saveSettings({ ...s, watchlistInStockOnly: inStockOnly, watchlistPriceRange: priceRange ?? null, watchlistGroup: groupMode, watchlistSortKey: sortKey, watchlistSortAsc: sortAsc }))
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test ux-alignment` (workdir: `desktop/`); `pnpm check` (root, 0 errors — proves the widened type breaks nothing else; grep for other `watchlistSortKey` consumers first: only Watchlist.tsx uses it per verification).
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts desktop/src/pages/Watchlist.tsx desktop/tests/ux-alignment.test.tsx
git commit -m "Fix: persist desktop deal sort across reloads. TypeScript: 0 errors."
```

---

### Task 3: Tags empty-state points to Watchlist

**Files:**
- Modify: `desktop/src/components/SearchModal.tsx:438`
- Test: `tests/desktop-tags-pointer-guard.test.ts` (new root string-guard)

`SearchModal` is rendered inside `<HashRouter>` (`desktop/src/App.tsx:316-324`), so `useNavigate` from `react-router` works (same package `desktop/src/pages/Search.tsx` already imports `useNavigate` from — verify the exact import specifier there and copy it).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("search modal tags pointer", () => {
  it("points tag creation at the watchlist, not settings", async () => {
    const text = await readFile("desktop/src/components/SearchModal.tsx", "utf8");
    expect(text).toContain("Create tags in Watchlist");
    expect(text).not.toContain("Create tags in Settings");
    expect(text).toContain("/watchlist");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/desktop-tags-pointer-guard.test.ts` (repo root)
Expected: FAIL (still says "Create tags in Settings").

- [ ] **Step 3: Write minimal implementation** — replace line 438's paragraph with copy + navigation that closes the modal (match the file's existing button styling; read neighboring buttons first):

```tsx
{Object.keys(tagDefinitions).length === 0 && (
  <div>
    <p className="text-sm text-gray-500">No tags yet. Create tags in Watchlist.</p>
    <button
      onClick={() => { onClose(); navigate("/watchlist"); }}
      aria-label="Go to watchlist to create tags"
    >
      Go to Watchlist
    </button>
  </div>
)}
```

Add `import { useNavigate } from "react-router";` (verify specifier vs Search.tsx's import) and `const navigate = useNavigate();` in the component. There are TWO identical empty-state lines (438 and ~452 — one per tag-picker location); fix BOTH (grep `Create tags in Settings` to find all).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/desktop-tags-pointer-guard.test.ts` (root)
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add desktop/src/components/SearchModal.tsx tests/desktop-tags-pointer-guard.test.ts
git commit -m "Fix: point empty tag state at Watchlist creation. TypeScript: 0 errors."
```

---

### Task 4: Notifications tab refresh

**Files:**
- Modify: `desktop/src/pages/Alerts.tsx` (notifications tab header ~line 330-340)
- Test: `desktop/tests/ux-alignment.test.tsx` (append)

Facts verified: `loadNotifications` (`Alerts.tsx:121`) reloads history+unread and surfaces errors via `notifError` + Retry. `syncDesktopNotifications` (`desktop/src/server-notifications.ts:81`) is best-effort (outer try/catch swallows — never throws; signed-out it resolves to no-events). Mobile `onRefresh` = server pull + reload. Desktop equivalent: `await syncDesktopNotifications(); await loadNotifications();`.

- [ ] **Step 1: Write the failing test**

```tsx
it("refreshes notifications on demand", async () => {
  // render Alerts on the notifications tab (click "Show notifications" first, as error-paths tests do);
  // clear getNotificationHistory mock calls; click Refresh (aria-label "Refresh notifications");
  // expect getNotificationHistory to have been called again.
});
```

Check `error-paths-safety.test.tsx` for the exact tab-switch pattern ("Show notifications" tab click) and copy it.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test ux-alignment` (workdir: `desktop/`)
Expected: FAIL — no "Refresh notifications" button exists.

- [ ] **Step 3: Write minimal implementation** — next to the "Mark all read" button (~line 330):

```tsx
const [refreshing, setRefreshing] = useState(false);
const handleRefreshNotifications = useCallback(async () => {
  setRefreshing(true);
  try {
    await syncDesktopNotifications();
  } finally {
    await loadNotifications();
    setRefreshing(false);
  }
}, [loadNotifications]);
```

```tsx
<button
  onClick={() => void handleRefreshNotifications()}
  disabled={refreshing}
  aria-label="Refresh notifications"
>
  {refreshing ? "Refreshing" : "Refresh"}
</button>
```

Import: `import { syncDesktopNotifications } from "../server-notifications";` (verify path: Alerts.tsx is in `pages/`, module in `src/` → `../server-notifications`; matches `App.tsx:34` form `from "./server-notifications"` adjusted for depth). `finally` guarantees the local reload + flag reset even if sync throws (defensive; it shouldn't).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test ux-alignment` (workdir: `desktop/`)
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add desktop/src/pages/Alerts.tsx desktop/tests/ux-alignment.test.tsx
git commit -m "Feat: manual refresh for desktop notifications tab. TypeScript: 0 errors."
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
