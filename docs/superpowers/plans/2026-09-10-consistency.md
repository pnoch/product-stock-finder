# Consistency Bundle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Six verified mobile-parity alignments on desktop — movers lists, flagged distributor names, 3M default, Stats refresh, param-carrying stat links, null-safe activity rows.

**Architecture:** Mirror mobile copy and logic; two new query-param intakes with safe fallbacks; null-safe row rendering.

**Tech Stack:** React + react-router (`useSearchParams`), vitest desktop (`desktop/ pnpm test`), `pnpm check`, `pnpm lint`.

**Sweep correction (verified, not implemented):** the "Test Stock Alert" gap does not exist — `<ActionButtons` (the only carrier of `onTestStockNotification`) is never rendered anywhere in `app/` or `components/` (only re-exported via `app/product/_components.tsx`). Building the button on desktop would mirror dead code. The in-situ verification need is already served by Settings' "Test notification" button. Dropped from scope; do NOT implement it.

---

### Task 1: Stats movers lists + refresh

**Files:**
- Modify: `desktop/src/pages/Stats.tsx` (movers cards ~363-388, `loadStats` ~78+, header for Refresh button)
- Test: `desktop/tests/stats-polish.test.tsx` (new; check for an existing Stats harness first — extend it if one exists)

Verified facts (re-confirm): `movers: MoversResult` (`lib/watchlist-stats.ts:19-21`) with `PriceMove[]` (`productId/productName/distributorId/distributorName/countryFlag/oldPrice/newPrice/currency/changePct`); desktop renders only `[0]` of each; mobile `MoveRow` shows flag + name + `distributorName · old → new` + pct chip; `loadStats` is a `useCallback` in scope; page has `loadError` + retry pattern (Home-refresh plan precedent for sharing loader).

- [ ] **Step 1: Write the failing tests**

```tsx
it("lists all top movers, not just the biggest", async () => {
  // render Stats with watchlist producing 3 drops + 2 gainers (craft price histories; check how existing stats tests or pages.test build fixtures — copy cheapest);
  // assert all three drop product names + both gainer names visible.
});
it("refreshes stats on demand", async () => {
  // click Refresh (aria-label "Refresh stats"); assert getWatchlist called again.
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm test stats-polish` (workdir: `desktop/`)
Expected: FAIL — only first of each shown; no Refresh button.

- [ ] **Step 3: Write minimal implementation**

Replace the two single-winner cards' bodies with mapped rows (keep card chrome/headers, rename headers to "Top Drops"/"Top Gainers" per mobile):

```tsx
{movers && movers.drops.length > 0 ? (
  <div className="mt-2 space-y-2">
    {movers.drops.map((m) => (
      <div key={`${m.productId}-${m.distributorId}`} className="flex items-center gap-2">
        <span>{m.countryFlag}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{m.productName}</p>
          <p className="text-xs text-gray-400 truncate">{m.distributorName} · {formatPrice(m.oldPrice, m.currency)} → {formatPrice(m.newPrice, m.currency)}</p>
        </div>
        <span className="text-xs font-bold text-emerald-600">{m.changePct.toFixed(1)}%</span>
      </div>
    ))}
  </div>
) : ( ...existing "No movers yet"... )}
```

Verify `formatPrice` import exists in Stats.tsx (it renders prices elsewhere — copy its specifier). Same for gainers (red, `+` prefix per mobile: `{m.changePct > 0 ? "+" : ""}`).

Refresh: extract `loadStats` sharing (it already is a callback — add header button reusing it + `refreshing` flag like Home's `refreshDashboard`):

```tsx
<button onClick={() => void loadStats()} disabled={loading} aria-label="Refresh stats">Refresh</button>
```

Check the page's loading state name first (`loading`? — verify). Route-focus reload: `useLocation` from react-router + effect on `pathname` re-calling `loadStats` (Sidebar badge precedent from follow-ups-5 — same idiom). Verify no reload loop (effect deps `[location.pathname]`, loader stable via useCallback — confirm).

- [ ] **Step 4: Run to verify**

Run: `pnpm test stats-polish` (desktop); `pnpm check` (root, 0 errors).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/pages/Stats.tsx desktop/tests/stats-polish.test.tsx
git commit -m "Feat: desktop movers lists and stats refresh. TypeScript: 0 errors."
```

---

### Task 2: AlertRow distributor names + Compare default

**Files:**
- Modify: `desktop/src/pages/Alerts.tsx:731-735` (distributor span)
- Modify: `desktop/src/pages/Compare.tsx:247` (default range)
- Test: `desktop/tests/ux-alignment.test.tsx`? No — `desktop/tests/alerts-rows.test.tsx`? Check for an existing Alerts-row harness (error-paths renders Alerts — extend `desktop/tests/error-paths-safety.test.tsx`? It's thematically "alerts display"... cleaner: new `desktop/tests/alert-row.test.tsx`? Hmm — reuse: append to `ux-alignment.test.tsx` (renders Alerts already). Decide by reading: extend `ux-alignment.test.tsx` with the distributor-label case; Compare default via root string-guard? A one-word default is best pinned behaviorally — but Compare render harness may be heavy; check `pages.test.tsx`/`compare-chart-width.test.tsx` for a Compare render first. If heavy, use root guard `tests/desktop-compare-default-guard.test.ts` asserting `useState<TimeRange>("3M")` in Compare.tsx. Prefer behavioral if cheap, else guard (document choice in report).

Verified facts: `getDistributorById` imported at Alerts.tsx:29; mobile label `` `${dist.countryFlag} ${dist.name}` `` with id fallback; desktop `at {alert.distributorId}` inline.

- [ ] **Step 1: Write the failing tests**

```tsx
it("shows flagged distributor names on alert rows", async () => {
  // Alerts with distributorId "mouser" (verify getDistributorById("mouser") resolves — check @shared/distributors for the id/flag/name first);
  // assert "🇺🇸 Mouser" (or actual flag+name) visible; unknown id "xxq" renders raw "xxq".
});
```

- [ ] **Step 2: Run to verify they fail**

Run: chosen suite (workdir: `desktop/`) + guard if used (root).
Expected: FAIL — raw id shown; default "all".

- [ ] **Step 3: Write minimal implementation**

```tsx
{alert.distributorId ? (
  <span className="ml-1.5 text-xs text-gray-400 font-normal">
    at {(() => { const d = getDistributorById(alert.distributorId!); return d ? `${d.countryFlag} ${d.name}` : alert.distributorId; })()}
  </span>
) : null}
```

Prefer a tiny module helper over inline IIFE if the file has one... keep inline (single use, matches existing inline style). `useState("all")` → `useState<TimeRange>("3M")` (verify `TimeRange` import exists at Compare.tsx:247 context).

- [ ] **Step 4: Run to verify**

Run: chosen suites; `pnpm check` (root, 0 errors).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/pages/Alerts.tsx desktop/src/pages/Compare.tsx <test files> (verify via git status)
git commit -m "Fix: flagged distributor names and 3M compare default. TypeScript: 0 errors."
```

---

### Task 3: Stat links + null-safe activity

**Files:**
- Modify: `desktop/src/pages/Watchlist.tsx` (inStock intake)
- Modify: `desktop/src/pages/Alerts.tsx` (tab intake)
- Modify: `desktop/src/pages/Home.tsx` (card links)
- Modify: `desktop/src/pages/Home.tsx` (activity rows null-safe) + memo include listing-less
- Test: `desktop/tests/home-activity.test.tsx` (extend: null row renders) + new param tests (extend `home-refresh.test.tsx`? or pages.test — read harnesses first and place where cheapest)

Verified facts (re-confirm): StatCards navigate bare `/watchlist` (×2) and `/alerts` (×2); Watchlist has in-stock filter state (name? `inStockOnly`? — read first); Alerts `useState<Tab>("alerts")` hard default; `useSearchParams` from react-router (established? check an existing desktop usage and copy the import form); activity memo currently excludes listing-less (follow-ups commit) + rows dereference listing directly.

- [ ] **Step 1: Write the failing tests**

```tsx
it("applies ?inStock=1 on watchlist mount", async () => {
  // render at /watchlist?inStock=1 (MemoryRouter initialEntries); out-of-stock rows hidden.
});
it("opens the reminders tab with ?tab=reminders", async () => {
  // render at /alerts?tab=reminders; reminders content visible, unknown ?tab=zzz falls back to alerts.
});
it("renders listing-less products in activity", async () => {
  // watchlist [empty([]) + good]; feed shows "Empty Product" row with unknown status (no crash) + good row.
});
it("stat cards link with params", async () => {
  // Home: In Stock href ends /watchlist?inStock=1; Reminders href ends /alerts?tab=reminders; (Total Tracked /watchlist; Alerts Active /alerts?tab=alerts).
});
```

- [ ] **Step 2: Run to verify they fail**

Run: chosen suites (workdir: `desktop/`)
Expected: FAIL — params ignored; listing-less excluded; bare links.

- [ ] **Step 3: Write minimal implementation**

```tsx
// Watchlist.tsx (top of component):
const [searchParams] = useSearchParams();
const [inStockOnly, setInStockOnly] = useState(() => searchParams.get("inStock") === "1");
```

Verify the actual in-stock state name first (adapt). One-shot initial (not live-synced — matches "applies on mount"; back button with different param remounts via route change? HashRouter same-route param change doesn't remount — acceptable, matches spec's mount scope).

```tsx
// Alerts.tsx:
const [searchParams] = useSearchParams();
const [tab, setTab] = useState<Tab>(() => (searchParams.get("tab") === "reminders" ? "reminders" : "alerts"));
```

Verify Tab type values (`"alerts" | "reminders" | "notifications"`? — read; fallback anything else to current default).

```tsx
// Home.tsx cards:
onClick={() => navigate("/watchlist?inStock=1")}  // In Stock
onClick={() => navigate("/alerts?tab=reminders")} // Reminders
onClick={() => navigate("/alerts?tab=alerts")}    // Alerts Active (explicit; same view, correct tab)
```

Verify `navigate` parses query strings (react-router `navigate("/watchlist?inStock=1")` — yes, standard).

Activity null-safe: memo emits `{product, listing: null}` for empty listings (revert the exclusion to mobile's shape); rows render `listing?.distributorId ?? "unknown"` status, `formatLastRefreshed(product.addedAt)` time, link kept. Read the row JSX fully first and null-guard each dereference (`listing.distributorId:301`, `:302`, `:323,327,330` per follow-ups review).

- [ ] **Step 4: Run to verify**

Run: chosen suites (desktop); `pnpm check` (root, 0 errors); `pnpm build` (desktop, exit 0).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/pages/Home.tsx desktop/src/pages/Watchlist.tsx desktop/src/pages/Alerts.tsx <test files> (verify via git status)
git commit -m "Feat: param-carrying stat links and null-safe activity. TypeScript: 0 errors."
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
