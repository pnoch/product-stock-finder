# Distributor Health History & Trends (v5.5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a rolling, capped per-distributor health history captured passively from existing fetches, surfaced as uptime %, a trend arrow, and a status sparkline on the health dashboard.

**Architecture:** Extend `createHealthService` (`lib/scrapers/health.ts`) with a history store (`distributor_health_history` AsyncStorage key), a `recordSample` API, and a pure `computeHealthStats`/`pruneHealthHistory` pair. Wire `recordSample` into the two existing capture paths (the background price-check `healthCollector.flush` and `testAllDistributors`). Render uptime/trend/sparkline in `app/health.tsx` using a small inline SVG polyline (react-native-svg pattern from `PriceSparkline`).

**Tech Stack:** TypeScript 5.9 (strict), React Native 0.81, react-native-svg, AsyncStorage, vitest.

**Spec:** `docs/superpowers/specs/2026-08-19-distributor-health-history-design.md`

---

### Task 1: Health history storage (types, `getHealthHistory`, `recordSample`)

**Files:**
- Modify: `lib/scrapers/health.ts`
- Test: `tests/scrapers/health.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/scrapers/health.test.ts` (after the existing `createHealthService` describe block):

```ts
describe("health history", () => {
  it("getHealthHistory returns empty object when nothing stored", async () => {
    const adapter = createMockAdapter();
    const service = createHealthService(adapter);
    expect(await service.getHealthHistory()).toEqual({});
  });

  it("getHealthHistory returns empty object when stored data is corrupt", async () => {
    const adapter = createMockAdapter();
    await adapter.setItem("distributor_health_history", "not json");
    const service = createHealthService(adapter);
    expect(await service.getHealthHistory()).toEqual({});
  });

  it("recordSample appends a sample and persists it", async () => {
    const adapter = createMockAdapter();
    const service = createHealthService(adapter);
    await service.recordSample("server2u-my", "working");
    const history = await service.getHealthHistory();
    expect(history["server2u-my"]).toHaveLength(1);
    expect(history["server2u-my"][0].status).toBe("working");
    expect(typeof history["server2u-my"][0].at).toBe("string");
  });

  it("recordSample keeps samples from multiple distributors separate", async () => {
    const adapter = createMockAdapter();
    const service = createHealthService(adapter);
    await service.recordSample("server2u-my", "working");
    await service.recordSample("linitx-uk", "blocked");
    const history = await service.getHealthHistory();
    expect(history["server2u-my"]).toHaveLength(1);
    expect(history["linitx-uk"]).toHaveLength(1);
    expect(history["linitx-uk"][0].status).toBe("blocked");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/scrapers/health.test.ts`
Expected: FAIL — `service.getHealthHistory` / `service.recordSample` are not functions.

- [ ] **Step 3: Implement the history types + storage**

In `lib/scrapers/health.ts`, add after the `DistributorHealth` interface:

```ts
export interface HealthSample {
  status: HealthStatus;
  reason?: string;
  responseTimeMs?: number;
  at: string;
}

export type HealthHistory = Record<string, HealthSample[]>;
```

Add after `const HEALTH_KEY = "distributor_health";`:

```ts
const HEALTH_HISTORY_KEY = "distributor_health_history";
const HISTORY_MAX_SAMPLES = 90;
const HISTORY_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
```

Inside `createHealthService`, add before `testAllDistributors`:

```ts
  async function getHealthHistory(): Promise<HealthHistory> {
    try {
      const raw = await adapter.getItem(HEALTH_HISTORY_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  async function recordSample(
    distributorId: string,
    status: HealthStatus,
    reason?: string,
  ): Promise<void> {
    try {
      const history = await getHealthHistory();
      const samples = history[distributorId] ?? [];
      samples.push({ status, reason, at: new Date().toISOString() });
      history[distributorId] = pruneHealthHistory(samples);
      await adapter.setItem(HEALTH_HISTORY_KEY, JSON.stringify(history));
    } catch {
      // Ignore history errors
    }
  }
```

Update the return statement:

```ts
  return {
    getDistributorHealth,
    saveDistributorHealth,
    testAllDistributors,
    getHealthHistory,
    recordSample,
  };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/scrapers/health.test.ts`
Expected: PASS (all existing + new).

- [ ] **Step 5: Commit**

```bash
git add lib/scrapers/health.ts tests/scrapers/health.test.ts
git commit -m "feat: health history storage (getHealthHistory, recordSample)"
```

---

### Task 2: History pruning

**Files:**
- Modify: `lib/scrapers/health.ts`
- Test: `tests/scrapers/health.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/scrapers/health.test.ts`:

```ts
describe("pruneHealthHistory", () => {
  const now = new Date("2026-08-19T12:00:00Z").getTime();

  function sample(daysAgo: number, status: HealthStatus = "working"): HealthSample {
    return {
      status,
      at: new Date(now - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  it("drops samples older than 30 days", () => {
    const samples = [sample(31), sample(10), sample(29)];
    expect(pruneHealthHistory(samples, now)).toEqual([sample(10), sample(29)]);
  });

  it("caps at 90 samples, keeping the newest", () => {
    const samples: HealthSample[] = Array.from({ length: 100 }, (_, i) => ({
      status: "working",
      at: new Date(now - i * 60 * 1000).toISOString(),
    }));
    const pruned = pruneHealthHistory(samples, now);
    expect(pruned).toHaveLength(90);
    expect(pruned[0]).toEqual(samples[9]);
    expect(pruned[89]).toEqual(samples[98]);
  });

  it("returns an empty array when everything is stale", () => {
    expect(pruneHealthHistory([sample(31), sample(40)], now)).toEqual([]);
  });
});
```

Add the type import at the top of the test file (change the existing import line):

```ts
import { classifyResult, createHealthService, pruneHealthHistory } from "@/lib/scrapers/health";
import type { HealthSample, HealthStatus } from "@/lib/scrapers/health";
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/scrapers/health.test.ts`
Expected: FAIL — `pruneHealthHistory` is not exported.

- [ ] **Step 3: Implement pruning**

In `lib/scrapers/health.ts`, add after `classifyResult`:

```ts
export function pruneHealthHistory(
  samples: HealthSample[],
  now = Date.now(),
): HealthSample[] {
  const cutoff = now - HISTORY_MAX_AGE_MS;
  const fresh = samples.filter((s) => new Date(s.at).getTime() >= cutoff);
  return fresh.slice(-HISTORY_MAX_SAMPLES);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/scrapers/health.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/scrapers/health.ts tests/scrapers/health.test.ts
git commit -m "feat: prune health history to 30 days / 90 samples"
```

---

### Task 3: `computeHealthStats`

**Files:**
- Modify: `lib/scrapers/health.ts`
- Test: `tests/scrapers/health.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/scrapers/health.test.ts`:

```ts
describe("computeHealthStats", () => {
  function sample(status: HealthStatus, at: string): HealthSample {
    return { status, at };
  }

  it("computes uptime percentage", () => {
    const history: HealthHistory = {
      d1: [
        sample("working", "2026-08-01"),
        sample("working", "2026-08-02"),
        sample("error", "2026-08-03"),
      ],
    };
    expect(computeHealthStats(history).d1.uptimePct).toBe(67);
  });

  it("trend is up when recent half improves by >=10pp", () => {
    const history: HealthHistory = {
      d1: [
        sample("error", "2026-08-01"),
        sample("error", "2026-08-02"),
        sample("error", "2026-08-03"),
        sample("error", "2026-08-04"),
        sample("working", "2026-08-05"),
        sample("working", "2026-08-06"),
      ],
    };
    expect(computeHealthStats(history).d1.trend).toBe("up");
  });

  it("trend is down when recent half declines by >=10pp", () => {
    const history: HealthHistory = {
      d1: [
        sample("working", "2026-08-01"),
        sample("working", "2026-08-02"),
        sample("working", "2026-08-03"),
        sample("working", "2026-08-04"),
        sample("error", "2026-08-05"),
        sample("error", "2026-08-06"),
      ],
    };
    expect(computeHealthStats(history).d1.trend).toBe("down");
  });

  it("trend is flat within the 10pp threshold", () => {
    const history: HealthHistory = {
      d1: [
        sample("working", "2026-08-01"),
        sample("error", "2026-08-02"),
        sample("working", "2026-08-03"),
        sample("error", "2026-08-04"),
      ],
    };
    expect(computeHealthStats(history).d1.trend).toBe("flat");
  });

  it("sparkline maps statuses to numeric values and truncates to last 30", () => {
    const samples: HealthSample[] = Array.from({ length: 35 }, (_, i) =>
      sample(i % 3 === 0 ? "working" : i % 3 === 1 ? "blocked" : "error", `2026-08-${String(i + 1).padStart(2, "0")}`),
    );
    const stats = computeHealthStats({ d1: samples }).d1;
    expect(stats.sparkline).toHaveLength(30);
    expect(stats.sparkline).toContain(1);
    expect(stats.sparkline).toContain(0.5);
    expect(stats.sparkline).toContain(0);
  });

  it("skips distributors with no samples", () => {
    expect(computeHealthStats({ d1: [] })).toEqual({});
  });
});
```

Update the import line at the top of the test file:

```ts
import { classifyResult, computeHealthStats, createHealthService, pruneHealthHistory } from "@/lib/scrapers/health";
import type { HealthHistory, HealthSample, HealthStatus } from "@/lib/scrapers/health";
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/scrapers/health.test.ts`
Expected: FAIL — `computeHealthStats` is not exported.

- [ ] **Step 3: Implement `computeHealthStats`**

In `lib/scrapers/health.ts`, add after `pruneHealthHistory`:

```ts
export interface HealthStats {
  uptimePct: number;
  trend: "up" | "down" | "flat";
  sparkline: number[];
}

const STATUS_VALUE: Record<HealthStatus, number> = {
  working: 1,
  blocked: 0.5,
  error: 0,
};

export function computeHealthStats(
  history: HealthHistory,
): Record<string, HealthStats> {
  const stats: Record<string, HealthStats> = {};
  for (const [distributorId, samples] of Object.entries(history)) {
    if (samples.length === 0) continue;
    const working = samples.filter((s) => s.status === "working").length;
    const uptimePct = Math.round((working / samples.length) * 100);
    const half = Math.floor(samples.length / 2);
    let trend: "up" | "down" | "flat" = "flat";
    if (half > 0) {
      const recent = samples.slice(half);
      const earlier = samples.slice(0, half);
      const recentUptime =
        recent.filter((s) => s.status === "working").length / recent.length;
      const earlierUptime =
        earlier.filter((s) => s.status === "working").length / earlier.length;
      const diff = recentUptime - earlierUptime;
      if (diff >= 0.1) trend = "up";
      else if (diff <= -0.1) trend = "down";
    }
    const sparkline = samples.slice(-30).map((s) => STATUS_VALUE[s.status]);
    stats[distributorId] = { uptimePct, trend, sparkline };
  }
  return stats;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/scrapers/health.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/scrapers/health.ts tests/scrapers/health.test.ts
git commit -m "feat: computeHealthStats for uptime, trend, sparkline"
```

---

### Task 4: `testAllDistributors` records history

**Files:**
- Modify: `lib/scrapers/health.ts`
- Test: `tests/scrapers/health.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/scrapers/health.test.ts` inside the `createHealthService` describe block:

```ts
  it("testAllDistributors records history samples", async () => {
    const adapter = createMockAdapter();
    const service = createHealthService(adapter);
    const results = await service.testAllDistributors();
    const history = await service.getHealthHistory();
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      const samples = history[r.distributorId];
      expect(samples).toBeDefined();
      expect(samples[samples.length - 1].status).toBe(r.status);
    }
  });
```

Add a `vi.mock` at the top of the test file (after the imports) so `testAllDistributors` does not hit the network:

```ts
vi.mock("@/lib/scrapers/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/scrapers/utils")>();
  return {
    ...actual,
    fetchWithParser: vi.fn(async () => "<html>Access Denied</html>"),
  };
});
```

Update the import line at the top of the test file to include `vi`:

```ts
import { describe, it, expect, vi } from "vitest";
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/scrapers/health.test.ts`
Expected: FAIL — the new test fails because `testAllDistributors` does not yet call `recordSample`.

- [ ] **Step 3: Implement history recording in `testAllDistributors`**

In `lib/scrapers/health.ts`, inside `testAllDistributors`, replace the final block:

```ts
    await saveDistributorHealth(results);
    return results;
```

with:

```ts
    await saveDistributorHealth(results);
    for (const r of results) {
      await recordSample(r.distributorId, r.status, r.reason);
    }
    return results;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/scrapers/health.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/scrapers/health.ts tests/scrapers/health.test.ts
git commit -m "feat: testAllDistributors records health history"
```

---

### Task 5: Background collector `flush` records history

**Files:**
- Modify: `lib/background-price-check.ts`
- Test: `tests/price-check.test.ts`

- [ ] **Step 1: Write the failing test**

In `tests/price-check.test.ts`, add a new describe block after the existing `checkPriceDropsNow` block. Add the imports at the top of the file (after the existing `import { checkPriceDropsNow }` line):

```ts
import { checkPriceDropsNow, createHealthCollector } from "../lib/background-price-check";
import { createHealthService } from "../lib/scrapers/health";
```

Add the test:

```ts
describe("createHealthCollector", () => {
  it("flush records history samples", async () => {
    const store = new Map<string, string>();
    const adapter = {
      getItem: async (key: string) => store.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: async (key: string) => {
        store.delete(key);
      },
      multiRemove: async (keys: string[]) => {
        keys.forEach((k) => store.delete(k));
      },
    };
    const service = createHealthService(adapter);
    const collector = createHealthCollector(service);
    collector.record("d1", "working");
    collector.record("d2", "blocked", "in cooldown");
    await collector.flush();
    const history = await service.getHealthHistory();
    expect(history["d1"]).toHaveLength(1);
    expect(history["d1"][0].status).toBe("working");
    expect(history["d2"]).toHaveLength(1);
    expect(history["d2"][0].status).toBe("blocked");
    expect(history["d2"][0].reason).toBe("in cooldown");
  });

  it("flush does nothing when no updates recorded", async () => {
    const store = new Map<string, string>();
    const adapter = {
      getItem: async (key: string) => store.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: async (key: string) => {
        store.delete(key);
      },
      multiRemove: async (keys: string[]) => {
        keys.forEach((k) => store.delete(k));
      },
    };
    const service = createHealthService(adapter);
    const collector = createHealthCollector(service);
    await collector.flush();
    expect(await service.getHealthHistory()).toEqual({});
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/price-check.test.ts`
Expected: FAIL — `createHealthCollector` is not exported from `../lib/background-price-check`.

- [ ] **Step 3: Implement the injectable collector + history recording**

In `lib/background-price-check.ts`, change the collector signature and `flush` body:

```ts
export function createHealthCollector(
  service: ReturnType<typeof createHealthService> = healthService,
) {
  const updates = new Map<string, DistributorHealth>();
  return {
    record(
      parserId: string,
      status: "working" | "blocked" | "error",
      reason?: string,
    ) {
      updates.set(parserId, {
        distributorId: parserId,
        status,
        reason,
        lastChecked: new Date().toISOString(),
      });
    },
    async flush() {
      if (updates.size === 0) return;
      try {
        const current = await service.getDistributorHealth();
        const merged = current.map((h) => updates.get(h.distributorId) ?? h);
        for (const [id, entry] of updates) {
          if (!current.some((h) => h.distributorId === id)) {
            merged.push(entry);
          }
        }
        await service.saveDistributorHealth(merged);
        for (const [id, entry] of updates) {
          await service.recordSample(id, entry.status, entry.reason);
        }
      } catch {
        // Ignore health update errors
      }
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/price-check.test.ts`
Expected: PASS (existing + new).

- [ ] **Step 5: Commit**

```bash
git add lib/background-price-check.ts tests/price-check.test.ts
git commit -m "feat: health collector flush records history samples"
```

---

### Task 6: Health dashboard UI (uptime, trend, sparkline)

**Files:**
- Modify: `app/health.tsx`

- [ ] **Step 1: Update imports**

In `app/health.tsx`, change the import from the health service:

```ts
import {
  computeHealthStats,
  createHealthService,
  DistributorHealth,
  HealthStats,
  HealthStatus,
} from "@/lib/scrapers/health";
```

Add react-native-svg import (keep the existing `useCallback, useEffect, useState` React import unchanged):

```ts
import Svg, { Polyline } from "react-native-svg";
```

- [ ] **Step 2: Add the sparkline component + stats state**

Add a small inline sparkline component above `HealthScreen` (after `const healthService = createHealthService(AsyncStorage);`):

```tsx
function HealthSparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const width = 60;
  const height = 24;
  const pad = 2;
  const usableW = width - pad * 2;
  const usableH = height - pad * 2;
  const coords = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * usableW;
    const y = pad + (1 - v) * usableH;
    return `${x},${y}`;
  });
  return (
    <Svg width={width} height={height}>
      <Polyline
        points={coords.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}
```

Add state inside `HealthScreen`:

```tsx
  const [stats, setStats] = useState<Record<string, HealthStats>>({});
```

- [ ] **Step 3: Load + refresh stats**

Replace the `loadHealth` callback:

```tsx
  const loadHealth = useCallback(async () => {
    const data = await healthService.getDistributorHealth();
    setHealth(data);
    const history = await healthService.getHealthHistory();
    setStats(computeHealthStats(history));
  }, []);
```

Replace the `runTest` callback body (keep the `setTesting`/`setProgress` lines, update the rest):

```tsx
  const runTest = useCallback(async () => {
    setTesting(true);
    setProgress(0);
    try {
      const results = await healthService.testAllDistributors(
        (current, total) => {
          setProgress(Math.round((current / total) * 100));
        },
      );
      setHealth(results);
      const history = await healthService.getHealthHistory();
      setStats(computeHealthStats(history));
    } finally {
      setTesting(false);
    }
  }, []);
```

- [ ] **Step 4: Render the stats block in each row**

In the row render, replace the trailing last-checked `<Text>` (the one with `new Date(h.lastChecked).toLocaleTimeString()`):

```tsx
              <View style={{ alignItems: "flex-end", marginLeft: 8 }}>
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  {h.lastChecked
                    ? new Date(h.lastChecked).toLocaleTimeString()
                    : "Never"}
                </Text>
                {stats[h.distributorId] ? (
                  <>
                    <Text
                      style={{
                        color: statusColors[h.status],
                        fontSize: 12,
                        fontWeight: "700",
                        marginTop: 2,
                      }}
                    >
                      {stats[h.distributorId].uptimePct}%{" "}
                      {stats[h.distributorId].trend === "up"
                        ? "▲"
                        : stats[h.distributorId].trend === "down"
                          ? "▼"
                          : "–"}
                    </Text>
                    <HealthSparkline
                      data={stats[h.distributorId].sparkline}
                      color={statusColors[h.status]}
                    />
                  </>
                ) : (
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                    –
                  </Text>
                )}
              </View>
```

- [ ] **Step 5: Typecheck + lint**

Run: `pnpm check`
Expected: 0 TypeScript errors.

Run: `pnpm lint`
Expected: clean (only pre-existing MODULE_TYPELESS warning).

- [ ] **Step 6: Browser smoke test**

With the DB-backed server + HTTPS static server running (see `/tmp/opencode/webpush/run-server-db.sh` and `https-static.cjs`), rebuild the web export and verify the health screen:

```bash
npx expo export -p web --clear
```

Then in headed Chromium at `https://localhost:8443/health`:
1. The distributor list renders with the existing status dots and last-checked times.
2. Rows show `–` for uptime when no history exists yet.
3. Tap "Test All Distributors" — after it completes, rows show an uptime % (e.g. `100%` or `0%`), a trend glyph, and a small sparkline.
4. Filter chips still work.

- [ ] **Step 7: Commit**

```bash
git add app/health.tsx
git commit -m "feat: health dashboard uptime, trend, and sparkline"
```

---

### Task 7: Docs + full verification

**Files:**
- Modify: `todo.md`

- [ ] **Step 1: Run the full verification suite**

Run: `pnpm check`
Expected: 0 TypeScript errors.

Run: `pnpm lint`
Expected: clean (only pre-existing MODULE_TYPELESS warning).

Run: `pnpm test`
Expected: all pass (existing 746 + new health history/stats tests).

- [ ] **Step 2: Update `todo.md`**

Append a Phase 57 section:

```markdown
## Phase 57: Distributor Health History & Trends (v5.5)

- [x] Rolling capped health history per distributor (30 days / 90 samples, local AsyncStorage)
- [x] Passive capture: background price-check collector + manual Test All record history samples
- [x] computeHealthStats: uptime %, trend (up/down/flat), status sparkline (working/blocked/error)
- [x] Health dashboard rows show uptime %, trend glyph, and SVG sparkline
- [x] Tests: health history storage, pruning, computeHealthStats, capture integration
```

- [ ] **Step 3: Commit**

```bash
git add todo.md
git commit -m "docs: Phase 57 distributor health history & trends (v5.5) in todo.md"
```

---

## Self-Review Notes

- **Spec coverage:** history storage + pruning (Tasks 1-2), `computeHealthStats` (Task 3), capture via `testAllDistributors` (Task 4) and background collector `flush` (Task 5), UI uptime/trend/sparkline (Task 6), docs (Task 7). Error handling (silent fallbacks, never-throw `recordSample`) is implemented inline in each task.
- **Type consistency:** `HealthSample`/`HealthHistory`/`HealthStats` defined in Task 1/3 and used identically in Tasks 2-6. `pruneHealthHistory(samples, now?)` signature consistent between Task 2 definition and Task 1's `recordSample` call. `computeHealthStats(history)` returns `Record<string, HealthStats>` keyed by distributor id, matching `HealthHistory`'s keys.
- **Test infra:** `testAllDistributors` is network-bound; Task 4 mocks `fetchWithParser` (preserving other utils exports via `importOriginal`) so the capture test is deterministic. `createHealthCollector` gains an injectable `service` param (defaulting to the module-level `healthService`) so Task 5 can test `flush` without AsyncStorage.
- **No snapshot changes:** the existing `distributor_health` key, `DistributorHealth` shape, resilientFetch, and circuit-breaker logic are untouched.