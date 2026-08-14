# User-Scoped Notifications Implementation Plan (v4.0)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make server notifications user-scoped — devices bind to a user on authenticated calls, events are evaluated once per user across all bound devices, and delivered to every bound device (with catch-up), while anonymous devices keep the existing device-scoped flow.

**Architecture:** Add nullable `userId` columns to the device config/token/event tables and a `notificationEventDeliveries` junction table for per-device delivery. `server/notifications.ts` groups configs by `userId`, aggregates+dedupes them, evaluates once per user, and `pullPendingEvents(deviceId, userId?)` becomes hybrid. Routers stay `publicProcedure` but pass `ctx.user?.id` when present. No client code changes.

**Tech Stack:** TypeScript, Drizzle ORM (MySQL), tRPC, vitest. Server modules use in-memory fallbacks when `getDb()` returns null (all tests run against these).

---

### Task 1: Schema — userId columns + delivery junction (migration 0008)

**Files:**
- Modify: `drizzle/schema.ts:148-187`

This task adds the new columns and the junction table but does NOT drop `deliveredAt` yet — the existing `pullPendingEvents` DB path still references it, and the drop happens in Task 4 after the code is rewritten.

- [ ] **Step 1: Update `deviceNotificationConfigs` and `devicePushTokens`**

In `drizzle/schema.ts`, add a nullable `userId` int FK to both tables. Change `deviceNotificationConfigs` (lines 148-157) to:

```ts
export const deviceNotificationConfigs = mysqlTable(
  "device_notification_configs",
  {
    deviceId: varchar("deviceId", { length: 128 }).notNull().primaryKey(),
    userId: int("userId").references(() => users.id),
    alerts: json("alerts"),
    stockWatches: json("stockWatches"),
    dateReminders: json("dateReminders"),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  },
);
```

Change `devicePushTokens` (lines 179-184) to:

```ts
export const devicePushTokens = mysqlTable("device_push_tokens", {
  deviceId: varchar("deviceId", { length: 128 }).notNull().primaryKey(),
  userId: int("userId").references(() => users.id),
  token: varchar("token", { length: 255 }).notNull(),
  platform: varchar("platform", { length: 16 }).notNull(),
  updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
});
```

- [ ] **Step 2: Add `userId` to `notificationEvents` and add the delivery junction**

Change `notificationEvents` (lines 164-174) to add `userId` (keep `deliveredAt` for now):

```ts
export const notificationEvents = mysqlTable("notification_events", {
  id: varchar("id", { length: 128 }).notNull().primaryKey(),
  userId: int("userId").references(() => users.id),
  deviceId: varchar("deviceId", { length: 128 }).notNull(),
  type: varchar("type", { length: 16 }).notNull(),
  dedupKey: varchar("dedupKey", { length: 255 }).notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  payload: json("payload"),
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  deliveredAt: bigint("deliveredAt", { mode: "number" }),
});
```

After the `notificationEvents` type exports (line 177), add the junction table:

```ts
export const notificationEventDeliveries = mysqlTable(
  "notification_event_deliveries",
  {
    deviceId: varchar("deviceId", { length: 128 }).notNull(),
    eventId: varchar("eventId", { length: 128 }).notNull(),
    deliveredAt: bigint("deliveredAt", { mode: "number" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.deviceId, table.eventId] })],
);

export type NotificationEventDeliveryRow =
  typeof notificationEventDeliveries.$inferSelect;
export type InsertNotificationEventDeliveryRow =
  typeof notificationEventDeliveries.$inferInsert;
```

- [ ] **Step 3: Generate migration 0008**

Run:

```bash
DATABASE_URL="mysql://user:pass@localhost:3306/nonexistent" pnpm drizzle-kit generate
```

Expected: creates `drizzle/0008_<name>.sql` + `drizzle/meta/0008_snapshot.json`, updates `drizzle/meta/_journal.json`. Verify the SQL contains: `ALTER TABLE` adding `userId` to `device_notification_configs`, `device_push_tokens`, and `notification_events`; `CREATE TABLE \`notification_event_deliveries\``. If any expected change is missing, fix `drizzle/schema.ts` and re-run.

- [ ] **Step 4: Typecheck**

Run: `pnpm check`
Expected: 0 errors (existing code still compiles; `deliveredAt` still present).

- [ ] **Step 5: Commit**

```bash
git add drizzle/schema.ts drizzle/0008_*.sql drizzle/meta/0008_snapshot.json drizzle/meta/_journal.json
git commit -m "feat(notifications): add userId binding and delivery junction to schema"
```

---

### Task 2: push-notifications — userId binding + sendPushForUser

**Files:**
- Modify: `server/push-notifications.ts`
- Test: `tests/push-notifications.test.ts`

- [ ] **Step 1: Write the failing tests**

Add `sendPushForUser` to the import at `tests/push-notifications.test.ts:51-56`:

```ts
import {
  upsertPushToken,
  sendPushForDevice,
  sendPushForUser,
  pruneDeviceToken,
  clearPushTokensForTests,
} from "../server/push-notifications";
```

Append to `tests/push-notifications.test.ts` inside the `describe("push-notifications", ...)` block (before the closing `});` at line 196):

```ts
  describe("sendPushForUser", () => {
    beforeEach(() => {
      clearPushTokensForTests();
      sent.length = 0;
      pushState.tickets = [{ status: "ok" }];
      vi.clearAllMocks();
      mockedGetDb.mockResolvedValue(null);
    });

    it("sends a user event to every device bound to the user", async () => {
      await upsertPushToken("dev-1", "ExponentPushToken[abc123]", "ios", 7);
      await upsertPushToken("dev-2", "ExponentPushToken[def456]", "android", 7);
      await sendPushForUser(7, [event]);
      expect(sent).toHaveLength(2);
      expect(sent[0]![0]!.to).toBe("ExponentPushToken[abc123]");
      expect(sent[1]![0]!.to).toBe("ExponentPushToken[def456]");
    });

    it("skips devices bound to other users", async () => {
      await upsertPushToken("dev-1", "ExponentPushToken[abc123]", "ios", 7);
      await upsertPushToken("dev-2", "ExponentPushToken[def456]", "android", 8);
      await sendPushForUser(7, [event]);
      expect(sent).toHaveLength(1);
      expect(sent[0]![0]!.to).toBe("ExponentPushToken[abc123]");
    });

    it("no-ops when the user has no bound devices", async () => {
      await sendPushForUser(7, [event]);
      expect(sent).toHaveLength(0);
    });

    it("sends using device tokens read from the database", async () => {
      mockedGetDb.mockResolvedValue({
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(async () => [
              { deviceId: "dev-1", token: "ExponentPushToken[dbpath]" },
            ]),
          })),
        })),
      } as never);
      await upsertPushToken("dev-1", "ExponentPushToken[dbpath]", "ios", 7);
      await sendPushForUser(7, [event]);
      expect(sent).toHaveLength(1);
      expect(sent[0]![0]!.to).toBe("ExponentPushToken[dbpath]");
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/push-notifications.test.ts`
Expected: FAIL — `sendPushForUser is not a function`.

- [ ] **Step 3: Implement in `server/push-notifications.ts`**

Change `memoryTokens` (line 12) to:

```ts
const memoryTokens = new Map<
  string,
  { token: string; platform: string; userId: number | null }
>();
```

Change `upsertPushToken` (lines 14-30) to:

```ts
export async function upsertPushToken(
  deviceId: string,
  token: string,
  platform: "ios" | "android",
  userId: number | null = null,
): Promise<void> {
  const db = await getDb();
  if (!db) {
    memoryTokens.set(deviceId, { token, platform, userId });
    return;
  }
  await db
    .insert(devicePushTokens)
    .values({ deviceId, token, platform, userId, updatedAt: Date.now() })
    .onDuplicateKeyUpdate({
      set: { token, platform, userId, updatedAt: Date.now() },
    });
}
```

Add `sendPushForUser` after `sendPushForDevice` (after line 76):

```ts
export async function sendPushForUser(
  userId: number,
  events: PushableEvent[],
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
    console.warn(`[Push] Failed to read push tokens for user ${userId}:`, error);
    return;
  }
  for (const deviceId of deviceIds) {
    await sendPushForDevice(deviceId, events);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/push-notifications.test.ts`
Expected: PASS (all existing tests + 4 new).

- [ ] **Step 5: Typecheck**

Run: `pnpm check`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add server/push-notifications.ts tests/push-notifications.test.ts
git commit -m "feat(notifications): bind push tokens to users; sendPushForUser"
```

---

### Task 3: notifications — memory path (binding, hybrid pull, user-scoped evaluation)

**Files:**
- Modify: `server/notifications.ts`
- Test: `tests/notifications.test.ts`

- [ ] **Step 1: Update the test mock and add failing tests**

In `tests/notifications.test.ts`, add `sendPushForUser: vi.fn()` to the `vi.mock("../server/push-notifications", ...)` factory (lines 8-12):

```ts
vi.mock("../server/push-notifications", () => ({
  upsertPushToken: vi.fn(),
  sendPushForDevice: vi.fn(),
  sendPushForUser: vi.fn(),
  clearPushTokensForTests: vi.fn(),
}));
```

Add `sendPushForUser` to the import at line 26:

```ts
import { sendPushForDevice, sendPushForUser } from "../server/push-notifications";
```

Append a new describe block at the end of `tests/notifications.test.ts` (after line 374):

```ts
describe("user-scoped notifications (memory)", () => {
  beforeEach(() => {
    clearNotificationsForTests();
    vi.clearAllMocks();
    mockedGetDb.mockResolvedValue(null);
  });

  it("dedupes an alert shared across a user's devices into one event", async () => {
    await setCachedPrice("server2u-my", "CRS804-4DDQ-hRM", {
      price: 480,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://example.com",
      fetchedAt: Date.now(),
    });
    const alert = {
      id: "a1",
      productId: "mikrotik-crs804-4ddq-hrm",
      targetPrice: 500,
      currency: "USD",
    };
    await upsertDeviceConfig("dev-1", { ...baseConfig, alerts: [alert] }, 7);
    await upsertDeviceConfig("dev-2", { ...baseConfig, alerts: [alert] }, 7);
    await evaluateNotifications(Date.now());
    const dev1 = await pullPendingEvents("dev-1", 7);
    const dev2 = await pullPendingEvents("dev-2", 7);
    expect(dev1).toHaveLength(1);
    expect(dev2).toHaveLength(1);
    expect(dev1[0]!.id).toBe(dev2[0]!.id);
    expect(vi.mocked(sendPushForUser)).toHaveBeenCalledWith(
      7,
      expect.arrayContaining([expect.objectContaining({ type: "price_drop" })]),
    );
  });

  it("catches up a device that binds after the event fired", async () => {
    await setCachedPrice("server2u-my", "CRS804-4DDQ-hRM", {
      price: 480,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://example.com",
      fetchedAt: Date.now(),
    });
    await upsertDeviceConfig(
      "dev-1",
      {
        ...baseConfig,
        alerts: [
          {
            id: "a1",
            productId: "mikrotik-crs804-4ddq-hrm",
            targetPrice: 500,
            currency: "USD",
          },
        ],
      },
      7,
    );
    await evaluateNotifications(Date.now());
    await upsertDeviceConfig("dev-2", { ...baseConfig }, 7);
    const dev1 = await pullPendingEvents("dev-1", 7);
    expect(dev1).toHaveLength(1);
    const dev2 = await pullPendingEvents("dev-2", 7);
    expect(dev2).toHaveLength(1);
    expect(dev2[0]!.id).toBe(dev1[0]!.id);
  });

  it("marks delivery per device, not per user", async () => {
    await setCachedPrice("server2u-my", "CRS804-4DDQ-hRM", {
      price: 480,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://example.com",
      fetchedAt: Date.now(),
    });
    await upsertDeviceConfig(
      "dev-1",
      {
        ...baseConfig,
        alerts: [
          {
            id: "a1",
            productId: "mikrotik-crs804-4ddq-hrm",
            targetPrice: 500,
            currency: "USD",
          },
        ],
      },
      7,
    );
    await upsertDeviceConfig("dev-2", { ...baseConfig }, 7);
    await evaluateNotifications(Date.now());
    const dev1First = await pullPendingEvents("dev-1", 7);
    expect(dev1First).toHaveLength(1);
    const dev2First = await pullPendingEvents("dev-2", 7);
    expect(dev2First).toHaveLength(1);
    const dev1Second = await pullPendingEvents("dev-1", 7);
    expect(dev1Second).toEqual([]);
  });

  it("re-binds a device to a new user", async () => {
    await setCachedPrice("server2u-my", "CRS804-4DDQ-hRM", {
      price: 480,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://example.com",
      fetchedAt: Date.now(),
    });
    await upsertDeviceConfig(
      "dev-1",
      {
        ...baseConfig,
        alerts: [
          {
            id: "a1",
            productId: "mikrotik-crs804-4ddq-hrm",
            targetPrice: 500,
            currency: "USD",
          },
        ],
      },
      7,
    );
    await upsertDeviceConfig(
      "dev-1",
      {
        ...baseConfig,
        alerts: [
          {
            id: "a2",
            productId: "mikrotik-crs804-4ddq-hrm",
            targetPrice: 500,
            currency: "USD",
          },
        ],
      },
      8,
    );
    await evaluateNotifications(Date.now());
    const user7 = await pullPendingEvents("dev-1", 7);
    expect(user7).toEqual([]);
    const user8 = await pullPendingEvents("dev-1", 8);
    expect(user8).toHaveLength(1);
    expect(user8[0]!.alertId).toBe("a2");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/notifications.test.ts`
Expected: FAIL — new tests fail (no user-scoped evaluation yet); existing tests should still pass.

- [ ] **Step 3: Implement the memory path in `server/notifications.ts`**

Update imports. Line 1 add `inArray`:

```ts
import { and, eq, inArray, isNull } from "drizzle-orm";
```

Lines 2-6 add `notificationEventDeliveries`:

```ts
import {
  deviceNotificationConfigs,
  notificationEvents,
  notificationEventDeliveries,
  type InsertNotificationEventRow,
} from "../drizzle/schema";
```

Line 13 add `sendPushForUser`:

```ts
import {
  sendPushForDevice,
  sendPushForUser,
} from "./push-notifications";
```

Change the memory maps and `EventDraft` (lines 53-58) to:

```ts
interface MemoryEvent extends NotificationEvent {
  userId: number | null;
  deviceId: string | null;
}

const memoryConfigs = new Map<
  string,
  { config: NotificationConfig; userId: number | null }
>();
const memoryEvents = new Map<string, MemoryEvent>();
const memoryDeliveries = new Map<string, Set<string>>();

interface EventDraft
  extends Omit<InsertNotificationEventRow, "deviceId" | "userId"> {
  dedupKey: string;
}
```

Change `upsertDeviceConfig` (lines 67-93) to:

```ts
export async function upsertDeviceConfig(
  deviceId: string,
  config: NotificationConfig,
  userId: number | null = null,
): Promise<void> {
  const db = await getDb();
  if (!db) {
    memoryConfigs.set(deviceId, { config, userId });
    return;
  }
  await db
    .insert(deviceNotificationConfigs)
    .values({
      deviceId,
      userId,
      alerts: config.alerts,
      stockWatches: config.stockWatches,
      dateReminders: config.dateReminders,
      updatedAt: Date.now(),
    })
    .onDuplicateKeyUpdate({
      set: {
        userId,
        alerts: config.alerts,
        stockWatches: config.stockWatches,
        dateReminders: config.dateReminders,
        updatedAt: Date.now(),
      },
    });
}
```

Change `evaluateNotifications` (lines 95-131) to:

```ts
export async function evaluateNotifications(now: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    await evaluateMemory(now);
    return;
  }
  const rows = await db.select().from(deviceNotificationConfigs);
  const anonDevices: Array<{ deviceId: string; config: NotificationConfig }> = [];
  const userDevices = new Map<
    number,
    Array<{ deviceId: string; config: NotificationConfig }>
  >();
  for (const row of rows) {
    const config = rowToConfig(row);
    if (row.userId) {
      const list = userDevices.get(row.userId) ?? [];
      list.push({ deviceId: row.deviceId, config });
      userDevices.set(row.userId, list);
    } else {
      anonDevices.push({ deviceId: row.deviceId, config });
    }
  }
  for (const { deviceId, config } of anonDevices) {
    await evaluateConfigDb(db, deviceId, config, now);
  }
  for (const [userId, devices] of userDevices) {
    await evaluateUserDb(db, userId, devices, now);
  }
}
```

Replace `evaluateConfig` (lines 133-152) with the memory helpers:

```ts
async function evaluateMemory(now: number): Promise<void> {
  const anonDevices: Array<{ deviceId: string; config: NotificationConfig }> = [];
  const userDevices = new Map<
    number,
    Array<{ deviceId: string; config: NotificationConfig }>
  >();
  for (const [deviceId, entry] of memoryConfigs) {
    if (entry.userId) {
      const list = userDevices.get(entry.userId) ?? [];
      list.push({ deviceId, config: entry.config });
      userDevices.set(entry.userId, list);
    } else {
      anonDevices.push({ deviceId, config: entry.config });
    }
  }
  for (const { deviceId, config } of anonDevices) {
    await evaluateAnonMemory(deviceId, config, now);
  }
  for (const [userId, devices] of userDevices) {
    await evaluateUserMemory(userId, devices, now);
  }
}

async function evaluateAnonMemory(
  deviceId: string,
  config: NotificationConfig,
  now: number,
): Promise<void> {
  const delivered = memoryDeliveries.get(deviceId) ?? new Set<string>();
  const undelivered = new Set(
    [...memoryEvents.values()]
      .filter((e) => e.deviceId === deviceId)
      .filter((e) => !delivered.has(e.id))
      .map((e) => dedupKeyFor(e)),
  );
  const drafts = await buildEvents(config, now);
  const added: NotificationEvent[] = [];
  for (const draft of drafts) {
    if (undelivered.has(draft.dedupKey)) continue;
    const event = { ...draftToEvent(draft), userId: null, deviceId };
    memoryEvents.set(event.id, event);
    added.push(event);
  }
  if (added.length > 0) void sendPushForDevice(deviceId, added);
}

async function evaluateUserMemory(
  userId: number,
  devices: Array<{ deviceId: string; config: NotificationConfig }>,
  now: number,
): Promise<void> {
  const boundCount = devices.length;
  const config = aggregateConfigs(devices.map((d) => d.config));
  const pending = new Set(
    [...memoryEvents.values()]
      .filter((e) => e.userId === userId)
      .filter((e) => deliveryCount(e.id) < boundCount)
      .map((e) => dedupKeyFor(e)),
  );
  const drafts = await buildEvents(config, now);
  const added: NotificationEvent[] = [];
  for (const draft of drafts) {
    if (pending.has(draft.dedupKey)) continue;
    const event = { ...draftToEvent(draft), userId, deviceId: null };
    memoryEvents.set(event.id, event);
    added.push(event);
  }
  if (added.length > 0) void sendPushForUser(userId, added);
}

function deliveryCount(eventId: string): number {
  let count = 0;
  for (const delivered of memoryDeliveries.values()) {
    if (delivered.has(eventId)) count += 1;
  }
  return count;
}

function aggregateConfigs(configs: NotificationConfig[]): NotificationConfig {
  const alerts = new Map<string, NotificationConfig["alerts"][number]>();
  const stockWatches = new Map<
    string,
    NotificationConfig["stockWatches"][number]
  >();
  const dateReminders = new Map<
    string,
    NotificationConfig["dateReminders"][number]
  >();
  for (const config of configs) {
    for (const alert of config.alerts) {
      if (!alerts.has(alert.id)) alerts.set(alert.id, alert);
    }
    for (const watch of config.stockWatches) {
      if (!stockWatches.has(watch.id)) stockWatches.set(watch.id, watch);
    }
    for (const reminder of config.dateReminders) {
      if (!dateReminders.has(reminder.id)) dateReminders.set(reminder.id, reminder);
    }
  }
  return {
    alerts: [...alerts.values()],
    stockWatches: [...stockWatches.values()],
    dateReminders: [...dateReminders.values()],
  };
}
```

Add the DB-path evaluation helpers after `aggregateConfigs`:

```ts
async function evaluateConfigDb(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  deviceId: string,
  config: NotificationConfig,
  now: number,
): Promise<void> {
  const existing = await db
    .select({ id: notificationEvents.id, dedupKey: notificationEvents.dedupKey })
    .from(notificationEvents)
    .where(eq(notificationEvents.deviceId, deviceId));
  const delivered = await db
    .select({ eventId: notificationEventDeliveries.eventId })
    .from(notificationEventDeliveries)
    .where(eq(notificationEventDeliveries.deviceId, deviceId));
  const deliveredSet = new Set(delivered.map((d) => d.eventId));
  const undelivered = new Set(
    existing.filter((e) => !deliveredSet.has(e.id)).map((e) => e.dedupKey),
  );
  const drafts = await buildEvents(config, now);
  const toInsert = drafts
    .filter((d) => !undelivered.has(d.dedupKey))
    .map((d) => ({ ...d, deviceId, userId: null }));
  if (toInsert.length > 0) {
    await db.insert(notificationEvents).values(toInsert);
    void sendPushForDevice(deviceId, toInsert);
  }
}

async function evaluateUserDb(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  userId: number,
  devices: Array<{ deviceId: string; config: NotificationConfig }>,
  now: number,
): Promise<void> {
  const boundCount = devices.length;
  const config = aggregateConfigs(devices.map((d) => d.config));
  const existing = await db
    .select({ id: notificationEvents.id, dedupKey: notificationEvents.dedupKey })
    .from(notificationEvents)
    .where(eq(notificationEvents.userId, userId));
  const eventIds = existing.map((e) => e.id);
  const deliveryCounts = new Map<string, number>();
  if (eventIds.length > 0) {
    const deliveries = await db
      .select({ eventId: notificationEventDeliveries.eventId })
      .from(notificationEventDeliveries)
      .where(inArray(notificationEventDeliveries.eventId, eventIds));
    for (const d of deliveries) {
      deliveryCounts.set(d.eventId, (deliveryCounts.get(d.eventId) ?? 0) + 1);
    }
  }
  const pending = new Set(
    existing
      .filter((e) => (deliveryCounts.get(e.id) ?? 0) < boundCount)
      .map((e) => e.dedupKey),
  );
  const drafts = await buildEvents(config, now);
  const toInsert = drafts
    .filter((d) => !pending.has(d.dedupKey))
    .map((d) => ({ ...d, userId, deviceId: null }));
  if (toInsert.length > 0) {
    await db.insert(notificationEvents).values(toInsert);
    void sendPushForUser(userId, toInsert);
  }
}
```

Change `pullPendingEvents` (lines 249-279) to the hybrid version. **The memory path uses the new model; the DB path is rewritten to the junction now (it no longer references `deliveredAt`).**

```ts
export async function pullPendingEvents(
  deviceId: string,
  userId?: number,
): Promise<NotificationEvent[]> {
  const db = await getDb();
  if (!db) {
    const delivered = memoryDeliveries.get(deviceId) ?? new Set<string>();
    const list = [...memoryEvents.values()].filter((e) =>
      userId ? e.userId === userId : e.deviceId === deviceId,
    );
    const pending = list.filter((e) => !delivered.has(e.id));
    for (const e of pending) delivered.add(e.id);
    memoryDeliveries.set(deviceId, delivered);
    return pending.map((e) => stripScope(e));
  }
  const rows = await db
    .select({
      id: notificationEvents.id,
      type: notificationEvents.type,
      title: notificationEvents.title,
      body: notificationEvents.body,
      payload: notificationEvents.payload,
      createdAt: notificationEvents.createdAt,
    })
    .from(notificationEvents)
    .leftJoin(
      notificationEventDeliveries,
      and(
        eq(notificationEventDeliveries.eventId, notificationEvents.id),
        eq(notificationEventDeliveries.deviceId, deviceId),
      ),
    )
    .where(
      and(
        userId
          ? eq(notificationEvents.userId, userId)
          : eq(notificationEvents.deviceId, deviceId),
        isNull(notificationEventDeliveries.eventId),
      ),
    );
  if (rows.length > 0) {
    await db.insert(notificationEventDeliveries).values(
      rows.map((r) => ({
        deviceId,
        eventId: r.id,
        deliveredAt: Date.now(),
      })),
    );
  }
  return rows.map(rowToEvent);
}
```

Update `clearNotificationsForTests` (lines 281-284) to:

```ts
export function clearNotificationsForTests(): void {
  memoryConfigs.clear();
  memoryEvents.clear();
  memoryDeliveries.clear();
}
```

Add helpers after `clearNotificationsForTests`:

```ts
function stripScope(event: MemoryEvent): NotificationEvent {
  return {
    id: event.id,
    type: event.type,
    title: event.title,
    body: event.body,
    alertId: event.alertId,
    watchId: event.watchId,
    reminderId: event.reminderId,
    productId: event.productId,
    distributorId: event.distributorId,
    targetPrice: event.targetPrice,
    currency: event.currency,
    triggeredPrice: event.triggeredPrice,
    createdAt: event.createdAt,
  };
}

function rowToConfig(row: {
  alerts: unknown;
  stockWatches: unknown;
  dateReminders: unknown;
}): NotificationConfig {
  return {
    alerts: (row.alerts as NotificationConfig["alerts"]) ?? [],
    stockWatches: (row.stockWatches as NotificationConfig["stockWatches"]) ?? [],
    dateReminders:
      (row.dateReminders as NotificationConfig["dateReminders"]) ?? [],
  };
}
```

**Note:** `buildEvents` still emits `deliveredAt: null` in its three draft objects (lines 196, 220, 242). These are now excess-property type errors because `InsertNotificationEventRow` will not have `deliveredAt` after Task 4 drops it — but `deliveredAt` is still in the schema in this task, so they still compile. Leave them for now; Task 4 removes them together with the schema drop.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/notifications.test.ts`
Expected: PASS (all existing tests + 4 new user-scoped tests).

- [ ] **Step 5: Typecheck**

Run: `pnpm check`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add server/notifications.ts tests/notifications.test.ts
git commit -m "feat(notifications): user-scoped evaluation and hybrid pull"
```

---

### Task 4: notifications — drop deliveredAt + DB-path tests

**Files:**
- Modify: `drizzle/schema.ts:164-174` (drop `deliveredAt`)
- Modify: `server/notifications.ts:196, 220, 242` (remove `deliveredAt: null`)
- Test: `tests/notifications.test.ts`

- [ ] **Step 1: Write the failing DB-path tests**

Append to `tests/notifications.test.ts` (after the memory describe block):

```ts
describe("user-scoped notifications (database)", () => {
  beforeEach(() => {
    clearNotificationsForTests();
    vi.clearAllMocks();
  });

  it("evaluates a user's aggregated config once and pushes to the user", async () => {
    const inserted: unknown[] = [];
    const dbStub = {
      select: vi.fn(() => ({
        from: vi.fn((table: unknown) => {
          if (table === deviceNotificationConfigs) {
            return [
              {
                deviceId: "dev-1",
                userId: 7,
                alerts: [
                  {
                    id: "a1",
                    productId: "mikrotik-crs804-4ddq-hrm",
                    targetPrice: 500,
                    currency: "USD",
                  },
                ],
                stockWatches: [],
                dateReminders: [],
                updatedAt: Date.now(),
              },
              {
                deviceId: "dev-2",
                userId: 7,
                alerts: [
                  {
                    id: "a1",
                    productId: "mikrotik-crs804-4ddq-hrm",
                    targetPrice: 500,
                    currency: "USD",
                  },
                ],
                stockWatches: [],
                dateReminders: [],
                updatedAt: Date.now(),
              },
            ];
          }
          if (table === notificationEvents) {
            return { where: vi.fn(async () => []) };
          }
          if (table === notificationEventDeliveries) {
            return { where: vi.fn(async () => []) };
          }
          return { where: vi.fn(() => []) };
        }),
      })),
      insert: vi.fn((table: unknown) => ({
        values: vi.fn((rows: unknown) => {
          inserted.push(rows);
          return { onDuplicateKeyUpdate: vi.fn(async () => undefined) };
        }),
      })),
    };
    mockedGetDb.mockResolvedValue(dbStub as never);
    await setCachedPrice("server2u-my", "CRS804-4DDQ-hRM", {
      price: 480,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://example.com",
      fetchedAt: Date.now(),
    });
    await evaluateNotifications(Date.now());
    expect(inserted).toHaveLength(1);
    const rows = inserted[0] as Array<Record<string, unknown>>;
    expect(rows[0]).toMatchObject({
      userId: 7,
      deviceId: null,
      type: "price_drop",
    });
    expect(vi.mocked(sendPushForUser)).toHaveBeenCalledWith(
      7,
      expect.arrayContaining([expect.objectContaining({ type: "price_drop" })]),
    );
    mockedGetDb.mockResolvedValue(null);
  });

  it("pulls a user's undelivered events and records per-device delivery", async () => {
    const inserted: unknown[] = [];
    const dbStub = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          leftJoin: vi.fn(() => ({
            where: vi.fn(async () => [
              {
                id: "evt-1",
                type: "price_drop",
                title: "💸 Price Drop Alert!",
                body: "CRS804 is now $480.00!",
                payload: {
                  alertId: "a1",
                  productId: "mikrotik-crs804-4ddq-hrm",
                  triggeredPrice: 480,
                },
                createdAt: 123,
              },
            ]),
          })),
        })),
      })),
      insert: vi.fn((table: unknown) => ({
        values: vi.fn((rows: unknown) => {
          inserted.push(rows);
          return { onDuplicateKeyUpdate: vi.fn(async () => undefined) };
        }),
      })),
    };
    mockedGetDb.mockResolvedValue(dbStub as never);
    const events = await pullPendingEvents("dev-2", 7);
    expect(events).toHaveLength(1);
    expect(events[0]!.alertId).toBe("a1");
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject([
      { deviceId: "dev-2", eventId: "evt-1", deliveredAt: expect.any(Number) },
    ]);
    mockedGetDb.mockResolvedValue(null);
  });
});
```

Add `notificationEventDeliveries` to the schema import at `tests/notifications.test.ts:28`:

```ts
import {
  deviceNotificationConfigs,
  notificationEvents,
  notificationEventDeliveries,
  priceCache,
} from "../drizzle/schema";
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `pnpm test tests/notifications.test.ts`
Expected: PASS (the DB-path helpers were implemented in Task 3; these tests pin them).

- [ ] **Step 3: Drop `deliveredAt` from the schema**

In `drizzle/schema.ts`, change `notificationEvents` (lines 164-174) to remove the `deliveredAt` column:

```ts
export const notificationEvents = mysqlTable("notification_events", {
  id: varchar("id", { length: 128 }).notNull().primaryKey(),
  userId: int("userId").references(() => users.id),
  deviceId: varchar("deviceId", { length: 128 }).notNull(),
  type: varchar("type", { length: 16 }).notNull(),
  dedupKey: varchar("dedupKey", { length: 255 }).notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  payload: json("payload"),
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
});
```

- [ ] **Step 4: Remove `deliveredAt: null` from `buildEvents`**

In `server/notifications.ts`, delete the three `      deliveredAt: null,` lines in `buildEvents` (lines 196, 220, 242). Keep the surrounding `createdAt: now,` and `});`.

- [ ] **Step 5: Generate migration 0009**

Run:

```bash
DATABASE_URL="mysql://user:pass@localhost:3306/nonexistent" pnpm drizzle-kit generate
```

Expected: creates `drizzle/0009_<name>.sql` + `drizzle/meta/0009_snapshot.json`, updates `_journal.json`. Verify the SQL contains `ALTER TABLE \`notification_events\` DROP COLUMN \`deliveredAt\``.

- [ ] **Step 6: Typecheck and full notifications suite**

Run: `pnpm check` — 0 errors.
Run: `pnpm test tests/notifications.test.ts` — all pass.

- [ ] **Step 7: Commit**

```bash
git add drizzle/schema.ts drizzle/0009_*.sql drizzle/meta/0009_snapshot.json drizzle/meta/_journal.json server/notifications.ts tests/notifications.test.ts
git commit -m "feat(notifications): drop deliveredAt; DB-path user-scoped tests"
```

---

### Task 5: routers — hybrid auth branching

**Files:**
- Modify: `server/routers.ts:138-196`
- Test: `tests/notifications-router.test.ts`

- [ ] **Step 1: Update existing assertions and add failing tests**

In `tests/notifications-router.test.ts`, add a helper after `createPublicContext` (line 35):

```ts
function createAuthedContext(userId: number): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `open-${userId}`,
      name: null,
      email: null,
      loginMethod: null,
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as TrpcContext["user"],
    req: {
      protocol: "https",
      hostname: "localhost",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (_name: string, _options: Record<string, unknown>) => {},
    } as TrpcContext["res"],
  };
}
```

Update the existing arg assertions to include the new `userId` argument:
- Line 72: `expect(mockedPull).toHaveBeenCalledWith("dev-1");` → `expect(mockedPull).toHaveBeenCalledWith("dev-1", undefined);`
- Lines 92-96: `expect(mockedUpsertPush).toHaveBeenCalledWith("dev-1", "ExponentPushToken[abc123]", "ios");` → add `, null` at the end.
- Lines 127-138: `expect(mockedUpsert).toHaveBeenCalledWith("dev-1", {...});` → add `, null` after the config object.

Append new tests at the end of the `describe("notifications router", ...)` block (after line 160):

```ts
  it("pulls user-scoped events when authenticated", async () => {
    mockedPull.mockResolvedValue([]);
    const caller = appRouter.createCaller(createAuthedContext(7));
    await caller.notifications.pull({ deviceId: "dev-1" });
    expect(mockedPull).toHaveBeenCalledWith("dev-1", 7);
  });

  it("binds the device to the user on authenticated uploadConfig", async () => {
    mockedUpsert.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createAuthedContext(7));
    await caller.notifications.uploadConfig({
      deviceId: "dev-1",
      alerts: [],
      stockWatches: [],
      dateReminders: [],
    });
    expect(mockedUpsert).toHaveBeenCalledWith(
      "dev-1",
      { alerts: [], stockWatches: [], dateReminders: [] },
      7,
    );
  });

  it("binds the device to the user on authenticated registerPushToken", async () => {
    mockedUpsertPush.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createAuthedContext(7));
    await caller.notifications.registerPushToken({
      deviceId: "dev-1",
      token: "ExponentPushToken[abc123]",
      platform: "ios",
    });
    expect(mockedUpsertPush).toHaveBeenCalledWith(
      "dev-1",
      "ExponentPushToken[abc123]",
      "ios",
      7,
    );
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/notifications-router.test.ts`
Expected: FAIL — existing arg assertions and new tests fail (router doesn't pass `userId` yet).

- [ ] **Step 3: Implement in `server/routers.ts`**

Change the `notifications` router (lines 138-196) so each procedure passes `ctx.user`:

```ts
  notifications: router({
    uploadConfig: publicProcedure
      .input(
        z.object({
          deviceId: z.string().min(1).max(128),
          alerts: z.array(
            z.object({
              id: z.string().min(1),
              productId: z.string().min(1),
              targetPrice: z.number(),
              currency: z.string().min(1),
              distributorId: z.string().optional(),
            }),
          ),
          stockWatches: z.array(
            z.object({
              id: z.string().min(1),
              productId: z.string().min(1),
              distributorId: z.string().min(1),
              lastKnownStatus: z.string().optional(),
            }),
          ),
          dateReminders: z.array(
            z.object({
              id: z.string().min(1),
              productId: z.string().min(1),
              distributorId: z.string().min(1),
              reminderDate: z.string().min(1),
            }),
          ),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        await upsertDeviceConfig(
          input.deviceId,
          {
            alerts: input.alerts,
            stockWatches: input.stockWatches,
            dateReminders: input.dateReminders,
          },
          ctx.user?.id ?? null,
        );
        return { accepted: true } as const;
      }),
    pull: publicProcedure
      .input(z.object({ deviceId: z.string().min(1).max(128) }))
      .query(async ({ input, ctx }) => {
        const events = await pullPendingEvents(
          input.deviceId,
          ctx.user?.id ?? undefined,
        );
        return { events };
      }),
    registerPushToken: publicProcedure
      .input(
        z.object({
          deviceId: z.string().min(1).max(128),
          token: z.string().min(1).max(255),
          platform: z.enum(["ios", "android"]),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        await upsertPushToken(
          input.deviceId,
          input.token,
          input.platform,
          ctx.user?.id ?? null,
        );
        return { accepted: true } as const;
      }),
  }),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/notifications-router.test.ts`
Expected: PASS (all existing tests + 3 new hybrid tests).

- [ ] **Step 5: Typecheck**

Run: `pnpm check`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add server/routers.ts tests/notifications-router.test.ts
git commit -m "feat(notifications): hybrid auth branching in notifications router"
```

---

### Task 6: Checkpoint v4.0

**Files:**
- Modify: `todo.md` (append Phase 40)

- [ ] **Step 1: Format all touched files**

Run: `pnpm exec prettier --write drizzle/schema.ts server/notifications.ts server/push-notifications.ts server/routers.ts tests/notifications.test.ts tests/notifications-router.test.ts tests/push-notifications.test.ts`

- [ ] **Step 2: Run full gates**

Run: `pnpm check` — 0 errors.
Run: `pnpm lint` — clean (only pre-existing `MODULE_TYPELESS_PACKAGE_JSON` warning).
Run: `pnpm test` — full suite green (v4.0 baseline 480 tests / 71 files; expect +13: 4 push + 4 notifications memory + 2 DB + 3 router = 493).

- [ ] **Step 3: Append Phase 40 to `todo.md`**

```md
## Phase 40: User-Scoped Notifications

- [x] Device↔user binding on authenticated uploadConfig / registerPushToken (persists across logout/login)
- [x] notificationEventDeliveries junction for per-device delivery tracking
- [x] Per-user event evaluation (aggregate + dedup configs across bound devices)
- [x] Cross-device delivery + catch-up pull for devices that bind later
- [x] Hybrid auth: anonymous devices keep device-scoped flow
- [x] sendPushForUser (push to every bound device)
```

- [ ] **Step 4: Commit checkpoint**

```bash
git add -A
git commit -m "Checkpoint: v4.0: user-scoped notifications — device binding, per-user event evaluation, cross-device delivery via delivery junction, hybrid auth. TypeScript: 0 errors."
```

- [ ] **Step 5: Push**

```bash
git push
```