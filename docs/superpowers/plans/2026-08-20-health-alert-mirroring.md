# Server-Side Health Alert Mirroring (v5.15) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mirror client-detected health events to the server so signed-in web users get health alerts via real web push even when the tab is closed.

**Architecture:** Client buffers detected health events in AsyncStorage, uploads them via the extended `uploadConfig` endpoint during periodic sync, server stores them scoped to the user and pushes to all user devices except the source. Dedup: stable event IDs + `displayedEventId` on source device.

**Tech Stack:** TypeScript 5.9 (strict), React Native 0.81, tRPC v11, vitest, AsyncStorage.

**Spec:** `docs/superpowers/specs/2026-08-20-health-alert-mirroring-design.md`

---

### Task 1: Server — extend sendPushForUser + NotificationConfig + healthEvents processing

**Files:**
- Modify: `server/push-notifications.ts`
- Modify: `server/notifications.ts`
- Test: `tests/notifications.test.ts`

- [ ] **Step 1: Write the failing tests**

In `tests/notifications.test.ts`, add after the existing `upsertDeviceConfig` describe block:

```ts
describe("upsertDeviceConfig with healthEvents", () => {
  beforeEach(() => {
    clearNotificationsForTests();
    vi.clearAllMocks();
    mockedGetDb.mockResolvedValue(null);
  });

  it("stores health events and pushes to other devices", async () => {
    await upsertDeviceConfig("dev-1", baseConfig, 42);
    await upsertDeviceConfig(
      "dev-2",
      {
        ...baseConfig,
        healthEvents: [
          {
            id: "health-winncom-blocked-1234",
            distributorId: "winncom",
            distributorName: "Winncom",
            status: "blocked",
            title: "🟠 Distributor Blocked",
            body: "Winncom has been blocked for 3 consecutive probes",
            createdAt: 1234,
          },
        ],
      },
      42,
    );
    const events = await pullPendingEvents("dev-1");
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe("health");
    expect(events[0]!.distributorId).toBe("winncom");
    expect(sendPushForUser).toHaveBeenCalledWith(
      42,
      expect.arrayContaining([
        expect.objectContaining({ id: "health-winncom-blocked-1234" }),
      ]),
      "dev-2",
    );
  });

  it("deduplicates health events by id", async () => {
    await upsertDeviceConfig("dev-1", baseConfig, 42);
    const healthEvent = {
      id: "health-winncom-blocked-1234",
      distributorId: "winncom",
      distributorName: "Winncom",
      status: "blocked" as const,
      title: "🟠 Distributor Blocked",
      body: "Winncom has been blocked for 3 consecutive probes",
      createdAt: 1234,
    };
    await upsertDeviceConfig(
      "dev-2",
      { ...baseConfig, healthEvents: [healthEvent] },
      42,
    );
    await upsertDeviceConfig(
      "dev-3",
      { ...baseConfig, healthEvents: [healthEvent] },
      42,
    );
    const events = await pullPendingEvents("dev-1");
    expect(events).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/notifications.test.ts`
Expected: FAIL — `healthEvents` not handled yet.

- [ ] **Step 3: Extend `sendPushForUser` with `excludeDeviceId`**

In `server/push-notifications.ts`, replace the `sendPushForUser` function (lines 118-147):

```ts
export async function sendPushForUser(
  userId: number,
  events: PushableEvent[],
  excludeDeviceId?: string,
): Promise<void> {
  if (events.length === 0) return;
  let deviceIds: string[] = [];
  try {
    const db = await getDb();
    if (db) {
      const rows = await db
        .select({ deviceId: devicePushTokens.deviceId })
        .from(devicePushTokens)
        .where(eq(devicePushTokens.userId, userId));
      deviceIds = rows.map((r) => r.deviceId);
    } else {
      deviceIds = [...memoryTokens.entries()]
        .filter(([, t]) => t.userId === userId)
        .map(([deviceId]) => deviceId);
    }
  } catch (error) {
    console.warn(
      `[Push] Failed to read push tokens for user ${userId}:`,
      error,
    );
    return;
  }
  for (const deviceId of deviceIds) {
    if (deviceId === excludeDeviceId) continue;
    await sendPushForDevice(deviceId, events);
  }
}
```

- [ ] **Step 4: Extend `NotificationConfig` with `healthEvents`**

In `server/notifications.ts`, add `healthEvents` to the `NotificationConfig` interface (line 17):

```ts
export interface NotificationConfig {
  alerts: Array<{
    id: string;
    productId: string;
    targetPrice: number;
    currency: string;
    distributorId?: string;
  }>;
  stockWatches: Array<{
    id: string;
    productId: string;
    distributorId: string;
    lastKnownStatus?: string;
  }>;
  dateReminders: Array<{
    id: string;
    productId: string;
    distributorId: string;
    reminderDate: string;
  }>;
  healthEvents?: Array<{
    id: string;
    distributorId: string;
    distributorName: string;
    status: "blocked" | "error";
    title: string;
    body: string;
    createdAt: number;
  }>;
}
```

- [ ] **Step 5: Add `processHealthEvents` helper and call from `upsertDeviceConfig`**

In `server/notifications.ts`, add the helper function before `upsertDeviceConfig` (around line 84):

```ts
function dedupKeyForHealth(event: {
  distributorId: string;
  status: string;
  createdAt: number;
}): string {
  return `health:${event.distributorId}:${event.status}:${event.createdAt}`;
}

async function processHealthEvents(
  deviceId: string,
  config: NotificationConfig,
  userId: number | null,
): Promise<void> {
  const healthEvents = config.healthEvents;
  if (!healthEvents || healthEvents.length === 0) return;

  const db = await getDb();
  const toInsert: Array<Record<string, unknown>> = [];

  for (const event of healthEvents) {
    const dedupKey = dedupKeyForHealth(event);
    if (db) {
      const existing = await db
        .select({ id: notificationEvents.id })
        .from(notificationEvents)
        .where(
          and(
            eq(notificationEvents.userId, userId),
            eq(notificationEvents.dedupKey, dedupKey),
          ),
        );
      if (existing.length > 0) continue;
    } else {
      const exists = [...memoryEvents.values()].some(
        (e) => e.userId === userId && e.dedupKey === dedupKey,
      );
      if (exists) continue;
    }

    const dbEvent = {
      id: event.id,
      type: "health",
      title: event.title,
      body: event.body,
      payload: {
        distributorId: event.distributorId,
        distributorName: event.distributorName,
        healthStatus: event.status,
      },
      createdAt: event.createdAt,
      deviceId: null,
      userId,
      dedupKey,
    };

    if (db) {
      await db.insert(notificationEvents).values(dbEvent);
    } else {
      memoryEvents.set(event.id, dbEvent as MemoryEvent);
    }
    toInsert.push(dbEvent);
  }

  if (toInsert.length > 0 && userId !== null) {
    const pushable = toInsert.map((e) => ({
      id: e.id as string,
      title: e.title as string,
      body: e.body as string,
    }));
    void sendPushForUser(userId, pushable, deviceId);
  }
}
```

Then modify `upsertDeviceConfig` to call `processHealthEvents` at the end of both branches:

In the memory branch (after `memoryConfigs.set(deviceId, { config, userId: effectiveUserId });`), add:
```ts
    await processHealthEvents(deviceId, config, effectiveUserId);
```

In the DB branch (before the closing `}` of the function, after the `db.insert(...).onDuplicateKeyUpdate(...)` call), add:
```ts
  await processHealthEvents(deviceId, config, userId);
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/notifications.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/push-notifications.ts server/notifications.ts tests/notifications.test.ts
git commit -m "feat: server-side healthEvents processing + push exclusion"
```
### Task 2: Server — extend uploadConfig tRPC schema

**Files:**
- Modify: `server/routers.ts`
- Test: `tests/notifications-router.test.ts`

- [ ] **Step 1: Write the failing test**

In `tests/notifications-router.test.ts`, add after the existing "uploads a device config" test (after line 84):

```ts
  it("uploads a device config with healthEvents", async () => {
    mockedUpsert.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.notifications.uploadConfig({
      deviceId: "dev-1",
      alerts: [],
      stockWatches: [],
      dateReminders: [],
      healthEvents: [
        {
          id: "health-winncom-blocked-1234",
          distributorId: "winncom",
          distributorName: "Winncom",
          status: "blocked",
          title: "🟠 Distributor Blocked",
          body: "Winncom has been blocked for 3 consecutive probes",
          createdAt: 1234,
        },
      ],
    });
    expect(result).toEqual({ accepted: true });
    expect(mockedUpsert).toHaveBeenCalledWith(
      "dev-1",
      expect.objectContaining({
        healthEvents: expect.arrayContaining([
          expect.objectContaining({ distributorId: "winncom" }),
        ]),
      }),
      null,
    );
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/notifications-router.test.ts`
Expected: FAIL — `healthEvents` not in schema yet.

- [ ] **Step 3: Extend the tRPC schema and pass through**

In `server/routers.ts`, add `healthEvents` to the `uploadConfig` input schema (inside the `z.object({...})` at line 159):

After the `dateReminders` field, add:

```ts
          healthEvents: z
            .array(
              z.object({
                id: z.string().min(1),
                distributorId: z.string().min(1),
                distributorName: z.string().min(1),
                status: z.enum(["blocked", "error"]),
                title: z.string().min(1),
                body: z.string().min(1),
                createdAt: z.number(),
              }),
            )
            .optional(),
```

In the mutation handler (line 188-198), pass `healthEvents` through to `upsertDeviceConfig`:

```ts
      .mutation(async ({ input, ctx }) => {
        await upsertDeviceConfig(
          input.deviceId,
          {
            alerts: input.alerts,
            stockWatches: input.stockWatches,
            dateReminders: input.dateReminders,
            healthEvents: input.healthEvents,
          },
          ctx.user?.id ?? null,
        );
        return { accepted: true } as const;
      }),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/notifications-router.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/routers.ts tests/notifications-router.test.ts
git commit -m "feat: extend uploadConfig tRPC schema with healthEvents"
```

---

### Task 3: Client — storage CRUD + uploadHealthEventToServer + extend uploadNotificationConfig

**Files:**
- Modify: `lib/storage.ts`
- Modify: `lib/server-notifications.ts`
- Test: `tests/server-notifications.test.ts`

- [ ] **Step 1: Write the failing tests**

In `tests/server-notifications.test.ts`, add new describe blocks:

```ts
describe("uploadNotificationConfig with healthEvents", () => {
  beforeEach(() => vi.clearAllMocks());

  it("includes healthEvents in the mutate call", async () => {
    const mutate = vi.fn().mockResolvedValue({ accepted: true });
    mockClient({ uploadConfig: mutate });
    const ok = await uploadNotificationConfig(
      "dev-1",
      {
        alerts: [],
        stockWatches: [],
        dateReminders: [],
        healthEvents: [
          {
            id: "health-winncom-blocked-1234",
            distributorId: "winncom",
            distributorName: "Winncom",
            status: "blocked",
            title: "🟠 Distributor Blocked",
            body: "Winncom has been blocked for 3 consecutive probes",
            createdAt: 1234,
          },
        ],
      },
    );
    expect(ok).toBe(true);
    expect(mutate).toHaveBeenCalledWith({
      deviceId: "dev-1",
      alerts: [],
      stockWatches: [],
      dateReminders: [],
      healthEvents: [
        {
          id: "health-winncom-blocked-1234",
          distributorId: "winncom",
          distributorName: "Winncom",
          status: "blocked",
          title: "🟠 Distributor Blocked",
          body: "Winncom has been blocked for 3 consecutive probes",
          createdAt: 1234,
        },
      ],
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server-notifications.test.ts`
Expected: FAIL — `uploadNotificationConfig` doesn't pass `healthEvents` through yet.

- [ ] **Step 3: Add storage CRUD for pending_health_events**

In `lib/storage.ts`, add `PENDING_HEALTH_EVENTS` to the KEYS object (after `FX_RATES`):

```ts
    PENDING_HEALTH_EVENTS: "pending_health_events",
```

Add the CRUD functions inside `createStorage` (after the `getUnreadNotificationCount` function, around line 665):

```ts
  // ─── Pending Health Events (server mirroring buffer) ─────────────────────

  async function getPendingHealthEvents(): Promise<
    Array<{
      distributorId: string;
      distributorName: string;
      status: "blocked" | "error";
      title: string;
      body: string;
      createdAt: number;
    }>
  > {
    return readList(KEYS.PENDING_HEALTH_EVENTS);
  }

  async function savePendingHealthEvents(
    events: Array<{
      distributorId: string;
      distributorName: string;
      status: "blocked" | "error";
      title: string;
      body: string;
      createdAt: number;
    }>,
  ): Promise<void> {
    await adapter.setItem(KEYS.PENDING_HEALTH_EVENTS, JSON.stringify(events));
  }

  async function clearPendingHealthEvents(): Promise<void> {
    await adapter.removeItem(KEYS.PENDING_HEALTH_EVENTS);
  }
```

Add the new keys to `clearAllData` (add `KEYS.PENDING_HEALTH_EVENTS` to the `multiRemove` array).

Add the new functions to the `return` object and the default exports:

In the `return` object, add:
```ts
    getPendingHealthEvents,
    savePendingHealthEvents,
    clearPendingHealthEvents,
```

In the default exports destructuring, add:
```ts
  getPendingHealthEvents,
  savePendingHealthEvents,
  clearPendingHealthEvents,
```

- [ ] **Step 4: Modify `uploadNotificationConfig` to accept optional `healthEvents`**

In `lib/server-notifications.ts`, update the `uploadNotificationConfig` function signature and pass through:

```ts
export async function uploadNotificationConfig(
  deviceId: string,
  config: NotificationConfig,
  healthEvents?: Array<{
    id: string;
    distributorId: string;
    distributorName: string;
    status: "blocked" | "error";
    title: string;
    body: string;
    createdAt: number;
  }>,
): Promise<boolean> {
  try {
    const client = createTRPCClient();
    await Promise.race([
      client.notifications.uploadConfig.mutate({
        deviceId,
        ...config,
        healthEvents,
      }),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), TIMEOUT_MS),
      ),
    ]);
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/server-notifications.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/storage.ts lib/server-notifications.ts tests/server-notifications.test.ts
git commit -m "feat: client storage CRUD + uploadNotificationConfig healthEvents passthrough"
```
### Task 4: Client — syncServerNotifications includes pending health events

**Files:**
- Modify: `lib/server-notifications.ts`
- Test: `tests/server-notifications.test.ts`

- [ ] **Step 1: Write the failing test**

In `tests/server-notifications.test.ts`, add a new describe block after the existing `syncServerNotifications` tests:

```ts
describe("syncServerNotifications includes health events", () => {
  beforeEach(() => vi.clearAllMocks());

  it("includes pending health events in uploadConfig call", async () => {
    const mutate = vi.fn().mockResolvedValue({ accepted: true });
    const query = vi.fn().mockResolvedValue({ events: [] });
    mockClient({ uploadConfig: mutate, pull: query });

    const storage = await import("../lib/storage");
    vi.mocked(storage.getPendingHealthEvents).mockResolvedValue([
      {
        distributorId: "winncom",
        distributorName: "Winncom",
        status: "blocked",
        title: "🟠 Distributor Blocked",
        body: "Winncom has been blocked",
        createdAt: 1234,
      },
    ]);
    vi.mocked(storage.clearPendingHealthEvents).mockResolvedValue(undefined);

    await syncServerNotifications();

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        healthEvents: expect.arrayContaining([
          expect.objectContaining({ distributorId: "winncom" }),
        ]),
      }),
    );
    expect(storage.clearPendingHealthEvents).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server-notifications.test.ts`
Expected: FAIL — `syncServerNotifications` doesn't include health events yet.

- [ ] **Step 3: Modify `syncServerNotifications` to include pending health events**

In `lib/server-notifications.ts`, update `runSyncServerNotifications`:

Before the `await uploadNotificationConfig(...)` call, add:

```ts
    const { getPendingHealthEvents, clearPendingHealthEvents } = await import("./storage");
    const pendingHealthEvents = await getPendingHealthEvents();
```

Then update the `uploadNotificationConfig` call to pass health events:

```ts
    await uploadNotificationConfig(
      deviceId,
      { alerts, stockWatches, dateReminders },
      pendingHealthEvents.length > 0
        ? pendingHealthEvents.map((e) => ({
            id: `health-${e.distributorId}-${e.status}-${e.createdAt}`,
            distributorId: e.distributorId,
            distributorName: e.distributorName,
            status: e.status,
            title: e.title,
            body: e.body,
            createdAt: e.createdAt,
          }))
        : undefined,
    );
```

After the `uploadNotificationConfig` call, clear the buffer:

```ts
    if (pendingHealthEvents.length > 0) {
      await clearPendingHealthEvents();
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/server-notifications.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/server-notifications.ts tests/server-notifications.test.ts
git commit -m "feat: syncServerNotifications includes pending health events"
```
### Task 5: Client — checkHealthAlerts mirrors detected events to server

**Files:**
- Modify: `lib/background-price-check.ts`
- Modify: `lib/notifications.ts`
- Test: `tests/health-notifications.test.ts`

- [ ] **Step 1: Write the failing test**

In `tests/health-notifications.test.ts`, add a new describe block:

```ts
describe("scheduleHealthAlert records displayedEventId", () => {
  it("records the event id as displayed after scheduling", async () => {
    state.platform = "ios";
    state.scheduled.length = 0;
    state.recorded.length = 0;
    await scheduleHealthAlert("Winncom", "blocked");
    const recorded = state.recorded[0] as Record<string, unknown>;
    expect(recorded.id).toMatch(/^health-winncom-blocked-\d+$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/health-notifications.test.ts`
Expected: FAIL — event id doesn't follow the new pattern yet (still uses `Date.now()` from inside scheduleHealthAlert, not from the caller).

- [ ] **Step 3: Add `uploadHealthEventToServer` to `lib/server-notifications.ts`**

In `lib/server-notifications.ts`, add a new exported function:

```ts
export async function uploadHealthEventToServer(event: {
  distributorId: string;
  distributorName: string;
  status: "blocked" | "error";
  title: string;
  body: string;
  createdAt: number;
}): Promise<void> {
  const { getPendingHealthEvents, savePendingHealthEvents } = await import("./storage");
  const pending = await getPendingHealthEvents();
  pending.push(event);
  await savePendingHealthEvents(pending);
}
```

- [ ] **Step 4: Modify `checkHealthAlerts` to mirror events to server**

In `lib/background-price-check.ts`, update `checkHealthAlerts` (around line 377).

After the `await scheduleHealthAlert(name, latest.status, latest.reason);` line, add:

```ts
        const { uploadHealthEventToServer } = await import("./server-notifications");
        void uploadHealthEventToServer({
          distributorId,
          distributorName: name,
          status: latest.status,
          title:
            latest.status === "blocked"
              ? "🟠 Distributor Blocked"
              : "🔴 Distributor Down",
          body: `${name} has been ${latest.status} for 3 consecutive probes${latest.reason ? ` — ${latest.reason}` : ""}`,
          createdAt: Date.now(),
        });
```

After the `await scheduleHealthRecovery(name, prev.status);` line, add:

```ts
        const { uploadHealthEventToServer } = await import("./server-notifications");
        void uploadHealthEventToServer({
          distributorId,
          distributorName: name,
          status: prev.status,
          title: "🟢 Distributor Recovered",
          body: `${name} is back online after being ${prev.status}`,
          createdAt: Date.now(),
        });
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/health-notifications.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/background-price-check.ts lib/server-notifications.ts tests/health-notifications.test.ts
git commit -m "feat: checkHealthAlerts mirrors detected events to server"
```
### Task 6: Docs + full verification

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

With servers running, rebuild web export:
```bash
npx expo export -p web --clear
```

Verify in headed Chromium at `https://localhost:8443/settings`:
1. App loads without JS errors.
2. Settings screen renders with health alerts toggle intact.

NOTE: Health events fire on native (background task), not web. This is a regression check only.

- [ ] **Step 3: Update `todo.md`**

Append a Phase 67 section at the end of the file:

```markdown
## Phase 67: Server-Side Health Alert Mirroring (v5.15)

- [x] uploadConfig accepts healthEvents from client
- [x] Server stores health events + pushes to user devices (excluding source)
- [x] Client buffers + uploads detected health events via syncServerNotifications
- [x] Dedup: stable IDs + displayedEventId on source device
- [x] Tests: notifications, notifications-router, server-notifications, health-notifications
```

- [ ] **Step 4: Commit**

```bash
git add todo.md
git commit -m "docs: Phase 67 health alert mirroring (v5.15) in todo.md"
```

---

## Self-Review Notes

- **Spec coverage:** All spec sections covered: NotificationConfig extension (Task 1), upsertDeviceConfig processing (Task 1), sendPushForUser exclusion (Task 1), tRPC schema (Task 2), client storage CRUD (Task 3), syncServerNotifications integration (Task 4), checkHealthAlerts mirroring (Task 5).
- **Type consistency:** `HealthEventPayload` fields (distributorId, distributorName, status, title, body, createdAt) match across server notifications.ts, server-notifications.ts, and routers.ts schema. `NotificationConfig.healthEvents` optional array. `sendPushForUser` `excludeDeviceId` optional string.
- **Dedup:** Server deduplicates by `dedupKey: health:${distributorId}:${status}:${createdAt}`. Client records `displayedEventId` locally so pull doesn't re-display. Push excludes source device.
- **No schema/sync changes:** No new database tables. No shared types changes. Health events stored in existing `notificationEvents` table (string columns accept any type value).
- **Port 8081:** Not used.
- **No pnpm format:** Not run.
- **No template.json/_core changes:** Not touched.
