# Desktop Health Probing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Honor the desktop Health Alerts toggle with scheduled foreground probing, evaluation, notification, and server upload — mirroring mobile's probe task.

**Architecture:** New `desktop/src/lib/health-probe.ts` (`runHealthProbeIfDue`, best-effort, never throws) called from the existing 60s App poller; desktop `storage` is the shared `createStorage` factory so pending-events/history APIs already exist; `uploadConfig` gains `healthEvents` (server accepts them).

**Tech Stack:** TypeScript, existing health service + detectors (`lib/scrapers/health`), tRPC, vitest desktop + root, `pnpm check`, `pnpm lint`.

---

### Task 1: Probe module

**Files:**
- Create: `desktop/src/lib/health-probe.ts`
- Test: `desktop/tests/health-probe.test.tsx` (new; `.tsx` only if JSX needed, else `.ts` — check existing naming: most are `.tsx`; match)

Verified facts (re-confirm; NEEDS_CONTEXT on mismatch):
- Gates: `storage.getSettings()` → `{notificationsEnabled, healthAlerts, checkInterval: "hourly"|"daily"|"manual"}`; `isInQuietHours(settings)` from `../../../lib/quiet-hours` (pure, desktop-safe — verify import resolves in build).
- Detectors: `detectHealthAlert(samples, threshold=3)` / `detectHealthRecovery(samples)` from `../../../lib/scrapers/health` (verify specifier form from Health.tsx: `../../../lib/scrapers/health`).
- Probe: Tauri `invoke("check_distributor_health")` → `DistributorHealth[]`; fallback `createTRPCClient` from `./trpc` → `client.health.check.query()` (no input — verify against health.check router).
- Save: mirror Health.tsx:117-123 exactly (read it first: `createHealthService(localAdapter)` + `saveDistributorHealth` + `recordSample` loop + stats? — probe needs samples persisted for detection; copy the save sequence, skip stats recompute).
- localAdapter: define inline in the probe module (same 5-line localStorage adapter as Health.tsx:72-77 — intentional 5-line duplication, do NOT refactor Health.tsx).
- Notify: `sendDesktopNotification(title, body)` from `./notifications` (verify export form).
- History: `storage.recordNotificationEvent(...)` — read `lib/storage/notifications.ts` first for the exact entry shape (`{id, type, title, body, createdAt}`? — verify; `type` value for health? mobile uses type? check `NotificationHistoryEntry` + what mobile scheduleHealthAlert records).
- Pending queue: `storage.getPendingHealthEvents()` / `savePendingHealthEvents()` (exist via factory — verify names).
- Due-tracking: `localStorage` key `"last_health_probe_at"` (epoch ms string); due when `now - last >= (hourly ? 3600e3 : 86400e3)`; stamp AFTER successful probe+save (not before — a failed probe shouldn't reset the clock... mobile task retries on OS schedule; desktop: stamp on success only, failures retry next poller tick).
- Never throws: outer try/catch with `console.error("[health-probe] ...")` (desktop convention).

- [ ] **Step 1: Write the failing tests**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { runHealthProbeIfDue } from "../src/lib/health-probe";

const mockInvoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke: mockInvoke }));

vi.mock("../src/storage", () => ({ storage: mockStorage })); // full mock below
vi.mock("../src/notifications", () => ({ sendDesktopNotification: vi.fn() }));
```

Mock storage needs: getSettings, getPendingHealthEvents, savePendingHealthEvents, recordNotificationEvent. Mock the health service? The module builds `createHealthService(localAdapter)` internally — mock `../../../lib/scrapers/health`? That would also mock the DETECTORS under test... Instead seed history through the real service with localStorage-backed adapter? jsdom localStorage works — but service internals (breaker store, enqueue) make deterministic transitions hard. Pragmatic: mock `createHealthService` to return a controllable fake `{saveDistributorHealth, getHealthHistory, recordSample?}` while keeping REAL `detectHealthAlert/detectHealthRecovery` (import the real ones in the test to build histories? No — the module calls detectors internally; test via history fixtures: `getHealthHistory` returns canned samples).

```tsx
const mockSvc = { saveDistributorHealth: vi.fn(), getHealthHistory: vi.fn(), recordSample: vi.fn() };
vi.mock("../../../lib/scrapers/health", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/scrapers/health")>();
  return { ...actual, createHealthService: vi.fn(() => mockSvc) };
});
```

(Keep real detectors + threshold export; mock only the service factory. Verify `createHealthService` is the exact imported name in the module.)

Cases (settings hourly, not quiet, last probe old unless noted):
1. `manual` interval → invoke never called.
2. `healthAlerts` false (or notificationsEnabled false) → invoke never called.
3. quiet hours (settings.quietHours covering now — use fake timers or a 24h window? `isInQuietHours` with real now: set quietHours start/end to cover current time dynamically in the test) → probe RUNS (mobile probes then suppresses? NO — mobile `checkHealthAlerts` returns early on quiet hours but the PROBE still runs; the module structure: probe always (if due + enabled), evaluation gated. Mirror that: probe runs, no notification, no pending queue. Hmm wait — mobile task: `testAllDistributors()` then `checkHealthAlerts()` (which early-returns in quiet hours). So samples accumulate during quiet hours — correct (3-consecutive detection needs continuity). Mirror exactly.)
4. transition working→blocked×3 (history: [working, blocked, blocked, blocked] — threshold 3 needs length ≥4 with last 3 non-working + before working) → sendDesktopNotification called with Blocked title, pending queued, history recorded.
5. steady blocked (no transition) → no notification (no spam).
6. recovery ([blocked×3..., working] shape per detectHealthRecovery — read its exact logic first and craft) → recovery notification.
7. probe failure (invoke rejects + tRPC rejects) → resolves (never throws), no stamp (next tick retries — assert localStorage key unchanged).

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test health-probe` (workdir: `desktop/`)
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
// desktop/src/lib/health-probe.ts
import { invoke } from "@tauri-apps/api/core";
import { createHealthService, detectHealthAlert, detectHealthRecovery } from "../../../lib/scrapers/health";
import { isInQuietHours } from "../../../lib/quiet-hours";
import { getDistributorById } from "@shared/distributors"; // verify specifier (Health page doesn't import it? mobile health-alerts does — desktop: check @shared/distributors usage in desktop/src first)
import { storage } from "../storage";
import { createTRPCClient } from "./trpc";
import { sendDesktopNotification } from "./notifications";

const LAST_PROBE_KEY = "last_health_probe_at";
const CADENCE_MS = { hourly: 3600_000, daily: 86_400_000 } as const;

const localAdapter = { ...same 5 lines as Health.tsx... };

export async function runHealthProbeIfDue(now = Date.now()): Promise<void> {
  try {
    const settings = await storage.getSettings();
    if (!settings.notificationsEnabled || !settings.healthAlerts) return;
    if (settings.checkInterval === "manual") return;
    const cadence = CADENCE_MS[settings.checkInterval] ?? CADENCE_MS.hourly;
    const last = Number(localStorage.getItem(LAST_PROBE_KEY) ?? 0);
    if (now - last < cadence) return;
    let results;
    try {
      results = await invoke("check_distributor_health");
    } catch {
      const client = createTRPCClient();
      results = await client.health.check.query();
    }
    const svc = createHealthService(localAdapter);
    // mirror Health.tsx save sequence (read first — saveDistributorHealth per result + recordSample loop)
    ...
    localStorage.setItem(LAST_PROBE_KEY, String(now));
    if (isInQuietHours(settings)) return;
    const history = await svc.getHealthHistory();
    for (const [distributorId, samples] of Object.entries(history)) {
      ... alert/recovery with sendDesktopNotification + recordNotificationEvent + pending queue ...
    }
    // trigger upload of pending events if signed in? syncDesktopNotifications runs on its own 60s cadence and will pick up the queue — NO direct call (avoid coupling). Document this.
  } catch (e) {
    console.error("[health-probe] probe failed", e);
  }
}
```

Alert body copy mirrors mobile (`${name} has been ${status} for 3 consecutive probes...` / recovery copy — copy verbatim from `lib/background-tasks/health-alerts.ts`, do NOT paraphrase). History entry: read `recordNotificationEvent` shape + mobile's health history type value first (`"health"`? verify `NotificationHistoryEntry.type` includes it — lib/types.ts:119-121 confirmed `"health"` exists).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test health-probe` (workdir: `desktop/`); `pnpm check` (root, 0 errors).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/lib/health-probe.ts desktop/tests/health-probe.test.tsx
git commit -m "Feat: scheduled desktop health probing. TypeScript: 0 errors."
```

---

### Task 2: Pending events upload

**Files:**
- Modify: `desktop/src/server-notifications.ts` (`PushConfig` + upload call + clear)
- Test: `desktop/tests/health-probe-upload.test.tsx` (new; or extend health-probe.test? separate — different module)

Verified facts (re-confirm): `PushConfig` (alerts/stockWatches/dateReminders) → `uploadConfig.mutate({...config})`; server accepts `healthEvents: [{id, distributorId, distributorName, status, title, body, createdAt}]` (routers.ts:283-294); desktop storage has `getPendingHealthEvents/savePendingHealthEvents/clearPendingHealthEvents` via factory (verify `clearPendingHealthEvents` exists — lib/storage/notifications.ts:91 confirmed). Mobile clear semantics: read mobile sync — does it clear after upload success? Check `lib/server-notifications.ts` runSync for `clearPendingHealthEvents` usage first and mirror.

- [ ] **Step 1: Write the failing tests**

```tsx
vi.mock("../src/lib/trpc", () => ({ createTRPCClient: () => ({ notifications: { uploadConfig: { mutate: mockMutate }, pull: { query: mockPull } } }) }));
// mock ../src/storage: getBackOrderReminders/getAlerts/getStockWatches/getPendingHealthEvents/savePendingHealthEvents/clearPendingHealthEvents + others used by syncDesktopNotifications (read the module first for the full list)

it("includes pending health events in upload and clears on success", async () => {
  mockPending = [{ id: "h1", distributorId: "d1", distributorName: "D1", status: "blocked", title: "t", body: "b", createdAt: 1 }];
  mockMutate.mockResolvedValue({ accepted: true });
  await syncDesktopNotifications();
  expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining({ healthEvents: mockPending }));
  expect(mockClear).toHaveBeenCalled();
});
it("retains the queue when upload fails", async () => {
  mockMutate.mockRejectedValue(new Error("down"));
  await syncDesktopNotifications();
  expect(mockClear).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test health-probe-upload` (workdir: `desktop/`)
Expected: FAIL — `healthEvents` never sent.

- [ ] **Step 3: Write minimal implementation**

```ts
interface PushConfig { ...; healthEvents?: Array<{ id: string; distributorId: string; distributorName: string; status: "blocked" | "error"; title: string; body: string; createdAt: number }>; }
```

In `syncDesktopNotifications` (read the upload block first): fetch pending, include in mutate arg, `clearPendingHealthEvents` on success only (mirror mobile — verify mobile clears only on success; if mobile clears unconditionally, mirror that instead and note it).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test health-probe-upload` (workdir: `desktop/`); `pnpm check` (root, 0 errors).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/server-notifications.ts desktop/tests/health-probe-upload.test.tsx
git commit -m "Feat: upload pending health events from desktop. TypeScript: 0 errors."
```

---

### Task 3: App wiring

**Files:**
- Modify: `desktop/src/App.tsx` (60s poller ~295-313)
- Test: extend `desktop/tests/health-probe.test.tsx`? No — App-level: assert the poller calls `runHealthProbeIfDue` (mock `../src/lib/health-probe`). Rendering full App in test? Check for an existing App render harness (unlikely — App boots everything). Pragmatic: string-guard root test `tests/desktop-health-probe-guard.test.ts` asserting App.tsx imports + calls `runHealthProbeIfDue` inside the interval callback. (Behavioral App render is impractical — document why in the commit message... no, keep commit message exact; note it in the report.)

- [ ] **Step 1: Write the failing guard**

```ts
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("health probe scheduling", () => {
  it("runs the probe on the foreground poller", async () => {
    const text = await readFile("desktop/src/App.tsx", "utf8");
    expect(text).toContain("runHealthProbeIfDue");
    expect(text).toContain("setInterval");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run tests/desktop-health-probe-guard.test.ts` (root)
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation** (inside the existing `run`, after `syncDesktopNotifications`, best-effort):

```tsx
const run = async () => {
  if (cancelled) return;
  if (!isAuthenticatedRef.current) return;
  await syncDesktopNotifications();
  try {
    await runHealthProbeIfDue();
  } catch {
    // probe module never throws by contract; defensive only
  }
};
```

Wait — probe module never throws (outer try/catch inside). The extra try/catch in App is redundant. Decision: call WITHOUT wrapper (`void runHealthProbeIfDue()`? No — sequential await keeps ordering with upload... upload happens on NEXT tick anyway via queue. Simplest: `await runHealthProbeIfDue();` directly — contract guarantees no-throw. If a reviewer disagrees, the module's own catch is the backstop. Go direct.)

Also: should the probe run signed-out? `run` early-returns when signed out — probe needs no auth for Tauri path but upload does; local notify works signed-out. Mobile task runs regardless of auth (only notification toggles gate). Hmm — plan's module gates on settings only, not auth. But App's `run` gates on auth... then signed-out desktop never probes (local-only users get nothing — same limitation as push). Options: (a) accept (signed-in only, note in report), (b) separate effect for probe without auth gate. Mobile parity says probe regardless of auth (local notifications work offline). Choose (b): separate `useEffect` in App with its own 60s timer? That duplicates the timer... OR call probe inside `run` but hoist before the auth gate:

```tsx
const run = async () => {
  if (cancelled) return;
  await runHealthProbeIfDue();   // works signed-out (local notify); upload queued for later sync
  if (!isAuthenticatedRef.current) return;
  await syncDesktopNotifications();
};
```

Pending events queued while signed-out upload on next signed-in sync (queue persists in localStorage). This matches mobile semantics best. Go with hoisted version.

- [ ] **Step 4: Run to verify**

Run: guard (root) PASS; `pnpm check` (root, 0 errors); `pnpm build` (desktop, exit 0).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/App.tsx tests/desktop-health-probe-guard.test.ts
git commit -m "Feat: schedule desktop health probes. TypeScript: 0 errors."
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
