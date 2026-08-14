# Server-Side Notification Scheduling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move notification _detection_ (price drops, restocks, date reminders) to the server, which evaluates each device's alert config against warmed prices and queues events; the client pulls pending events on launch/foreground and shows them as local notifications.

**Architecture:** Anonymous device ID keys everything. Client uploads its alert config (alerts/stock-watches/date-reminders) to the server via a public tRPC endpoint. The server's warmer tick calls `evaluateNotifications()`, comparing configs against warmed prices/cached stock status/reminder dates, and queues `notification_events` rows (deduped). Client pulls undelivered events, renders them as local `expo-notifications`, and reconciles local state. DB + memory `Map` fallback (matching `price-insights.ts`).

**Tech Stack:** Express + tRPC v11 + Drizzle (MySQL), Expo/React Native, vitest. Existing patterns: `server/price-insights.ts` (DB+memory cache), `server/product-images.ts` (single-flight + cache), `lib/server-images.ts` (client helper with timeout), `lib/notifications.ts` (local notification scheduling).

---

### Task 1: Drizzle tables — `device_notification_configs` + `notification_events`

**Files:**

- Modify: `drizzle/schema.ts` (append after `productImages`)
- Create: `drizzle/0006_*.sql` (generated)

- [ ] **Step 1: Add the two tables to `drizzle/schema.ts`**

Append after the `InsertProductImagesRow` type (line 146):

```ts
export const deviceNotificationConfigs = mysqlTable(
  "device_notification_configs",
  {
    deviceId: varchar("deviceId", { length: 128 }).notNull().primaryKey(),
    alerts: json("alerts"),
    stockWatches: json("stockWatches"),
    dateReminders: json("dateReminders"),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  },
);

export type DeviceNotificationConfigRow =
  typeof deviceNotificationConfigs.$inferSelect;
export type InsertDeviceNotificationConfigRow =
  typeof deviceNotificationConfigs.$inferInsert;

export const notificationEvents = mysqlTable("notification_events", {
  id: varchar("id", { length: 128 }).notNull().primaryKey(),
  deviceId: varchar("deviceId", { length: 128 }).notNull(),
  type: varchar("type", { length: 16 }).notNull(),
  dedupKey: varchar("dedupKey", { length: 255 }).notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  payload: json("payload"),
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  deliveredAt: bigint("deliveredAt", { mode: "number" }),
});

export type NotificationEventRow = typeof notificationEvents.$inferSelect;
export type InsertNotificationEventRow = typeof notificationEvents.$inferInsert;
```

All imports (`varchar`, `json`, `bigint`, `text`, `mysqlTable`) are already present.

- [ ] **Step 2: Generate the migration**

Run: `DATABASE_URL="mysql://localhost:3306/product_stock_finder" pnpm exec drizzle-kit generate`
Expected: writes `drizzle/0006_*.sql` with two `CREATE TABLE` statements (`device_notification_configs`, `notification_events`) plus updated `drizzle/meta/_journal.json` and `drizzle/meta/0006_snapshot.json`. This command only reads `drizzle/schema.ts` and writes SQL — it does not connect to a live DB. If it fails because a DB connection is attempted, check whether a migration file was still written; if not, write the migration manually to match the existing `drizzle/0005_*.sql` style.

- [ ] **Step 3: Verify types**

Run: `pnpm check`
Expected: PASS (0 errors).

- [ ] **Step 4: Commit**

```bash
git add drizzle/schema.ts drizzle/0006_*.sql drizzle/meta/
git commit -m "feat(sync): add notification config and event tables"
```

---

### Task 2: Server module — `server/notifications.ts`

**Files:**

- Create: `server/notifications.ts`
- Test: `tests/notifications.test.ts`

This module owns config upsert, event evaluation, and event pull. Mirrors `price-insights.ts` (DB + memory `Map` fallback). Types:

```ts
export interface NotificationConfig {
  alerts: Array<{
    id: string;
    productId: string;
    targetPrice: number;
    currency: string;
    distributorId?: string;
  }>;
  stockWatches: Array<{ id: string; productId: string; distributorId: string }>;
  dateReminders: Array<{
    id: string;
    productId: string;
    distributorId: string;
    reminderDate: string;
  }>;
}

export interface NotificationEvent {
  id: string;
  type: "price_drop" | "restock" | "reminder";
  title: string;
  body: string;
  alertId?: string;
  watchId?: string;
  reminderId?: string;
  productId: string;
  distributorId?: string;
  targetPrice?: number;
  currency?: string;
  triggeredPrice?: number;
  createdAt: number;
}
```

- [ ] **Step 1: Write the failing tests**

Create `tests/notifications.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../server/price-cache", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../server/price-cache")>();
  return { ...actual };
});

import {
  upsertDeviceConfig,
  evaluateNotifications,
  pullPendingEvents,
  clearNotificationsForTests,
  type NotificationConfig,
} from "../server/notifications";
import { setCachedPrice } from "../server/price-cache";

const baseConfig: NotificationConfig = {
  alerts: [],
  stockWatches: [],
  dateReminders: [],
};

describe("upsertDeviceConfig", () => {
  beforeEach(() => clearNotificationsForTests());

  it("stores a config for a device", async () => {
    const config: NotificationConfig = {
      ...baseConfig,
      alerts: [
        {
          id: "a1",
          productId: "mikrotik-crs804-4ddq-hrm",
          targetPrice: 500,
          currency: "USD",
        },
      ],
    };
    await upsertDeviceConfig("dev-1", config);
    const events = await pullPendingEvents("dev-1");
    expect(events).toEqual([]);
  });
});

describe("evaluateNotifications", () => {
  beforeEach(() => {
    clearNotificationsForTests();
    vi.clearAllMocks();
  });

  it("queues a price_drop event when the best price is below target", async () => {
    await setCachedPrice("server2u-my", "CRS804-4DDQ-hRM", {
      price: 480,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://example.com",
      fetchedAt: Date.now(),
    });
    await upsertDeviceConfig("dev-1", {
      ...baseConfig,
      alerts: [
        {
          id: "a1",
          productId: "mikrotik-crs804-4ddq-hrm",
          targetPrice: 500,
          currency: "USD",
        },
      ],
    });
    await evaluateNotifications(Date.now());
    const events = await pullPendingEvents("dev-1");
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe("price_drop");
    expect(events[0]!.alertId).toBe("a1");
    expect(events[0]!.triggeredPrice).toBe(480);
  });

  it("does not queue a price_drop event when the price is above target", async () => {
    await setCachedPrice("server2u-my", "CRS804-4DDQ-hRM", {
      price: 600,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://example.com",
      fetchedAt: Date.now(),
    });
    await upsertDeviceConfig("dev-1", {
      ...baseConfig,
      alerts: [
        {
          id: "a1",
          productId: "mikrotik-crs804-4ddq-hrm",
          targetPrice: 500,
          currency: "USD",
        },
      ],
    });
    await evaluateNotifications(Date.now());
    const events = await pullPendingEvents("dev-1");
    expect(events).toEqual([]);
  });

  it("queues a restock event when the distributor is in stock", async () => {
    await setCachedPrice("server2u-my", "CRS804-4DDQ-hRM", {
      price: 520,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://example.com",
      fetchedAt: Date.now(),
    });
    await upsertDeviceConfig("dev-1", {
      ...baseConfig,
      stockWatches: [
        {
          id: "w1",
          productId: "mikrotik-crs804-4ddq-hrm",
          distributorId: "server2u-my",
        },
      ],
    });
    await evaluateNotifications(Date.now());
    const events = await pullPendingEvents("dev-1");
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe("restock");
    expect(events[0]!.watchId).toBe("w1");
  });

  it("queues a reminder event when the date has passed", async () => {
    await upsertDeviceConfig("dev-1", {
      ...baseConfig,
      dateReminders: [
        {
          id: "r1",
          productId: "mikrotik-crs804-4ddq-hrm",
          distributorId: "server2u-my",
          reminderDate: new Date(
            Date.now() - 24 * 60 * 60 * 1000,
          ).toISOString(),
        },
      ],
    });
    await evaluateNotifications(Date.now());
    const events = await pullPendingEvents("dev-1");
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe("reminder");
    expect(events[0]!.reminderId).toBe("r1");
  });

  it("does not re-queue an undelivered event with the same dedup key", async () => {
    await setCachedPrice("server2u-my", "CRS804-4DDQ-hRM", {
      price: 480,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://example.com",
      fetchedAt: Date.now(),
    });
    await upsertDeviceConfig("dev-1", {
      ...baseConfig,
      alerts: [
        {
          id: "a1",
          productId: "mikrotik-crs804-4ddq-hrm",
          targetPrice: 500,
          currency: "USD",
        },
      ],
    });
    await evaluateNotifications(Date.now());
    await evaluateNotifications(Date.now());
    const events = await pullPendingEvents("dev-1");
    expect(events).toHaveLength(1);
  });

  it("does not queue a price_drop for an unknown product", async () => {
    await upsertDeviceConfig("dev-1", {
      ...baseConfig,
      alerts: [
        {
          id: "a1",
          productId: "unknown-product",
          targetPrice: 100,
          currency: "USD",
        },
      ],
    });
    await evaluateNotifications(Date.now());
    const events = await pullPendingEvents("dev-1");
    expect(events).toEqual([]);
  });
});

describe("pullPendingEvents", () => {
  beforeEach(() => clearNotificationsForTests());

  it("marks events as delivered after pulling", async () => {
    await setCachedPrice("server2u-my", "CRS804-4DDQ-hRM", {
      price: 480,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://example.com",
      fetchedAt: Date.now(),
    });
    await upsertDeviceConfig("dev-1", {
      ...baseConfig,
      alerts: [
        {
          id: "a1",
          productId: "mikrotik-crs804-4ddq-hrm",
          targetPrice: 500,
          currency: "USD",
        },
      ],
    });
    await evaluateNotifications(Date.now());
    const first = await pullPendingEvents("dev-1");
    expect(first).toHaveLength(1);
    const second = await pullPendingEvents("dev-1");
    expect(second).toEqual([]);
  });

  it("returns only events for the requested device", async () => {
    await setCachedPrice("server2u-my", "CRS804-4DDQ-hRM", {
      price: 480,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://example.com",
      fetchedAt: Date.now(),
    });
    await upsertDeviceConfig("dev-1", {
      ...baseConfig,
      alerts: [
        {
          id: "a1",
          productId: "mikrotik-crs804-4ddq-hrm",
          targetPrice: 500,
          currency: "USD",
        },
      ],
    });
    await upsertDeviceConfig("dev-2", {
      ...baseConfig,
      alerts: [
        {
          id: "a2",
          productId: "mikrotik-crs804-4ddq-hrm",
          targetPrice: 500,
          currency: "USD",
        },
      ],
    });
    await evaluateNotifications(Date.now());
    const dev1 = await pullPendingEvents("dev-1");
    const dev2 = await pullPendingEvents("dev-2");
    expect(dev1).toHaveLength(1);
    expect(dev2).toHaveLength(1);
    expect(dev1[0]!.alertId).toBe("a1");
    expect(dev2[0]!.alertId).toBe("a2");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run tests/notifications.test.ts`
Expected: FAIL with "Cannot find module '../server/notifications'".

- [ ] **Step 3: Write `server/notifications.ts`**

Create `server/notifications.ts`:

```ts
import { and, eq, isNull } from "drizzle-orm";
import {
  deviceNotificationConfigs,
  notificationEvents,
  type InsertNotificationEventRow,
} from "../drizzle/schema";
import { PRODUCT_CATALOG } from "../lib/catalog";
import { getDistributorById } from "../lib/distributors";
import { getAllParserIds } from "../lib/scrapers/registry";
import { getCachedPrice } from "./price-cache";
import { getDb } from "./db";
import { convertPrice, formatPrice } from "../lib/currency";

export interface NotificationConfig {
  alerts: Array<{
    id: string;
    productId: string;
    targetPrice: number;
    currency: string;
    distributorId?: string;
  }>;
  stockWatches: Array<{ id: string; productId: string; distributorId: string }>;
  dateReminders: Array<{
    id: string;
    productId: string;
    distributorId: string;
    reminderDate: string;
  }>;
}

export interface NotificationEvent {
  id: string;
  type: "price_drop" | "restock" | "reminder";
  title: string;
  body: string;
  alertId?: string;
  watchId?: string;
  reminderId?: string;
  productId: string;
  distributorId?: string;
  targetPrice?: number;
  currency?: string;
  triggeredPrice?: number;
  createdAt: number;
}

const memoryConfigs = new Map<string, NotificationConfig>();
const memoryEvents = new Map<string, NotificationEvent[]>();

interface EventDraft extends Omit<InsertNotificationEventRow, "deviceId"> {
  dedupKey: string;
}

function newEventId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function upsertDeviceConfig(
  deviceId: string,
  config: NotificationConfig,
): Promise<void> {
  const db = await getDb();
  if (!db) {
    memoryConfigs.set(deviceId, config);
    return;
  }
  await db
    .insert(deviceNotificationConfigs)
    .values({
      deviceId,
      alerts: config.alerts,
      stockWatches: config.stockWatches,
      dateReminders: config.dateReminders,
      updatedAt: Date.now(),
    })
    .onDuplicateKeyUpdate({
      set: {
        alerts: config.alerts,
        stockWatches: config.stockWatches,
        dateReminders: config.dateReminders,
        updatedAt: Date.now(),
      },
    });
}

export async function evaluateNotifications(now: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    for (const [deviceId, config] of memoryConfigs) {
      await evaluateConfig(deviceId, config, now);
    }
    return;
  }
  const rows = await db.select().from(deviceNotificationConfigs);
  for (const row of rows) {
    const config: NotificationConfig = {
      alerts: (row.alerts as NotificationConfig["alerts"]) ?? [],
      stockWatches:
        (row.stockWatches as NotificationConfig["stockWatches"]) ?? [],
      dateReminders:
        (row.dateReminders as NotificationConfig["dateReminders"]) ?? [],
    };
    const existing = await db
      .select({ dedupKey: notificationEvents.dedupKey })
      .from(notificationEvents)
      .where(
        and(
          eq(notificationEvents.deviceId, row.deviceId),
          isNull(notificationEvents.deliveredAt),
        ),
      );
    const undelivered = new Set(existing.map((e) => e.dedupKey));
    const drafts = await buildEvents(config, now);
    const toInsert = drafts
      .filter((d) => !undelivered.has(d.dedupKey))
      .map((d) => ({ ...d, deviceId: row.deviceId }));
    if (toInsert.length > 0)
      await db.insert(notificationEvents).values(toInsert);
  }
}

async function evaluateConfig(
  deviceId: string,
  config: NotificationConfig,
  now: number,
): Promise<void> {
  const undelivered = new Set(
    (memoryEvents.get(deviceId) ?? []).map((e) => dedupKeyFor(e)),
  );
  const drafts = await buildEvents(config, now);
  const list = memoryEvents.get(deviceId) ?? [];
  for (const draft of drafts) {
    if (undelivered.has(draft.dedupKey)) continue;
    list.push(draftToEvent(draft, deviceId));
  }
  memoryEvents.set(deviceId, list);
}

function dedupKeyFor(event: NotificationEvent): string {
  if (event.type === "price_drop") return `price_drop:${event.alertId}`;
  if (event.type === "restock")
    return `restock:${event.productId}:${event.distributorId}`;
  return `reminder:${event.reminderId}`;
}

async function buildEvents(
  config: NotificationConfig,
  now: number,
): Promise<EventDraft[]> {
  const events: EventDraft[] = [];

  for (const alert of config.alerts) {
    const product = PRODUCT_CATALOG.find((p) => p.id === alert.productId);
    if (!product) continue;
    const distributorIds = alert.distributorId
      ? [alert.distributorId]
      : getAllParserIds();
    let bestPrice: number | null = null;
    let bestDistributor: string | null = null;
    for (const distributorId of distributorIds) {
      const snapshot = await getCachedPrice(distributorId, product.modelNumber);
      if (!snapshot || snapshot.stockStatus !== "in_stock") continue;
      const converted = convertPrice(
        snapshot.price,
        snapshot.currency,
        alert.currency,
      );
      if (bestPrice === null || converted < bestPrice) {
        bestPrice = converted;
        bestDistributor = distributorId;
      }
    }
    if (bestPrice === null || bestPrice > alert.targetPrice) continue;
    events.push({
      id: newEventId(),
      type: "price_drop",
      dedupKey: `price_drop:${alert.id}`,
      title: "💸 Price Drop Alert!",
      body: `${product.name} is now ${formatPrice(bestPrice, alert.currency)} — below your target of ${formatPrice(alert.targetPrice, alert.currency)}!`,
      payload: {
        alertId: alert.id,
        productId: alert.productId,
        distributorId: bestDistributor,
        targetPrice: alert.targetPrice,
        currency: alert.currency,
        triggeredPrice: bestPrice,
      },
      createdAt: now,
      deliveredAt: null,
    });
  }

  for (const watch of config.stockWatches) {
    const product = PRODUCT_CATALOG.find((p) => p.id === watch.productId);
    if (!product) continue;
    const snapshot = await getCachedPrice(
      watch.distributorId,
      product.modelNumber,
    );
    if (!snapshot || snapshot.stockStatus !== "in_stock") continue;
    const distributorName =
      getDistributorById(watch.distributorId)?.name ?? watch.distributorId;
    events.push({
      id: newEventId(),
      type: "restock",
      dedupKey: `restock:${watch.productId}:${watch.distributorId}`,
      title: "🟢 Back In Stock!",
      body: `${product.name} is now available at ${distributorName}.`,
      payload: {
        watchId: watch.id,
        productId: watch.productId,
        distributorId: watch.distributorId,
      },
      createdAt: now,
      deliveredAt: null,
    });
  }

  for (const reminder of config.dateReminders) {
    const product = PRODUCT_CATALOG.find((p) => p.id === reminder.productId);
    if (!product) continue;
    if (now < new Date(reminder.reminderDate).getTime()) continue;
    const distributorName =
      getDistributorById(reminder.distributorId)?.name ??
      reminder.distributorId;
    events.push({
      id: newEventId(),
      type: "reminder",
      dedupKey: `reminder:${reminder.id}`,
      title: "📦 Back-Order Reminder",
      body: `Check ${distributorName} for ${product.name} — your reminder date is here!`,
      payload: {
        reminderId: reminder.id,
        productId: reminder.productId,
        distributorId: reminder.distributorId,
      },
      createdAt: now,
      deliveredAt: null,
    });
  }

  return events;
}

export async function pullPendingEvents(
  deviceId: string,
): Promise<NotificationEvent[]> {
  const db = await getDb();
  if (!db) {
    const list = memoryEvents.get(deviceId) ?? [];
    memoryEvents.set(deviceId, []);
    return list;
  }
  const rows = await db
    .select()
    .from(notificationEvents)
    .where(
      and(
        eq(notificationEvents.deviceId, deviceId),
        isNull(notificationEvents.deliveredAt),
      ),
    );
  if (rows.length > 0) {
    await db
      .update(notificationEvents)
      .set({ deliveredAt: Date.now() })
      .where(
        and(
          eq(notificationEvents.deviceId, deviceId),
          isNull(notificationEvents.deliveredAt),
        ),
      );
  }
  return rows.map(rowToEvent);
}

export function clearNotificationsForTests(): void {
  memoryConfigs.clear();
  memoryEvents.clear();
}

function draftToEvent(draft: EventDraft, deviceId: string): NotificationEvent {
  const payload = (draft.payload ?? {}) as Record<string, unknown>;
  return {
    id: draft.id,
    type: draft.type as NotificationEvent["type"],
    title: draft.title,
    body: draft.body,
    alertId: payload.alertId as string | undefined,
    watchId: payload.watchId as string | undefined,
    reminderId: payload.reminderId as string | undefined,
    productId: payload.productId as string,
    distributorId: payload.distributorId as string | undefined,
    targetPrice: payload.targetPrice as number | undefined,
    currency: payload.currency as string | undefined,
    triggeredPrice: payload.triggeredPrice as number | undefined,
    createdAt: draft.createdAt,
  };
}

function rowToEvent(row: {
  id: string;
  type: string;
  title: string;
  body: string;
  payload: unknown;
  createdAt: number;
}): NotificationEvent {
  const payload = (row.payload ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    type: row.type as NotificationEvent["type"],
    title: row.title,
    body: row.body,
    alertId: payload.alertId as string | undefined,
    watchId: payload.watchId as string | undefined,
    reminderId: payload.reminderId as string | undefined,
    productId: payload.productId as string,
    distributorId: payload.distributorId as string | undefined,
    targetPrice: payload.targetPrice as number | undefined,
    currency: payload.currency as string | undefined,
    triggeredPrice: payload.triggeredPrice as number | undefined,
    createdAt: row.createdAt,
  };
}
```

> **Note:** `buildEvents` is `async` (it awaits `getCachedPrice` inside the loops) and returns `EventDraft[]`. Both `evaluateNotifications` branches and `evaluateConfig` `await` it. `deviceId` is threaded into inserted rows in the DB path (`{ ...d, deviceId: row.deviceId }`) and into `draftToEvent` in the memory path. `newEventId()` falls back to a `Math.random()` id when `crypto.randomUUID` is unavailable. Verify with `pnpm check` before committing.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/notifications.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Verify types**

Run: `pnpm check`
Expected: PASS (0 errors).

- [ ] **Step 6: Commit**

```bash
git add server/notifications.ts tests/notifications.test.ts
git commit -m "feat(server): add notification config, evaluation, and event pull"
```

---

### Task 3: tRPC router — `notifications.uploadConfig` + `notifications.pull`

**Files:**

- Modify: `server/routers.ts`
- Test: `tests/notifications-router.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/notifications-router.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

vi.mock("../server/notifications", () => ({
  upsertDeviceConfig: vi.fn(),
  evaluateNotifications: vi.fn(),
  pullPendingEvents: vi.fn(),
  clearNotificationsForTests: vi.fn(),
}));

import { upsertDeviceConfig, pullPendingEvents } from "../server/notifications";

const mockedUpsert = vi.mocked(upsertDeviceConfig);
const mockedPull = vi.mocked(pullPendingEvents);

function createPublicContext(): TrpcContext {
  return {
    user: null,
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

describe("notifications router", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uploads a device config", async () => {
    mockedUpsert.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.notifications.uploadConfig({
      deviceId: "dev-1",
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
    });
    expect(result).toEqual({ accepted: true });
    expect(mockedUpsert).toHaveBeenCalledTimes(1);
  });

  it("pulls pending events", async () => {
    mockedPull.mockResolvedValue([
      {
        id: "e1",
        type: "price_drop",
        title: "💸 Price Drop Alert!",
        body: "MikroTik CRS804-4DDQ-hRM is now $480.00 — below your target of $500.00!",
        alertId: "a1",
        productId: "mikrotik-crs804-4ddq-hrm",
        triggeredPrice: 480,
        createdAt: 123,
      },
    ]);
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.notifications.pull({ deviceId: "dev-1" });
    expect(result.events).toHaveLength(1);
    expect(result.events[0]!.alertId).toBe("a1");
    expect(mockedPull).toHaveBeenCalledWith("dev-1");
  });

  it("works without authentication (public procedure)", async () => {
    mockedPull.mockResolvedValue([]);
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.notifications.pull({ deviceId: "x" })).resolves.toEqual(
      {
        events: [],
      },
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run tests/notifications-router.test.ts`
Expected: FAIL with `No procedure found on path "notifications,uploadConfig"`.

- [ ] **Step 3: Add the router to `server/routers.ts`**

Add the import (after the `getProductImage` import, line 16):

```ts
import { upsertDeviceConfig, pullPendingEvents } from "./notifications";
```

Add the `notifications` router to `appRouter` (after the `images` router block, before the closing `});`):

```ts
  notifications: router({
    uploadConfig: publicProcedure
      .input(
        z.object({
          deviceId: z.string().min(1),
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
      .mutation(async ({ input }) => {
        await upsertDeviceConfig(input.deviceId, {
          alerts: input.alerts,
          stockWatches: input.stockWatches,
          dateReminders: input.dateReminders,
        });
        return { accepted: true } as const;
      }),
    pull: publicProcedure
      .input(z.object({ deviceId: z.string().min(1) }))
      .query(async ({ input }) => {
        const events = await pullPendingEvents(input.deviceId);
        return { events };
      }),
  }),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/notifications-router.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Verify types + related suites**

Run: `pnpm check`
Expected: PASS.

Run: `pnpm exec vitest run tests/notifications-router.test.ts tests/notifications.test.ts tests/images-router.test.ts tests/insights-router.test.ts`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add server/routers.ts tests/notifications-router.test.ts
git commit -m "feat(server): add public notifications.uploadConfig and notifications.pull endpoints"
```

---

### Task 4: Warmer tick calls `evaluateNotifications`

**Files:**

- Modify: `server/prices.ts`
- Modify: `tests/prices.test.ts`

> **Note:** `startWarmer` returns a no-op in test env (`NODE_ENV === "test"`, see `tests/warmer.test.ts:79-83`), so the tick body must be extracted into an exported `runWarmerTick()` function that the interval calls — this makes it directly testable.

- [ ] **Step 1: Update the failing test in `tests/prices.test.ts`**

Read `tests/prices.test.ts` first. It already mocks `../server/product-images`. Add a mock for `../server/notifications` (near the other `vi.mock` calls):

```ts
vi.mock("../server/notifications", () => ({
  upsertDeviceConfig: vi.fn(),
  evaluateNotifications: vi.fn(),
  pullPendingEvents: vi.fn(),
  clearNotificationsForTests: vi.fn(),
}));
```

Add `runWarmerTick` to the `../server/prices` import. Current (after Task 4 of Phase 31):

```ts
import {
  getPrice,
  PRICE_TTL_MS,
  warmCatalogRotation,
  warmProductImages,
} from "../server/prices";
```

Change to add `runWarmerTick`:

```ts
import {
  getPrice,
  PRICE_TTL_MS,
  warmCatalogRotation,
  warmProductImages,
  runWarmerTick,
} from "../server/prices";
```

Add a new `describe` block at the end of the file:

```ts
describe("runWarmerTick", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls evaluateNotifications", async () => {
    const { evaluateNotifications } = await import("../server/notifications");
    const mockedEvaluate = vi.mocked(evaluateNotifications);
    await runWarmerTick();
    expect(mockedEvaluate).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run tests/prices.test.ts`
Expected: FAIL — `runWarmerTick` is not exported from `../server/prices`.

- [ ] **Step 3: Modify `server/prices.ts`**

Add the import (after the `./product-images` import, line 12):

```ts
import { evaluateNotifications } from "./notifications";
```

Extract the tick body into an exported function. Replace the current `startWarmer` (lines 109-124):

```ts
export async function runWarmerTick(): Promise<void> {
  await refreshNearExpiry(Date.now());
  await warmCatalogRotation(CATALOG_WARM_PER_TICK);
  await warmProductImages(IMAGES_PER_TICK);
  await evaluateNotifications(Date.now());
  await purgeOldHistory(Date.now());
}

let warmerTimer: ReturnType<typeof setInterval> | null = null;

export function startWarmer(opts?: { intervalMs?: number }): () => void {
  const intervalMs = opts?.intervalMs ?? WARMER_INTERVAL_MS;
  if (process.env.NODE_ENV === "test") return () => {};
  if (warmerTimer) return () => {};
  warmerTimer = setInterval(() => {
    void runWarmerTick();
  }, intervalMs);
  return () => {
    if (warmerTimer) clearInterval(warmerTimer);
    warmerTimer = null;
  };
}
```

> **Note:** `runWarmerTick` awaits each step sequentially. This changes the previous behavior (the old tick fired each step with `void` without awaiting). The sequential version is intentional — it ensures `evaluateNotifications` runs after prices are warmed in the same tick. Verify `pnpm check` passes.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/prices.test.ts tests/warmer.test.ts`
Expected: PASS (all tests, including the new `runWarmerTick` test and the existing `startWarmer` no-op test).

- [ ] **Step 5: Verify types + related suites**

Run: `pnpm check`
Expected: PASS.

Run: `pnpm exec vitest run tests/prices.test.ts tests/warmer.test.ts tests/notifications.test.ts`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add server/prices.ts tests/prices.test.ts
git commit -m "feat(server): evaluate notification configs in the warmer tick"
```

---

### Task 5: Client device ID — `lib/device-id.ts`

**Files:**

- Create: `lib/device-id.ts`
- Test: `tests/device-id.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/device-id.test.ts`:

```ts
import { describe, expect, it, beforeEach } from "vitest";

const store = new Map<string, string>();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
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
  },
}));

import { getDeviceId } from "../lib/device-id";

describe("getDeviceId", () => {
  beforeEach(() => store.clear());

  it("generates and persists an id on first call", async () => {
    const id = await getDeviceId();
    expect(id.length).toBeGreaterThan(0);
    expect(store.get("device_id")).toBe(id);
  });

  it("returns the same id on subsequent calls", async () => {
    const first = await getDeviceId();
    const second = await getDeviceId();
    expect(second).toBe(first);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run tests/device-id.test.ts`
Expected: FAIL with "Cannot find module '../lib/device-id'".

- [ ] **Step 3: Write `lib/device-id.ts`**

Create `lib/device-id.ts`:

```ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const DEVICE_ID_KEY = "device_id";

export async function getDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const id = generateId();
  await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

function generateId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/device-id.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Verify types**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/device-id.ts tests/device-id.test.ts
git commit -m "feat(mobile): add anonymous device id helper"
```

---

### Task 6: Client helper — `lib/server-notifications.ts`

**Files:**

- Create: `lib/server-notifications.ts`
- Test: `tests/server-notifications.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/server-notifications.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("../lib/trpc", () => ({
  createTRPCClient: vi.fn(),
}));

import { createTRPCClient } from "../lib/trpc";
import {
  uploadNotificationConfig,
  pullNotificationEvents,
} from "../lib/server-notifications";

const mockedCreateClient = vi.mocked(createTRPCClient);

function mockClient(handlers: {
  uploadConfig?: () => Promise<{ accepted: boolean }>;
  pull?: () => Promise<{ events: unknown[] }>;
}) {
  mockedCreateClient.mockReturnValue({
    notifications: {
      uploadConfig: { mutate: handlers.uploadConfig },
      pull: { query: handlers.pull },
    },
  } as unknown as ReturnType<typeof createTRPCClient>);
}

describe("uploadNotificationConfig", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uploads the config and returns true", async () => {
    const mutate = vi.fn().mockResolvedValue({ accepted: true });
    mockClient({ uploadConfig: mutate });
    const ok = await uploadNotificationConfig("dev-1", {
      alerts: [],
      stockWatches: [],
      dateReminders: [],
    });
    expect(ok).toBe(true);
    expect(mutate).toHaveBeenCalledWith({
      deviceId: "dev-1",
      alerts: [],
      stockWatches: [],
      dateReminders: [],
    });
  });

  it("returns false when the mutate rejects", async () => {
    mockClient({
      uploadConfig: vi.fn().mockRejectedValue(new Error("network")),
    });
    const ok = await uploadNotificationConfig("dev-1", {
      alerts: [],
      stockWatches: [],
      dateReminders: [],
    });
    expect(ok).toBe(false);
  });
});

describe("pullNotificationEvents", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("returns events from the server", async () => {
    const query = vi.fn().mockResolvedValue({ events: [{ id: "e1" }] });
    mockClient({ pull: query });
    const events = await pullNotificationEvents("dev-1");
    expect(events).toEqual([{ id: "e1" }]);
    expect(query).toHaveBeenCalledWith({ deviceId: "dev-1" });
  });

  it("returns an empty array when the query rejects", async () => {
    mockClient({ pull: vi.fn().mockRejectedValue(new Error("network")) });
    const events = await pullNotificationEvents("dev-1");
    expect(events).toEqual([]);
  });

  it("returns an empty array when the query times out", async () => {
    mockClient({
      pull: vi
        .fn()
        .mockImplementation(
          () =>
            new Promise<{ events: unknown[] }>((resolve) =>
              setTimeout(() => resolve({ events: [] }), 10_000),
            ),
        ),
    });
    const events = await pullNotificationEvents("dev-1");
    expect(events).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run tests/server-notifications.test.ts`
Expected: FAIL with "Cannot find module '../lib/server-notifications'".

- [ ] **Step 3: Write `lib/server-notifications.ts`**

Create `lib/server-notifications.ts`:

```ts
import { createTRPCClient } from "./trpc";
import type {
  NotificationConfig,
  NotificationEvent,
} from "../server/notifications";

const TIMEOUT_MS = 4000;

export async function uploadNotificationConfig(
  deviceId: string,
  config: NotificationConfig,
): Promise<boolean> {
  try {
    const client = createTRPCClient();
    await Promise.race([
      client.notifications.uploadConfig.mutate({ deviceId, ...config }),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), TIMEOUT_MS),
      ),
    ]);
    return true;
  } catch {
    return false;
  }
}

export async function pullNotificationEvents(
  deviceId: string,
): Promise<NotificationEvent[]> {
  try {
    const client = createTRPCClient();
    const result = await Promise.race([
      client.notifications.pull.query({ deviceId }),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), TIMEOUT_MS),
      ),
    ]);
    return result?.events ?? [];
  } catch {
    return [];
  }
}
```

> **Note:** `NotificationConfig` and `NotificationEvent` are exported from `server/notifications.ts` (Task 2). Importing types from the server module into the client is the established pattern (`lib/server-prices.ts` imports `ServerPriceResult` from `lib/types.ts`; `lib/trpc.ts` imports `AppRouter` from `@/server/routers`). If `pnpm check` complains about importing from `../server/notifications` (e.g. because it pulls in server-only deps), instead define the two interfaces locally in `lib/server-notifications.ts` (duplicating the shapes) and drop the import. Verify with `pnpm check`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/server-notifications.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Verify types + related suites**

Run: `pnpm check`
Expected: PASS.

Run: `pnpm exec vitest run tests/server-notifications.test.ts tests/server-images.test.ts tests/server-insights.test.ts`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/server-notifications.ts tests/server-notifications.test.ts
git commit -m "feat(mobile): add notification config upload and event pull helpers"
```

---

### Task 7: Local notification helper + launch/foreground wiring

**Files:**

- Modify: `lib/notifications.ts`
- Modify: `app/_layout.tsx`
- Modify: `lib/background-price-check.ts`

- [ ] **Step 1: Add `scheduleServerEventNotification` to `lib/notifications.ts`**

Add after `sendPriceDigestNotification` (line 185):

```ts
// ─── Show a server-queued notification event locally ─────────────────────────
export async function scheduleServerEventNotification(
  title: string,
  body: string,
): Promise<void> {
  if (Platform.OS === "web") return;
  const granted = await requestNotificationPermissions();
  if (!granted) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: "default" },
      trigger: null, // immediate
    });
  } catch {
    // server event failures are non-fatal
  }
}
```

- [ ] **Step 2: Add the sync helper to `lib/server-notifications.ts`**

Append to `lib/server-notifications.ts`:

```ts
export async function syncServerNotifications(): Promise<void> {
  try {
    const { getDeviceId } = await import("./device-id");
    const { getAlerts, getStockWatches, getBackOrderReminders } =
      await import("./storage");
    const { scheduleServerEventNotification } = await import("./notifications");
    const deviceId = await getDeviceId();

    const alerts = await getAlerts();
    const activeAlerts = alerts
      .filter((a) => a.isActive && !a.triggeredAt)
      .map((a) => ({
        id: a.id,
        productId: a.productId,
        targetPrice: a.targetPrice,
        currency: a.currency,
        distributorId: a.distributorId,
      }));

    const stockWatches = (await getStockWatches()).map((w) => ({
      id: w.id,
      productId: w.productId,
      distributorId: w.distributorId,
    }));

    const dateReminders = (await getBackOrderReminders())
      .filter((r) => r.reminderType === "date")
      .map((r) => ({
        id: r.id,
        productId: r.productId,
        distributorId: r.distributorId,
        reminderDate: r.reminderDate,
      }));

    await uploadNotificationConfig(deviceId, {
      alerts: activeAlerts,
      stockWatches,
      dateReminders,
    });

    const events = await pullNotificationEvents(deviceId);
    for (const event of events) {
      await scheduleServerEventNotification(event.title, event.body);
      await reconcileEvent(event);
    }
  } catch {
    // server notification sync is best-effort
  }
}

async function reconcileEvent(event: {
  type: string;
  alertId?: string;
  watchId?: string;
  triggeredPrice?: number;
}): Promise<void> {
  const { deactivateAlert, removeStockWatch } = await import("./storage");
  if (event.type === "price_drop" && event.alertId) {
    await deactivateAlert(event.alertId, event.triggeredPrice ?? 0);
  }
  if (event.type === "restock" && event.watchId) {
    await removeStockWatch(event.watchId);
  }
}
```

> **Note:** `deactivateAlert(alertId, triggeredPrice)` and `removeStockWatch(watchId)` are the mutex-protected storage helpers (confirmed in `lib/storage.ts` lines 201-214 and 310-316) — use them instead of raw `saveAlerts`/`saveStockWatches` so reconciliation respects the storage write lock. The `syncServerNotifications` helper uses dynamic `import()` for storage/notifications/device-id to keep module-level imports clean and avoid circular imports.

- [ ] **Step 3: Wire into `app/_layout.tsx` launch**

Add the import (after the `backfillLocalHistory` import, line 44):

```ts
import { syncServerNotifications } from "@/lib/server-notifications";
```

In the notification-permission effect (lines 73-86), after `checkPriceDropsNow()` (line 84), add:

```ts
// Pull any server-queued notification events
void syncServerNotifications();
```

- [ ] **Step 4: Wire into `lib/background-price-check.ts` foreground path**

Add the import (after the `maybeSendDigest` import, line 16):

```ts
import { syncServerNotifications } from "./server-notifications";
```

In `checkPriceDropsNow`, after the alert-check loop (after line 394), add:

```ts
// Pull any server-queued notification events (server-side detection supplement)
await syncServerNotifications();
```

- [ ] **Step 5: Verify types**

Run: `pnpm check`
Expected: PASS (0 errors).

- [ ] **Step 6: Commit**

```bash
git add lib/notifications.ts lib/server-notifications.ts app/_layout.tsx lib/background-price-check.ts
git commit -m "feat(mobile): pull and display server-queued notification events on launch and foreground"
```

---

### Task 8: Final verification + checkpoint commit

**Files:**

- Whole repo
- Modify: `todo.md`

- [ ] **Step 1: Run all verification gates**

```bash
pnpm check
pnpm lint
pnpm test
pnpm check:desktop
pnpm --filter desktop test
```

And in `desktop/src-tauri`: `cargo test`

Expected: all PASS. (`pnpm lint` may emit the pre-existing `MODULE_TYPELESS_PACKAGE_JSON` warning — that's expected and not an error.)

- [ ] **Step 2: Update `todo.md`**

Append a Phase 32 entry after the Phase 31 block:

```markdown
## Phase 32: Server-Side Notification Scheduling

- [x] device_notification_configs + notification_events Drizzle tables + migration
- [x] Server notification evaluation + event queue (server/notifications.ts)
- [x] Public notifications.uploadConfig + notifications.pull tRPC endpoints
- [x] Warmer tick evaluates notification configs
- [x] Mobile anonymous device id (lib/device-id.ts)
- [x] Mobile upload/pull helpers + launch/foreground sync (lib/server-notifications.ts)
```

- [ ] **Step 3: Checkpoint commit**

```bash
git add -A
git commit -m "Checkpoint: v3.11: Server-side notification scheduling (server detects price drops/restocks/date reminders against warmed prices, queues events, mobile pulls on launch/foreground and shows local notifications). TypeScript: 0 errors."
```

Use the next version number per the repo's existing checkpoint history (current latest is v3.10).

---

## Self-Review Notes (from planning)

- **Spec coverage:** Every spec section maps to a task: two tables (T1), server module upsert/evaluate/pull (T2), router (T3), warmer tick (T4), device id (T5), client helpers (T6), local notification helper + launch/foreground wiring + reconciliation (T7), verification (T8). Out-of-scope items (push infra, desktop, auth) are untouched.
- **Type consistency:** `NotificationConfig` and `NotificationEvent` are defined in `server/notifications.ts` (T2) and reused by the router (T3) and client helper (T6). `NotificationEvent` fields (`alertId`, `watchId`, `reminderId`, `productId`, `distributorId`, `targetPrice`, `currency`, `triggeredPrice`) are consistent across the service, the router test, and the client reconciliation logic. `upsertDeviceConfig(deviceId, config)`, `evaluateNotifications(now)`, `pullPendingEvents(deviceId)` signatures are consistent across service, router, and tests.
- **Dedup keys:** `price_drop:{alertId}`, `restock:{productId}:{distributorId}`, `reminder:{reminderId}` — consistent between the spec, the service implementation, and the tests.
- **`buildEvents` is async:** It awaits `getCachedPrice` inside the loops, so it's declared `async` and both `evaluateNotifications` branches and `evaluateConfig` await it. `deviceId` is threaded into inserted rows (DB path: `{ ...d, deviceId }`) and into `draftToEvent` (memory path). `newEventId()` handles both `crypto.randomUUID` and a fallback. The plan code is complete and self-consistent — no implementer reconciliation needed.
- **Client type import:** Task 6 imports `NotificationConfig`/`NotificationEvent` from `../server/notifications`. If `pnpm check` fails (server-only deps leaking into client), define the interfaces locally in `lib/server-notifications.ts` instead. The fallback is documented in the task.
- **`deactivateAlert`/`removeStockWatch`:** Task 7 reconciliation uses these mutex-protected storage helpers (confirmed in `lib/storage.ts` lines 201-214 and 310-316) rather than raw `saveAlerts`/`saveStockWatches`.
- **`runWarmerTick`:** Task 4 extracts the warmer tick body into an exported `runWarmerTick()` because `startWarmer` is a no-op in test env. The tick now awaits steps sequentially so `evaluateNotifications` runs after prices are warmed.
- **`crypto.randomUUID()`:** The server module uses `newEventId()` with a `Math.random()` fallback; `lib/device-id.ts` (Task 5) has its own `generateId()` fallback.
