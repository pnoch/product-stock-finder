# Web Push for Health Alerts (v5.14) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire health outage/recovery notifications through the web notification path so web users get a browser notification and a history entry, matching native behavior.

**Architecture:** Restructure `scheduleHealthAlert`/`scheduleHealthRecovery` in `lib/notifications.ts` to compute title/body once, branch on platform (web → dynamic-import `displayWebNotification`; native → `scheduleNotificationAsync`), and record the history entry in both paths.

**Tech Stack:** TypeScript 5.9 (strict), React Native 0.81, expo-notifications, vitest.

**Spec:** `docs/superpowers/specs/2026-08-20-web-push-health-alerts-design.md`

---

### Task 1: Restructure `scheduleHealthAlert` for web

**Files:**
- Modify: `lib/notifications.ts`
- Test: `tests/health-notifications.test.ts`

- [ ] **Step 1: Write the failing tests**

In `tests/health-notifications.test.ts`:

1. Add a mock for the dynamically-imported web-notifications module (after the `../lib/storage` mock):

```ts
vi.mock("../lib/web-notifications", () => ({
  displayWebNotification: vi.fn(),
}));
```

2. Replace the "does not record on web" test in the `scheduleHealthAlert` describe block:

```ts
  it("does not record on web", async () => {
    state.platform = "web";
    await scheduleHealthAlert("Winncom", "blocked");
    expect(state.recorded).toHaveLength(0);
  });
```

with:

```ts
  it("displays a web notification and records history on web", async () => {
    state.platform = "web";
    await scheduleHealthAlert("Winncom", "blocked");
    expect(state.recorded).toHaveLength(1);
    expect(state.recorded[0].healthStatus).toBe("blocked");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/health-notifications.test.ts`
Expected: FAIL — the web test asserts `recorded` has length 1, but the current web path returns early with no recording.

- [ ] **Step 3: Implement the web branch**

In `lib/notifications.ts`, replace the entire `scheduleHealthAlert` function:

```ts
export async function scheduleHealthAlert(
  distributorName: string,
  status: HealthStatus,
  reason?: string,
): Promise<string | null> {
  const title =
    status === "blocked" ? "🟠 Distributor Blocked" : "🔴 Distributor Down";
  const body = `${distributorName} has been ${status} for ${HEALTH_ALERT_THRESHOLD} consecutive probes${reason ? ` — ${reason}` : ""}`;
  let id: string | null = null;
  if (Platform.OS === "web") {
    try {
      const { displayWebNotification } = await import("./web-notifications");
      displayWebNotification(title, body);
    } catch {
      // web display failures are non-fatal
    }
  } else {
    try {
      id = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { type: "health_alert", distributorName, status },
          sound: "default",
        },
        trigger: null, // immediate
      });
    } catch {
      return null;
    }
  }
  await recordNotificationEvent({
    id: `health-${distributorName}-${Date.now()}`,
    type: "health",
    title,
    body,
    distributorId: distributorName,
    healthStatus: status as "blocked" | "error",
    createdAt: Date.now(),
  });
  return id;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/health-notifications.test.ts`
Expected: PASS — the `scheduleHealthAlert` tests (native recording + web recording) pass; the `scheduleHealthRecovery` web test still fails (not yet restructured).

- [ ] **Step 5: Commit**

```bash
git add lib/notifications.ts tests/health-notifications.test.ts
git commit -m "feat: web notifications for health alerts"
```

---

### Task 2: Restructure `scheduleHealthRecovery` for web

**Files:**
- Modify: `lib/notifications.ts`
- Test: `tests/health-notifications.test.ts`

- [ ] **Step 1: Write the failing test**

In `tests/health-notifications.test.ts`, replace the "does not record on web" test in the `scheduleHealthRecovery` describe block:

```ts
  it("does not record on web", async () => {
    state.platform = "web";
    await scheduleHealthRecovery("Winncom", "error");
    expect(state.recorded).toHaveLength(0);
  });
```

with:

```ts
  it("displays a web notification and records history on web", async () => {
    state.platform = "web";
    await scheduleHealthRecovery("Winncom", "error");
    expect(state.recorded).toHaveLength(1);
    expect(state.recorded[0].healthStatus).toBe("recovered");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/health-notifications.test.ts`
Expected: FAIL — the recovery web test asserts `recorded` has length 1, but the current recovery web path returns early with no recording.

- [ ] **Step 3: Implement the web branch**

In `lib/notifications.ts`, replace the entire `scheduleHealthRecovery` function:

```ts
export async function scheduleHealthRecovery(
  distributorName: string,
  status: HealthStatus,
): Promise<string | null> {
  const title = "🟢 Distributor Recovered";
  const body = `${distributorName} is back online after being ${status}`;
  let id: string | null = null;
  if (Platform.OS === "web") {
    try {
      const { displayWebNotification } = await import("./web-notifications");
      displayWebNotification(title, body);
    } catch {
      // web display failures are non-fatal
    }
  } else {
    try {
      id = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { type: "health_recovery", distributorName, status },
          sound: "default",
        },
        trigger: null, // immediate
      });
    } catch {
      return null;
    }
  }
  await recordNotificationEvent({
    id: `health-${distributorName}-${Date.now()}`,
    type: "health",
    title,
    body,
    distributorId: distributorName,
    healthStatus: "recovered",
    createdAt: Date.now(),
  });
  return id;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/health-notifications.test.ts`
Expected: PASS (all 5 tests).

- [ ] **Step 5: Typecheck + lint**

Run: `pnpm check`
Expected: 0 TypeScript errors.

Run: `pnpm lint`
Expected: clean (only pre-existing MODULE_TYPELESS warning).

- [ ] **Step 6: Commit**

```bash
git add lib/notifications.ts tests/health-notifications.test.ts
git commit -m "feat: web notifications for health recovery"
```

---

### Task 3: Docs + full verification

**Files:**
- Modify: `todo.md`

- [ ] **Step 1: Run the full verification suite**

Run: `pnpm check`
Expected: 0 TypeScript errors.

Run: `pnpm lint`
Expected: clean (only pre-existing MODULE_TYPELESS warning).

Run: `pnpm test`
Expected: all pass (existing 822 + the two updated web tests).

- [ ] **Step 2: Browser smoke test**

With the DB-backed server + HTTPS static server running (see `/tmp/opencode/webpush/run-server-db.sh` and `/tmp/opencode/webpush/https-static.cjs`), rebuild the web export and verify:

```bash
npx expo export -p web --clear
```

Then in headed Chromium at `https://localhost:8443/settings`:
1. The app loads without JS errors.
2. No regression in the settings screen (the health alerts toggle still renders).

NOTE: Health alerts only fire after a real outage/recovery, which can't be triggered in a smoke test — so this is a regression check only. If the smoke servers are not running or you cannot launch a headed browser, attempt to start them via the scripts in `/tmp/opencode/webpush/`. If you genuinely cannot complete the browser smoke test, report back clearly that it was skipped and why — do NOT fake results.

- [ ] **Step 3: Update `todo.md`**

Append a Phase 66 section at the end of the file:

```markdown
## Phase 66: Web Push for Health Alerts (v5.14)

- [x] scheduleHealthAlert/scheduleHealthRecovery display web notifications
- [x] Health history entries recorded on web too
- [x] Tests: web display + recording in health-notifications
```

- [ ] **Step 4: Commit**

```bash
git add todo.md
git commit -m "docs: Phase 66 web push health alerts (v5.14) in todo.md"
```

---

## Self-Review Notes

- **Spec coverage:** `scheduleHealthAlert` web branch (Task 1), `scheduleHealthRecovery` web branch (Task 2), docs + verification (Task 3). Both decisions (record history on web, focus-window click) are implemented.
- **Type consistency:** `displayWebNotification(title, body)` is dynamically imported from `./web-notifications` in both functions (same pattern as `scheduleServerEventNotification`). `recordNotificationEvent` is imported from `./storage` (already present from Phase 65). `HealthStatus` and `HEALTH_ALERT_THRESHOLD` already imported.
- **Test determinism:** `state.platform` is set in `beforeEach`; the web-notifications mock is registered at module level. Native tests unchanged.
- **No schema/sync changes:** reads/writes existing storage keys only; no server, sync, or settings changes.