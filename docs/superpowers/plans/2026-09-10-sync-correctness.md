# Sync Correctness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate timeout drift/leaks, probe duplication/races, and sync overlap/contract drift — no success-path behavior change.

**Architecture:** Shared helper with timer hygiene; extract-and-batch in the probe; mirror mobile's guard + retract block verbatim (adapted to desktop signatures).

**Tech Stack:** TypeScript, vitest root (`pnpm test`) + desktop (`desktop/ pnpm test`), `pnpm check`, `pnpm lint`.

---

### Task 1: Timeout unification + leak fix

**Files:**
- Modify: `lib/with-timeout.ts` (clear on settle)
- Modify: `desktop/src/server-notifications.ts` (adopt × 2)
- Modify: `components/search/manual-add-sheet.tsx` (rename local)
- Test: `tests/with-timeout.test.ts` (append timer test)

Verified facts (re-confirm): shared helper is bare race, no clear; desktop races at `server-notifications.ts:53-58` (mutate→true) and `:68-73` (pull query, returns `result?.events ?? []`); manual-add local `withTimeout<T>(promise, ms): Promise<T>` rejects via `DISCOVER_TIMEOUT_MS = 15_000`.

- [ ] **Step 1: Write the failing test** (append to tests/with-timeout.test.ts — read it first):

```ts
it("clears its timer on settle", async () => {
  vi.useFakeTimers();
  const clearSpy = vi.spyOn(globalThis, "clearTimeout");
  await withTimeout(Promise.resolve(1), 4000);
  expect(clearSpy).toHaveBeenCalled();
  vi.useRealTimers();
  clearSpy.mockRestore();
});
```

Hmm — `clearTimeout` global spy: after `useRealTimers`, restore. Simpler robust form: count pending timers via `vi.getTimerCount()`:

```ts
it("leaves no pending timer after settle", async () => {
  vi.useFakeTimers();
  const p = withTimeout(new Promise<string>(() => {}), 4000);
  expect(vi.getTimerCount()).toBe(1);
  await vi.advanceTimersByTimeAsync(4100);
  await expect(p).resolves.toBeNull();
  expect(vi.getTimerCount()).toBe(0);
  vi.useRealTimers();
});
```

Use the `getTimerCount` form (no spy juggling). Note: the never-settling promise keeps the race pending — fine, the TIMER must be gone.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/with-timeout.test.ts` (root)
Expected: FAIL — timer count stays 1.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/with-timeout.ts
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}
```

Verify `.finally` preserves the race value/rejection (finally passes through — yes, but confirm no test asserts otherwise). Desktop adoptions:

```ts
// uploadConfig:
const result = await withTimeout(
  client.notifications.uploadConfig.mutate({ ...config }).then(() => true as const),
  TIMEOUT_MS,
);
return result === true;
```

```ts
// pullEvents:
const result = await withTimeout(client.notifications.pull.query({}), TIMEOUT_MS);
return result?.events ?? [];
```

Import: `../../../lib/with-timeout` (server-notifications.ts is in desktop/src/ → `../../lib/with-timeout`? desktop/src/server-notifications.ts → root lib = `../../lib/with-timeout`. Verify against neighboring imports in that file first — use whatever depth it uses for lib imports.)

Manual-add rename: `withTimeout` → `withTimeoutReject` + comment `// Reject-semantics variant (vs shared null-semantics withTimeout): discovery treats timeout as failure`:

```ts
// Reject-semantics variant (shared withTimeout resolves null instead):
function withTimeoutReject<T>(promise: Promise<T>, ms: number): Promise<T> {
```

Update its call sites (grep `withTimeout(` in that file — expect 1-2).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/with-timeout.test.ts` (root); `pnpm test health-probe-upload server-notifications` (desktop); any manual-add suite (grep tests for manual-add coverage — run if exists); `pnpm check` (root, 0 errors); `pnpm build` (desktop, exit 0).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/with-timeout.ts tests/with-timeout.test.ts desktop/src/server-notifications.ts components/search/manual-add-sheet.tsx
git commit -m "Refactor: hygienic shared timeout, adopt everywhere. TypeScript: 0 errors."
```

---

### Task 2: Probe handler + single write

**Files:**
- Modify: `desktop/src/lib/health-probe.ts` (extract + batch)
- Test: `desktop/tests/health-probe.test.tsx` (append batching test)

Verified facts (re-confirm): alert block ~59-86, recovery ~87-113, both doing notify + record + get/push/save; `PendingHealthEvent` shape (no id — Task 2 of probing plan established upload synthesizes it); `recordNotificationEvent` entry includes `healthStatus`.

- [ ] **Step 1: Write the failing test** (append — read the file's mock style first):

```tsx
it("batches two distributors into one queue save", async () => {
  // getHealthHistory returns transition histories for TWO distributors;
  // run; expect savePendingHealthEvents toHaveBeenCalledTimes(1)
  // with an array of length 2; both notifications sent.
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test health-probe` (workdir: `desktop/`)
Expected: FAIL — save called twice (once per distributor).

- [ ] **Step 3: Write minimal implementation**

```tsx
async function emitHealthEvent(
  kind: "alert" | "recovery",
  distributorId: string,
  name: string,
  status: "blocked" | "error",
  title: string,
  body: string,
  createdAt: number,
  pending: PendingHealthEvent[],
): Promise<void> {
  const eventId = `health-${distributorId.toLowerCase()}-${status}-${createdAt}`;
  await sendDesktopNotification(title, body);
  await storage.recordNotificationEvent({
    id: eventId,
    type: "health",
    title,
    body,
    distributorId,
    healthStatus: kind === "recovery" ? "recovered" : status,
    createdAt,
  });
  pending.push({ distributorId, distributorName: name, status, title, body, createdAt });
}
```

Verify the `recordNotificationEvent` field names + `PendingHealthEvent` import source first (`lib/types`? `lib/storage/notifications` exports the type — import type from there). Then the loop:

```tsx
const pending: PendingHealthEvent[] = [];
for (const [distributorId, samples] of Object.entries(history)) {
  const name = getDistributorById(distributorId)?.name ?? distributorId;
  if (detectHealthAlert(samples)) {
    const latest = latestOf(samples);
    await emitHealthEvent("alert", distributorId, name, latest.status, title..., body..., createdAt, pending);
  }
  if (detectHealthRecovery(samples)) {
    ... emitHealthEvent("recovery", ...) ...
  }
}
if (pending.length > 0) {
  const existing = await storage.getPendingHealthEvents();
  await storage.savePendingHealthEvents([...existing, ...pending]);
}
```

Keep title/body/eventId construction byte-identical (move, don't rewrite — titles: Blocked/Down/Recovered forms; bodies with 3-consecutive/reason suffix). Verify `latestOf` helper exists in the module (review mentioned it — re-confirm name).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test health-probe` (workdir: `desktop/`) — all 7 pre-existing + 1 new; `pnpm check` (root, 0 errors).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/lib/health-probe.ts desktop/tests/health-probe.test.tsx
git commit -m "Refactor: batched health event emission. TypeScript: 0 errors."
```

---

### Task 3: Sync guard + master switch

**Files:**
- Modify: `desktop/src/server-notifications.ts` (guard + retract)
- Test: `desktop/tests/health-probe-upload.test.tsx` (append; read its storage-mock list first)

Verified facts (re-confirm): `syncDesktopNotifications` has no guard; mobile block at `lib/server-notifications.ts:98-108` (upload empty config + clear buffer + return); desktop `uploadConfig(config)` takes `{alerts, stockWatches, dateReminders}` (+ `healthEvents` from probing Task 2); desktop storage has `getSettings/clearPendingHealthEvents` via factory.

- [ ] **Step 1: Write the failing tests** (append):

```tsx
it("shares one upload across overlapping syncs", async () => {
  // mockMutate with a deferred promise; fire syncDesktopNotifications() twice without awaiting;
  // await both; expect mockMutate toHaveBeenCalledTimes(1).
});

it("retracts config and skips pull when the master switch is off", async () => {
  // getSettings → notificationsEnabled: false;
  // await syncDesktopNotifications();
  // expect mockMutate toHaveBeenCalledWith(expect.objectContaining({ alerts: [], stockWatches: [], dateReminders: [] }));
  // expect clearPendingHealthEvents toHaveBeenCalled(); expect mockPull not toHaveBeenCalled().
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test health-probe-upload` (workdir: `desktop/`)
Expected: FAIL — two uploads; pull still runs when disabled.

- [ ] **Step 3: Write minimal implementation**

```tsx
let syncInFlight: Promise<void> | null = null;

export function syncDesktopNotifications(): Promise<void> {
  if (syncInFlight) return syncInFlight;
  syncInFlight = runSyncDesktopNotifications().finally(() => {
    syncInFlight = null;
  });
  return syncInFlight;
}
```

Rename existing body to `runSyncDesktopNotifications` (or wrap — read the current export form first; mirror mobile's structure exactly). Inside, after settings load (verify settings is loaded early — if not, load it first):

```tsx
if (!settings.notificationsEnabled) {
  await uploadConfig({ alerts: [], stockWatches: [], dateReminders: [] });
  const pending = await storage.getPendingHealthEvents();
  if (pending.length > 0) await storage.clearPendingHealthEvents();
  return;
}
```

Mirror mobile's block (verified above) adapted to desktop names. `healthEvents` omitted from the empty config (server treats absent as no-change? — verify: does uploadConfig overwrite healthEvents with [] or leave? Mobile passes NO healthEvents key in retract (only alerts/watches/reminders) — match mobile exactly: omit the key).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test health-probe-upload server-notifications` (workdir: `desktop/`); `pnpm check` (root, 0 errors); `pnpm build` (workdir: `desktop/`, exit 0).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/server-notifications.ts desktop/tests/health-probe-upload.test.tsx
git commit -m "Fix: guarded sync with master-switch retract. TypeScript: 0 errors."
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
