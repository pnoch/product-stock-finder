# Health Drill-Down Polish (v5.8) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the health drill-down screen with a time-proportional status timeline strip in the summary card and a day-grouped sample list.

**Architecture:** Add two pure helpers to `lib/scrapers/health.ts` — `timelineSegments` (time-proportional weights) and `groupSamplesByDay` (local-day grouping) — then wire them into `app/health/[id].tsx`: a flexbox strip in the summary card and day-grouped rows replacing the flat list.

**Tech Stack:** TypeScript 5.9 (strict), React Native 0.81, Expo Router 6, vitest.

**Spec:** `docs/superpowers/specs/2026-08-20-health-drill-down-polish-design.md`

---

### Task 1: `timelineSegments` helper

**Files:**
- Modify: `lib/scrapers/health.ts`
- Test: `tests/scrapers/health.test.ts`

- [ ] **Step 1: Write the failing tests**

In `tests/scrapers/health.test.ts`, add `timelineSegments` to the imports from `@/lib/scrapers/health`:

```ts
import {
  classifyProbeOutcome,
  classifyResult,
  computeHealthStats,
  computeHealthSummary,
  createHealthService,
  groupSamplesByDay,
  pruneHealthHistory,
  timelineSegments,
} from "@/lib/scrapers/health";
```

Append a new describe block at the end of the file:

```ts
describe("timelineSegments", () => {
  function sample(status: HealthStatus, at: string): HealthSample {
    return { status, at };
  }

  it("returns empty for no samples", () => {
    expect(timelineSegments([])).toEqual([]);
  });

  it("single sample has full weight", () => {
    expect(
      timelineSegments([sample("working", "2026-08-01T00:00:00Z")]),
    ).toEqual([{ status: "working", weight: 1 }]);
  });

  it("weights are proportional to time gaps", () => {
    const segments = timelineSegments([
      sample("working", "2026-08-01T00:00:00Z"),
      sample("blocked", "2026-08-01T01:00:00Z"),
      sample("error", "2026-08-01T03:00:00Z"),
    ]);
    // spans: 1h, 2h, last reuses 2h -> total 5h -> weights 0.2, 0.4, 0.4
    expect(segments[0].weight).toBeCloseTo(0.2, 5);
    expect(segments[1].weight).toBeCloseTo(0.4, 5);
    expect(segments[2].weight).toBeCloseTo(0.4, 5);
  });

  it("last segment reuses the previous span", () => {
    const segments = timelineSegments([
      sample("working", "2026-08-01T00:00:00Z"),
      sample("blocked", "2026-08-01T01:00:00Z"),
    ]);
    // spans: 1h, last reuses 1h -> total 2h -> weights 0.5, 0.5
    expect(segments[0].weight).toBeCloseTo(0.5, 5);
    expect(segments[1].weight).toBeCloseTo(0.5, 5);
  });

  it("equal weights when all timestamps identical", () => {
    const segments = timelineSegments([
      sample("working", "2026-08-01T00:00:00Z"),
      sample("blocked", "2026-08-01T00:00:00Z"),
      sample("error", "2026-08-01T00:00:00Z"),
    ]);
    expect(segments.map((s) => s.weight)).toEqual([1 / 3, 1 / 3, 1 / 3]);
  });

  it("weights sum to 1", () => {
    const segments = timelineSegments([
      sample("working", "2026-08-01T00:00:00Z"),
      sample("blocked", "2026-08-01T02:00:00Z"),
      sample("error", "2026-08-01T03:00:00Z"),
      sample("working", "2026-08-01T05:00:00Z"),
    ]);
    const total = segments.reduce((sum, s) => sum + s.weight, 0);
    expect(total).toBeCloseTo(1, 5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/scrapers/health.test.ts`
Expected: FAIL — `timelineSegments` is not exported.

- [ ] **Step 3: Implement `timelineSegments`**

In `lib/scrapers/health.ts`, add after `computeHealthSummary`:

```ts
export interface TimelineSegment {
  status: HealthStatus;
  weight: number;
}

export function timelineSegments(samples: HealthSample[]): TimelineSegment[] {
  if (samples.length === 0) return [];
  const sorted = [...samples].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );
  if (sorted.length === 1) return [{ status: sorted[0].status, weight: 1 }];
  const spans: number[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    spans.push(
      new Date(sorted[i + 1].at).getTime() - new Date(sorted[i].at).getTime(),
    );
  }
  const total = spans.reduce((sum, s) => sum + s, 0);
  if (total <= 0) {
    return sorted.map((s) => ({ status: s.status, weight: 1 / sorted.length }));
  }
  spans.push(spans[spans.length - 1]);
  const totalWithLast = spans.reduce((sum, s) => sum + s, 0);
  return sorted.map((s, i) => ({
    status: s.status,
    weight: spans[i] / totalWithLast,
  }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/scrapers/health.test.ts`
Expected: PASS (all existing + new).

- [ ] **Step 5: Commit**

```bash
git add lib/scrapers/health.ts tests/scrapers/health.test.ts
git commit -m "feat: timelineSegments for time-proportional status strip"
```

---

### Task 2: `groupSamplesByDay` helper

**Files:**
- Modify: `lib/scrapers/health.ts`
- Test: `tests/scrapers/health.test.ts`

- [ ] **Step 1: Write the failing tests**

Append a new describe block at the end of `tests/scrapers/health.test.ts` (the `groupSamplesByDay` import was added in Task 1):

```ts
describe("groupSamplesByDay", () => {
  function sample(status: HealthStatus, at: string): HealthSample {
    return { status, at };
  }

  it("returns empty for no samples", () => {
    expect(groupSamplesByDay([])).toEqual([]);
  });

  it("groups samples by local day", () => {
    const groups = groupSamplesByDay([
      sample("working", "2026-08-19T12:00:00Z"),
      sample("blocked", "2026-08-20T12:00:00Z"),
      sample("error", "2026-08-19T14:00:00Z"),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].day).toBe("2026-08-20");
    expect(groups[1].day).toBe("2026-08-19");
    expect(groups[1].samples).toHaveLength(2);
  });

  it("sorts newest day first", () => {
    const days = groupSamplesByDay([
      sample("working", "2026-08-19T12:00:00Z"),
      sample("working", "2026-08-21T12:00:00Z"),
      sample("working", "2026-08-20T12:00:00Z"),
    ]).map((g) => g.day);
    expect(days).toEqual(["2026-08-21", "2026-08-20", "2026-08-19"]);
  });

  it("sorts samples newest-first within a day", () => {
    const group = groupSamplesByDay([
      sample("working", "2026-08-19T12:00:00Z"),
      sample("blocked", "2026-08-19T14:00:00Z"),
      sample("error", "2026-08-19T10:00:00Z"),
    ])[0];
    expect(group.samples.map((s) => s.at)).toEqual([
      "2026-08-19T14:00:00Z",
      "2026-08-19T12:00:00Z",
      "2026-08-19T10:00:00Z",
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/scrapers/health.test.ts`
Expected: FAIL — `groupSamplesByDay` is not exported.

- [ ] **Step 3: Implement `groupSamplesByDay`**

In `lib/scrapers/health.ts`, add after `timelineSegments`:

```ts
export interface DayGroup {
  day: string;
  samples: HealthSample[];
}

function localDayKey(at: string): string {
  const d = new Date(at);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function groupSamplesByDay(samples: HealthSample[]): DayGroup[] {
  const groups = new Map<string, HealthSample[]>();
  for (const s of samples) {
    const day = localDayKey(s.at);
    const arr = groups.get(day) ?? [];
    arr.push(s);
    groups.set(day, arr);
  }
  return [...groups.entries()]
    .map(([day, groupSamples]) => ({
      day,
      samples: [...groupSamples].sort(
        (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
      ),
    }))
    .sort((a, b) => (a.day < b.day ? 1 : -1));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/scrapers/health.test.ts`
Expected: PASS (all existing + new).

- [ ] **Step 5: Commit**

```bash
git add lib/scrapers/health.ts tests/scrapers/health.test.ts
git commit -m "feat: groupSamplesByDay for day-grouped drill-down list"
```

---

### Task 3: Wire helpers into the drill-down screen

**Files:**
- Modify: `app/health/[id].tsx`

- [ ] **Step 1: Update imports**

In `app/health/[id].tsx`, change the import from `@/lib/scrapers/health` to add the two new helpers:

```tsx
import {
  computeHealthStats,
  computeHealthSummary,
  createHealthService,
  groupSamplesByDay,
  HealthSample,
  HealthStatus,
  timelineSegments,
} from "@/lib/scrapers/health";
```

- [ ] **Step 2: Replace `sorted` with segments + groups**

In the screen body, replace:

```tsx
  const sorted = [...samples].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );
```

with:

```tsx
  const segments = timelineSegments(samples);
  const groups = groupSamplesByDay(samples);
```

- [ ] **Step 3: Add the timeline strip to the summary card**

In the summary card `<View>` (the one with `backgroundColor: colors.surface`), immediately after the closing `</>` of the `{stats ? (...) : (...)}` conditional (i.e. after the `)}` that closes the `{stats ? ... : ...}` expression and before the card's closing `</View>`), insert:

```tsx
        {segments.length > 0 && (
          <View
            style={{
              flexDirection: "row",
              height: 8,
              borderRadius: 4,
              overflow: "hidden",
              marginTop: 12,
            }}
          >
            {segments.map((seg, i) => (
              <View
                key={i}
                style={{
                  flex: seg.weight,
                  backgroundColor: statusColors[seg.status],
                }}
              />
            ))}
          </View>
        )}
```

- [ ] **Step 4: Replace the flat sample list with day-grouped sections**

Replace the entire `{sorted.map((s, i) => (...))}` block and its empty-state check with:

```tsx
        {groups.map((g) => {
          const working = g.samples.filter((s) => s.status === "working").length;
          const workingPct = Math.round((working / g.samples.length) * 100);
          return (
            <View key={g.day}>
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 12,
                  fontWeight: "600",
                  textTransform: "uppercase",
                  marginTop: 16,
                  marginBottom: 4,
                }}
              >
                {new Date(g.day + "T00:00:00").toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}{" "}
                · {g.samples.length} samples · {workingPct}% working
              </Text>
              {g.samples.map((s, i) => (
                <View
                  key={`${s.at}-${i}`}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: statusColors[s.status],
                      marginRight: 10,
                    }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: colors.foreground,
                        fontSize: 14,
                        fontWeight: "500",
                      }}
                    >
                      {new Date(s.at).toLocaleString()}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      {s.reason || s.status}
                      {s.responseTimeMs ? ` · ${s.responseTimeMs}ms` : ""}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          );
        })}
        {groups.length === 0 && (
          <Text
            style={{ color: colors.muted, textAlign: "center", marginTop: 40 }}
          >
            No health history yet. Run Test All or wait for scheduled probes.
          </Text>
        )}
```

- [ ] **Step 5: Typecheck + lint**

Run: `pnpm check`
Expected: 0 TypeScript errors.

Run: `pnpm lint`
Expected: clean (only pre-existing MODULE_TYPELESS warning).

- [ ] **Step 6: Commit**

```bash
git add app/health/[id].tsx
git commit -m "feat: timeline strip and day-grouped list in health drill-down"
```

---

### Task 4: Docs + full verification

**Files:**
- Modify: `todo.md`

- [ ] **Step 1: Run the full verification suite**

Run: `pnpm check`
Expected: 0 TypeScript errors.

Run: `pnpm lint`
Expected: clean (only pre-existing MODULE_TYPELESS warning).

Run: `pnpm test`
Expected: all pass (existing 776 + new timelineSegments/groupSamplesByDay tests).

- [ ] **Step 2: Browser smoke test**

With the DB-backed server + HTTPS static server running (see `/tmp/opencode/webpush/run-server-db.sh` and `https-static.cjs`), rebuild the web export and verify:

```bash
npx expo export -p web --clear
```

Then in headed Chromium at `https://localhost:8443/health/<id>` (e.g. `winncom-us`):
1. Seed `distributor_health_history` in localStorage for one distributor with samples across two days (mixed statuses, some with `responseTimeMs`), plus a `distributor_health` entry.
2. Reload the drill-down — the summary card shows the timeline strip with proportional colored segments (wider for longer time gaps).
3. The sample list is grouped by day: each day header shows the formatted date, sample count, and working %; rows are newest-first within each day.
4. An empty distributor still shows the empty state (no strip, no groups).

NOTE: The smoke test requires a headed browser and the smoke servers. If the smoke servers are not running or you cannot launch a headed browser, attempt to start them via the scripts in `/tmp/opencode/webpush/`. If you genuinely cannot complete the browser smoke test, report back clearly that it was skipped and why — do NOT fake results.

- [ ] **Step 3: Update `todo.md`**

Append a Phase 60 section at the end of the file:

```markdown
## Phase 60: Health Drill-Down Polish (v5.8)

- [x] timelineSegments: time-proportional status strip weights
- [x] groupSamplesByDay: local-day grouping, newest first
- [x] Timeline strip in drill-down summary card
- [x] Day-grouped sample list with per-day working %
- [x] Tests: timelineSegments, groupSamplesByDay
```

- [ ] **Step 4: Commit**

```bash
git add todo.md
git commit -m "docs: Phase 60 health drill-down polish (v5.8) in todo.md"
```

---

## Self-Review Notes

- **Spec coverage:** `timelineSegments` (Task 1), `groupSamplesByDay` (Task 2), strip + day-grouped list + per-day working % (Task 3), docs + verification (Task 4). All four brainstorming decisions (both features, time-proportional, View-based strip, day-grouped list) are implemented.
- **Type consistency:** `TimelineSegment = { status: HealthStatus; weight: number }` and `DayGroup = { day: string; samples: HealthSample[] }` defined in Tasks 1-2, used identically in Task 3. `statusColors[seg.status]` and `statusColors[s.status]` both index a `Record<HealthStatus, string>` — valid for all `HealthStatus` values.
- **Edge-case correctness:** `timelineSegments` checks `total <= 0` on the n−1 spans BEFORE appending the last span, so all-identical timestamps yield equal weights (the `|| 1` fallback from the spec draft was removed because it made the equal-weight branch unreachable). Duplicate-timestamp probes produce 0-width segments, per spec.
- **Test determinism:** `groupSamplesByDay` tests use noon-UTC timestamps so the local calendar date is stable across timezones; `localDayKey` is locale-independent (built from `getFullYear/getMonth/getDate`).
- **No snapshot changes:** reads only existing history; no schema, sync, or storage changes.