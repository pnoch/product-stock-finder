# Full 30-Day Health History Window (v5.10) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the health history window to a full 30 days by raising the sample cap from 90 to 720 (30 days × 24 samples/day at hourly cadence).

**Architecture:** Change `HISTORY_MAX_SAMPLES` in `lib/scrapers/health.ts` from `90` to `30 * 24`, and update the `pruneHealthHistory` cap test accordingly. No other code changes.

**Tech Stack:** TypeScript 5.9 (strict), vitest.

**Spec:** `docs/superpowers/specs/2026-08-20-full-30-day-health-window-design.md`

---

### Task 1: Raise the sample cap to 720

**Files:**
- Modify: `lib/scrapers/health.ts`
- Test: `tests/scrapers/health.test.ts`

- [ ] **Step 1: Update the failing test**

In `tests/scrapers/health.test.ts`, in the `pruneHealthHistory` describe block, replace the test "caps at 90 samples, keeping the newest" with:

```ts
  it("caps at 720 samples, keeping the newest", () => {
    const samples: HealthSample[] = Array.from({ length: 800 }, (_, i) => ({
      status: "working",
      at: new Date(now - (799 - i) * 60 * 1000).toISOString(),
    }));
    const pruned = pruneHealthHistory(samples, now);
    expect(pruned).toHaveLength(720);
    expect(pruned[0]).toEqual(samples[80]);
    expect(pruned[719]).toEqual(samples[799]);
  });
```

(800 samples 1 minute apart span ~13.3 hours, all within the 30-day age cutoff, so only the count cap binds. With the cap at 720, the pruned result is the newest 720 samples: `samples[80]` through `samples[799]`.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/scrapers/health.test.ts`
Expected: FAIL — the test expects 720 samples but the current cap of 90 yields 90.

- [ ] **Step 3: Implement the constant change**

In `lib/scrapers/health.ts`, change:

```ts
const HISTORY_MAX_SAMPLES = 90;
```

to:

```ts
const HISTORY_MAX_SAMPLES = 30 * 24;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/scrapers/health.test.ts`
Expected: PASS (all existing + updated test).

- [ ] **Step 5: Commit**

```bash
git add lib/scrapers/health.ts tests/scrapers/health.test.ts
git commit -m "feat: extend health history window to 30 days at hourly cadence"
```

---

### Task 2: Docs + full verification

**Files:**
- Modify: `todo.md`

- [ ] **Step 1: Run the full verification suite**

Run: `pnpm check`
Expected: 0 TypeScript errors.

Run: `pnpm lint`
Expected: clean (only pre-existing MODULE_TYPELESS warning).

Run: `pnpm test`
Expected: all pass.

- [ ] **Step 2: Browser smoke test**

With the DB-backed server + HTTPS static server running (see `/tmp/opencode/webpush/run-server-db.sh` and `https-static.cjs`), rebuild the web export and verify:

```bash
npx expo export -p web --clear
```

Then in headed Chromium at `https://localhost:8443/health/<id>` (e.g. `winncom-us`):
1. Seed `distributor_health_history` in localStorage for one distributor with >720 samples (e.g. 750 samples, 1 hour apart, mixed statuses, spanning ~31 days so the newest ~720 survive), plus a `distributor_health` entry.
2. Reload the drill-down — the summary card sample count shows ~720 and the first/last probe dates span ~30 days.
3. The day-grouped list renders correctly (no crash with the larger array).

NOTE: The smoke test requires a headed browser and the smoke servers. If the smoke servers are not running or you cannot launch a headed browser, attempt to start them via the scripts in `/tmp/opencode/webpush/`. If you genuinely cannot complete the browser smoke test, report back clearly that it was skipped and why — do NOT fake results.

- [ ] **Step 3: Update `todo.md`**

Append a Phase 62 section at the end of the file:

```markdown
## Phase 62: Full 30-Day Health History Window (v5.10)

- [x] HISTORY_MAX_SAMPLES raised from 90 to 720 (30 days at hourly cadence)
- [x] Updated pruneHealthHistory cap test
```

- [ ] **Step 4: Commit**

```bash
git add todo.md
git commit -m "docs: Phase 62 full 30-day health history window (v5.10) in todo.md"
```

---

## Self-Review Notes

- **Spec coverage:** constant change + test update (Task 1), docs + verification (Task 2). Both spec decisions (full 30 days, fixed cap `30 * 24`) are implemented.
- **Type consistency:** no new types or signatures; only a constant value and a test body change. The test uses the existing `now`/`sample` helpers already defined in the `pruneHealthHistory` describe block.
- **Edge-case correctness:** the updated test uses 800 samples at 1-minute spacing so only the count cap binds (well under 30 days); at daily cadence the age cap still limits to ~30 samples (untouched behavior).