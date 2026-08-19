# Health Drill-Down View (v5.7) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user tap a distributor row on the health dashboard to see that distributor's full health history — a summary header (uptime %, trend, sample count, first/last probe, avg response time) plus a scrollable list of every recorded probe sample.

**Architecture:** Add a pure `computeHealthSummary` helper to `lib/scrapers/health.ts`, create a new stack route `app/health/[id].tsx`, and make the dashboard rows tappable. Uptime/trend reuse the existing `computeHealthStats`.

**Tech Stack:** TypeScript 5.9 (strict), React Native 0.81, Expo Router 6 (typed routes), AsyncStorage, react-native-svg, vitest.

**Spec:** `docs/superpowers/specs/2026-08-19-health-drill-down-design.md`

---

### Task 1: `computeHealthSummary` helper

**Files:**
- Modify: `lib/scrapers/health.ts`
- Test: `tests/scrapers/health.test.ts`

- [ ] **Step 1: Write the failing tests**

In `tests/scrapers/health.test.ts`, add `computeHealthSummary` to the imports from `@/lib/scrapers/health`:

```ts
import {
  classifyProbeOutcome,
  classifyResult,
  computeHealthStats,
  computeHealthSummary,
  createHealthService,
  pruneHealthHistory,
} from "@/lib/scrapers/health";
```

Append a new describe block at the end of the file:

```ts
describe("computeHealthSummary", () => {
  function sample(
    status: HealthStatus,
    at: string,
    responseTimeMs?: number,
  ): HealthSample {
    return { status, at, responseTimeMs };
  }

  it("returns zeroed summary for empty samples", () => {
    expect(computeHealthSummary([])).toEqual({
      count: 0,
      firstAt: null,
      lastAt: null,
      avgResponseTimeMs: null,
    });
  });

  it("counts samples", () => {
    const samples = [
      sample("working", "2026-08-01T00:00:00Z"),
      sample("error", "2026-08-02T00:00:00Z"),
      sample("blocked", "2026-08-03T00:00:00Z"),
    ];
    expect(computeHealthSummary(samples).count).toBe(3);
  });

  it("firstAt and lastAt are the oldest and newest samples", () => {
    const samples = [
      sample("working", "2026-08-02T00:00:00Z"),
      sample("error", "2026-08-01T00:00:00Z"),
      sample("blocked", "2026-08-03T00:00:00Z"),
    ];
    const summary = computeHealthSummary(samples);
    expect(summary.firstAt).toBe("2026-08-01T00:00:00Z");
    expect(summary.lastAt).toBe("2026-08-03T00:00:00Z");
  });

  it("averages response time over samples that have it", () => {
    const samples = [
      sample("working", "2026-08-01T00:00:00Z", 100),
      sample("working", "2026-08-02T00:00:00Z", 300),
      sample("working", "2026-08-03T00:00:00Z"),
    ];
    expect(computeHealthSummary(samples).avgResponseTimeMs).toBe(200);
  });

  it("returns null avg response time when no sample has it", () => {
    const samples = [
      sample("working", "2026-08-01T00:00:00Z"),
      sample("working", "2026-08-02T00:00:00Z"),
    ];
    expect(computeHealthSummary(samples).avgResponseTimeMs).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/scrapers/health.test.ts`
Expected: FAIL — `computeHealthSummary` is not exported.

- [ ] **Step 3: Implement `computeHealthSummary`**

In `lib/scrapers/health.ts`, add after `computeHealthStats`:

```ts
export interface HealthSummary {
  count: number;
  firstAt: string | null;
  lastAt: string | null;
  avgResponseTimeMs: number | null;
}

export function computeHealthSummary(
  samples: HealthSample[],
): HealthSummary {
  if (samples.length === 0) {
    return { count: 0, firstAt: null, lastAt: null, avgResponseTimeMs: null };
  }
  const times = samples.map((s) => new Date(s.at).getTime());
  const firstAt = samples[times.indexOf(Math.min(...times))].at;
  const lastAt = samples[times.indexOf(Math.max(...times))].at;
  const withResponse = samples.filter(
    (s) => typeof s.responseTimeMs === "number",
  );
  const avgResponseTimeMs =
    withResponse.length > 0
      ? Math.round(
          withResponse.reduce((sum, s) => sum + (s.responseTimeMs ?? 0), 0) /
            withResponse.length,
        )
      : null;
  return { count: samples.length, firstAt, lastAt, avgResponseTimeMs };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/scrapers/health.test.ts`
Expected: PASS (all existing + new).

- [ ] **Step 5: Commit**

```bash
git add lib/scrapers/health.ts tests/scrapers/health.test.ts
git commit -m "feat: computeHealthSummary for drill-down stats"
```

---

### Task 2: Health drill-down route `app/health/[id].tsx`

**Files:**
- Create: `app/health/[id].tsx`

- [ ] **Step 1: Create the screen**

Create `app/health/[id].tsx` with exactly this content:

```tsx
import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View, TouchableOpacity } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  computeHealthStats,
  computeHealthSummary,
  createHealthService,
  HealthSample,
  HealthStatus,
} from "@/lib/scrapers/health";
import { getDistributorById } from "@/lib/distributors";

const healthService = createHealthService(AsyncStorage);

export default function HealthDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [samples, setSamples] = useState<HealthSample[]>([]);
  const [currentStatus, setCurrentStatus] = useState<HealthStatus | null>(null);

  const distributor = id ? getDistributorById(id) : undefined;

  const statusColors: Record<HealthStatus, string> = {
    working: colors.success,
    blocked: colors.warning,
    error: colors.error,
  };

  const load = useCallback(async () => {
    if (!id) return;
    const history = await healthService.getHealthHistory();
    setSamples(history[id] ?? []);
    const health = await healthService.getDistributorHealth();
    const entry = health.find((h) => h.distributorId === id);
    setCurrentStatus(entry?.status ?? null);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!distributor) {
    return (
      <ScreenContainer>
        <View style={{ flexDirection: "row", alignItems: "center", padding: 16 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginRight: 12 }}
          >
            <Text style={{ color: colors.primary, fontSize: 16 }}>‹ Back</Text>
          </TouchableOpacity>
        </View>
        <Text style={{ color: colors.muted, textAlign: "center", marginTop: 40 }}>
          Distributor not found
        </Text>
      </ScreenContainer>
    );
  }

  const stats = computeHealthStats(
    samples.length > 0 ? { [id]: samples } : {},
  )[id];
  const summary = computeHealthSummary(samples);
  const sorted = [...samples].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );

  return (
    <ScreenContainer>
      <View style={{ flexDirection: "row", alignItems: "center", padding: 16 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginRight: 12 }}
        >
          <Text style={{ color: colors.primary, fontSize: 16 }}>‹ Back</Text>
        </TouchableOpacity>
        <Text
          style={{ color: colors.foreground, fontSize: 20, fontWeight: "700" }}
        >
          {distributor.countryFlag} {distributor.name}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
      >
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <View
            style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}
          >
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: currentStatus
                  ? statusColors[currentStatus]
                  : colors.muted,
                marginRight: 8,
              }}
            />
            <Text
              style={{ color: colors.foreground, fontSize: 16, fontWeight: "600" }}
            >
              {currentStatus ?? "No data"}
            </Text>
          </View>
          {stats ? (
            <>
              <Text
                style={{ color: colors.foreground, fontSize: 28, fontWeight: "700" }}
              >
                {stats.uptimePct}%{" "}
                {stats.trend === "up" ? "▲" : stats.trend === "down" ? "▼" : "–"}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                {summary.count} samples · first{" "}
                {summary.firstAt
                  ? new Date(summary.firstAt).toLocaleDateString()
                  : "–"}{" "}
                · last{" "}
                {summary.lastAt
                  ? new Date(summary.lastAt).toLocaleDateString()
                  : "–"}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                avg response{" "}
                {summary.avgResponseTimeMs != null
                  ? `${summary.avgResponseTimeMs}ms`
                  : "–"}
              </Text>
            </>
          ) : (
            <Text style={{ color: colors.muted, fontSize: 14, marginTop: 8 }}>
              No health history yet. Run Test All or wait for scheduled probes.
            </Text>
          )}
        </View>

        {sorted.map((s, i) => (
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
        {sorted.length === 0 && (
          <Text
            style={{ color: colors.muted, textAlign: "center", marginTop: 40 }}
          >
            No health history yet. Run Test All or wait for scheduled probes.
          </Text>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm check`
Expected: 0 TypeScript errors.

Run: `pnpm lint`
Expected: clean (only pre-existing MODULE_TYPELESS warning).

- [ ] **Step 3: Commit**

```bash
git add app/health/[id].tsx
git commit -m "feat: health drill-down screen with summary and sample list"
```

---

### Task 3: Make dashboard rows tappable

**Files:**
- Modify: `app/health.tsx`

- [ ] **Step 1: Wrap the row in a TouchableOpacity**

In `app/health.tsx`, the row is currently a `<View key={h.distributorId} style={{ flexDirection: "row", ... }}>` inside the `filtered.map`. Replace the opening `<View key={h.distributorId}` with a `TouchableOpacity`:

```tsx
            <TouchableOpacity
              key={h.distributorId}
              onPress={() => router.push(`/health/${h.distributorId}`)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
```

and replace the closing `</View>` of that row (the one right before `);` at the end of the map callback) with `</TouchableOpacity>`.

`TouchableOpacity` is already imported in `app/health.tsx` (used for the header back button and filter chips). `router` is already available via `useRouter()`.

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm check`
Expected: 0 TypeScript errors.

Run: `pnpm lint`
Expected: clean (only pre-existing MODULE_TYPELESS warning).

- [ ] **Step 3: Commit**

```bash
git add app/health.tsx
git commit -m "feat: make health dashboard rows tappable"
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
Expected: all pass (existing 771 + new computeHealthSummary tests).

- [ ] **Step 2: Browser smoke test**

With the DB-backed server + HTTPS static server running (see `/tmp/opencode/webpush/run-server-db.sh` and `https-static.cjs`), rebuild the web export and verify:

```bash
npx expo export -p web --clear
```

Then in headed Chromium at `https://localhost:8443/health`:
1. Seed `distributor_health_history` in localStorage (via the browser console) for one distributor with a few samples (mixed statuses, some with `responseTimeMs`), plus a `distributor_health` entry.
2. Reload `/health` — the seeded distributor row shows uptime %/trend/sparkline.
3. Tap the row — the drill-down opens at `/health/<id>` with the summary card (uptime %, trend, sample count, first/last dates, avg response) and the sample rows (newest first, reason/response time shown).
4. Tap "‹ Back" — returns to the dashboard.
5. Open `/health/unknown-id` directly — shows "Distributor not found".

- [ ] **Step 3: Update `todo.md`**

Append a Phase 59 section:

```markdown
## Phase 59: Health Drill-Down View (v5.7)

- [x] computeHealthSummary: count, first/last probe, avg response time
- [x] Health drill-down route (app/health/[id].tsx): summary card + full sample list
- [x] Dashboard rows tappable → drill-down navigation
- [x] Empty state and unknown-id handling
- [x] Tests: computeHealthSummary
```

- [ ] **Step 4: Commit**

```bash
git add todo.md
git commit -m "docs: Phase 59 health drill-down view (v5.7) in todo.md"
```

---

## Self-Review Notes

- **Spec coverage:** `computeHealthSummary` (Task 1), drill-down route with summary card + sample list + empty/unknown states (Task 2), tappable rows (Task 3), docs + verification (Task 4). All four brainstorming decisions (summary + full list, status rows, push stack screen, new route + pure helper) are implemented.
- **Type consistency:** `computeHealthSummary(samples: HealthSample[]): HealthSummary` defined in Task 1, used identically in Task 2. `computeHealthStats` returns `Record<string, HealthStats>` keyed by distributor id — Task 2 calls it with `{ [id]: samples }` and indexes by `[id]`. `HealthSample`/`HealthStatus` types imported in the screen match the library exports.
- **Screen conventions:** `app/health/[id].tsx` mirrors `app/health.tsx` (ScreenContainer, `‹ Back` header, `useColors()`, status dot colors) and `app/product/[id].tsx` (`useLocalSearchParams`, `useRouter`). `TouchableOpacity` and `router` are already available in `app/health.tsx` — no new imports needed for Task 3.
- **No snapshot changes:** reads only `distributor_health_history` and `distributor_health`; no schema, sync, or storage changes.