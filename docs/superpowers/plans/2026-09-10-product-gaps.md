# Product Gaps Bundle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overdue visibility, calendar details, tappable summary, per-row sparklines — all mirroring mobile copy and behavior.

**Architecture:** Local computed state + existing filter/modal infrastructure; no new state shapes, no new deps.

**Tech Stack:** React + react-router, vitest desktop (`desktop/ pnpm test`), `pnpm check`, `pnpm lint`.

---

### Task 1: Past-due pill + calendar details

**Files:**
- Modify: `desktop/src/pages/Alerts.tsx` (reminder rows ~863-898)
- Modify: `desktop/src/pages/Stats.tsx` (calendar ~615-655)
- Test: `desktop/tests/reminders-calendar.test.tsx` (new; check for an existing Alerts/Stats harness — ux-alignment renders Alerts; Stats harness? grep first, copy cheapest)

Verified facts (re-confirm): row shows `{productName}`, `{distributorName} · Due {date}`, Reschedule/Delete, no isPast; mobile `isPast = reminderDate < startOfToday` (read `reminder-card.tsx:20-23` + pill markup `:97-117` first and mirror: amber pill + warning border/date classes); calendar cells are `<button>` without onClick; `DropDay.drops: {productId, name, from, to, percent}[]` in display currency (lib/drop-calendar.ts); mobile detail lists name + from→to + pct with `selectedKey` toggle.

- [ ] **Step 1: Write the failing tests**

```tsx
it("marks overdue reminders Past Due", async () => {
  // reminder with reminderDate yesterday → "Past Due" pill visible + warning styling;
  // reminder tomorrow → no pill.
});
it("shows drop details on day select", async () => {
  // Stats with a known drop day (craft histories; check how stats-polish fixtures build drops — copy);
  // click the day cell → product name + from→to + % visible; click again → details gone.
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm test reminders-calendar` (workdir: `desktop/`)
Expected: FAIL — no pill; no onClick/detail.

- [ ] **Step 3: Write minimal implementation**

```tsx
// Alerts.tsx row:
const isPast = new Date(r.reminderDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0);
```

Verify mobile's `startOfToday` semantics first (local-midnight comparison — mirror exactly). Pill + warning classes on row/date (copy mobile colors into tailwind: amber pill, amber-700 date/border — match the file's existing amber usage).

```tsx
// Stats.tsx calendar:
const [selectedKey, setSelectedKey] = useState<string | null>(null);
// cell button: onClick={() => setSelectedKey((k) => (k === key ? null : key))} + aria-pressed
{selectedKey && dropCalendar.byDay.get(selectedKey) && (
  <div className="mt-2">
    <p>Drops on {selectedKey}</p>
    {day.drops.map((drop) => (
      <Link key={`${drop.productId}-${drop.from}-${drop.to}`} to={`/product/${drop.productId}`} className="...">
        <span className="truncate">{drop.name}</span>
        <span>{formatPrice(drop.from, displayCurrency)} → {formatPrice(drop.to, displayCurrency)}</span>
        <span>{drop.percent.toFixed(0)}%</span>
      </Link>
    ))}
  </div>
)}
```

Rows link to the product (mobile shows plain rows; linking is a strict improvement consistent with the app — keep it, note it). Verify `formatPrice` + `displayCurrency` in scope in Stats.tsx (used elsewhere — copy specifier).

- [ ] **Step 4: Run to verify**

Run: `pnpm test reminders-calendar` (desktop); `pnpm check` (root, 0 errors).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/pages/Alerts.tsx desktop/src/pages/Stats.tsx desktop/tests/reminders-calendar.test.tsx
git commit -m "Feat: past-due pills and calendar details. TypeScript: 0 errors."
```

---

### Task 2: Tappable summary + row sparklines

**Files:**
- Modify: `desktop/src/pages/Watchlist.tsx` (summary ~902-944)
- Modify: `desktop/src/pages/ProductDetail.tsx` (price cell ~1235)
- Test: extend `desktop/tests/home-activity.test.tsx`? No — summary/watchlist: extend the cheapest Watchlist harness (check `parity-rates-search-watchlist` or ux-alignment for a Watchlist render — copy); sparklines: extend `best-price-signals`? No — new cases in the nav-header/converted-row harness? Prefer: extend `desktop/tests/converted-row-prices.test.tsx` (renders ProductDetail rows already — verify) for sparkline presence + click-opens-modal; summary toggles in the Watchlist harness file.

Verified facts (re-confirm): summary counts are static divs; mobile toggles `onStatusToggle(all ↔ key)` with highlight; desktop has filter chips driving SOME filter state — read which state the chips set (name? `filter`? — the toggle must write the SAME state); `PriceSparkline({history, currency})` at ProductDetail:50, used once at :901; row chart-icon at :1301 calls `setHistoryFor(listing)`; `historyFor` renders the modal (verify modal render location).

- [ ] **Step 1: Write the failing tests**

```tsx
it("toggles the status filter from summary counts", async () => {
  // click "In Stock" count → out-of-stock rows hidden + count highlighted; click again → all shown.
});
it("renders per-row sparklines that open history", async () => {
  // row with ≥2 points shows a sparkline svg; click it → history modal opens (same assertion as chart-icon test).
  // row with <2 points shows none.
});
```

- [ ] **Step 2: Run to verify they fail**

Run: chosen suite(s) (workdir: `desktop/`)
Expected: FAIL — static counts; no row sparklines.

- [ ] **Step 3: Write minimal implementation**

Summary: convert the 4 count blocks to `<button>` writing the chips' filter state (`setX(statusFilter === key ? "all" : key)` — read the exact state name/setter from the chips first and reuse; selected highlight mirrors chip selected styling or simple underline — copy neighboring idiom).

Rows: in the price `<td>` (after converted/tax lines? or before? — place UNDER the price block, above tax? Mobile cards show sparkline below price. Choose: after the converted line, before tax line — read the cell and pick the least disruptive slot; keep it small `w-24 h-8`):

```tsx
{listing.priceHistory && listing.priceHistory.length >= 2 && (
  <button onClick={() => setHistoryFor(listing)} aria-label={`View ${dist?.name ?? listing.distributorId} price history`} className="mt-1 block">
    <PriceSparkline history={listing.priceHistory} currency={listing.currency} />
  </button>
)}
```

Reuse the chart-icon's aria-label + `setHistoryFor` (same modal). Verify `PriceSparkline` props (`{history: {price}[], currency}` — matches).

- [ ] **Step 4: Run to verify**

Run: chosen suite(s) (desktop); `pnpm check` (root, 0 errors).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/pages/Watchlist.tsx desktop/src/pages/ProductDetail.tsx <test files> (verify via git status)
git commit -m "Feat: tappable summary and row sparklines. TypeScript: 0 errors."
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
