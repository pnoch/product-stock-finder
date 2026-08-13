# Push Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver price-drop/restock/reminder events immediately — mobile via Expo Push, desktop via scheduled pull + native notifications — while keeping the Phase 32 pull-based flow as a fallback.

**Architecture:** Mobile registers an Expo push token keyed by the Phase 32 anonymous device id; when the server's notification engine creates `notification_events`, it sends them via Expo's hosted push API (`expo-server-sdk`). Desktop runs a web-safe `syncDesktopNotifications` (its own tRPC client + localStorage device id) on a timer, rendering pulled events as native OS notifications via `tauri-plugin-notification`. Push is best-effort everywhere; the existing pull fallback remains the correctness guarantee.

**Tech Stack:** Drizzle (MySQL) + migration, Express/tRPC v11 server, Expo SDK 54 (`expo-notifications`, `expo-device`, `expo-constants`), `expo-server-sdk`, Tauri/React desktop (Vite, `tauri-plugin-notification`), vitest.

---

## Task 1: Drizzle table `device_push_tokens` + migration

**Files:**
- Modify: `drizzle/schema.ts` (append after the `notificationEvents` types, currently ~line 178)
- Create: `drizzle/0007_*.sql` (generated)

- [ ] **Step 1: Add the table + types to `drizzle/schema.ts`**

Append at the end of the file:

```ts
export const devicePushTokens = mysqlTable("device_push_tokens", {
  deviceId: varchar("deviceId", { length: 128 }).notNull().primaryKey(),
  token: varchar("token", { length: 255 }).notNull(),
  platform: varchar("platform", { length: 16 }).notNull(),
  updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
});

export type DevicePushTokenRow = typeof devicePushTokens.$inferSelect;
export type InsertDevicePushTokenRow = typeof devicePushTokens.$inferInsert;
```

All imports (`varchar`, `bigint`, `mysqlTable`) are already present in the file.

- [ ] **Step 2: Generate the migration**

```bash
DATABASE_URL="mysql://localhost:3306/product_stock_finder" pnpm exec drizzle-kit generate
```

Expected: writes `drizzle/0007_*.sql` with one `CREATE TABLE device_push_tokens ...` plus updated `drizzle/meta/_journal.json` and `drizzle/meta/0007_snapshot.json`. (This only reads the schema and writes SQL — no live DB connection.)

- [ ] **Step 3: Verify types**

Run: `pnpm check`
Expected: PASS (0 errors).

- [ ] **Step 4: Commit**

```bash
git add drizzle/schema.ts drizzle/0007_*.sql drizzle/meta/
git commit -m "feat(sync): add device push token table"
```

## Task 2: Server push service `server/push-notifications.ts` + tests

**Files:**
- Create: `server/push-notifications.ts`
- Test: `tests/push-notifications.test.ts`

- [ ] **Step 1: Install `expo-server-sdk`**

```bash
pnpm add expo-server-sdk
```

Expected: added to `package.json` dependencies.

- [ ] **Step 2: Write the failing test**

Create `tests/push-notifications.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => null),
}));

const sent = vi.hoisted(() => [] as unknown[]);

vi.mock("expo-server-sdk", () => ({
  Expo: class {
    static isExpoPushToken = (value: unknown) =>
      typeof value === "string" && value.startsWith("ExponentPushToken");
    chunkPushNotifications(messages: unknown[]) {
      return [messages];
    }
    async sendPushNotificationsAsync(chunk: unknown) {
      sent.push(chunk);
    }
  },
}));

import { upsertPushToken, sendPushForDevice, clearPushTokensForTests } from "../server/push-notifications";

const event = { id: "evt-1", title: "💸 Price Drop Alert!", body: "CRS804 is now $480.00!" };

describe("push-notifications", () => {
  beforeEach(() => {
    clearPushTokensForTests();
    sent.length = 0;
  });

  it("pushes events for a device that registered a token", async () => {
    await upsertPushToken("dev-1", "ExponentPushToken[abc123]", "ios");
    await sendPushForDevice("dev-1", [event]);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toEqual([
      {
        to: "ExponentPushToken[abc123]",
        title: "💸 Price Drop Alert!",
        body: "CRS804 is now $480.00!",
        data: { eventId: "evt-1" },
      },
    ]);
  });

  it("no-ops when the device has no registered token", async () => {
    await sendPushForDevice("dev-1", [event]);
    expect(sent).toHaveLength(0);
  });

  it("no-ops when the stored token is not a valid Expo push token", async () => {
    await upsertPushToken("dev-1", "not-an-expo-token", "android");
    await sendPushForDevice("dev-1", [event]);
    expect(sent).toHaveLength(0);
  });

  it("no-ops when there are no events", async () => {
    await upsertPushToken("dev-1", "ExponentPushToken[abc123]", "ios");
    await sendPushForDevice("dev-1", []);
    expect(sent).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm exec vitest run tests/push-notifications.test.ts`
Expected: FAIL with "Cannot find module '../server/push-notifications'".

- [ ] **Step 4: Write `server/push-notifications.ts`**

Create the file:

```ts
import { eq } from "drizzle-orm";
import { Expo } from "expo-server-sdk";
import { devicePushTokens } from "../drizzle/schema";
import { getDb } from "./db";

export interface PushableEvent {
  id: string;
  title: string;
  body: string;
}

const memoryTokens = new Map<string, { token: string; platform: string }>();

export async function upsertPushToken(
  deviceId: string,
  token: string,
  platform: "ios" | "android",
): Promise<void> {
  const db = await getDb();
  if (!db) {
    memoryTokens.set(deviceId, { token, platform });
    return;
  }
  await db
    .insert(devicePushTokens)
    .values({ deviceId, token, platform, updatedAt: Date.now() })
    .onDuplicateKeyUpdate({
      set: { token, platform, updatedAt: Date.now() },
    });
}

export async function sendPushForDevice(
  deviceId: string,
  events: PushableEvent[],
): Promise<void> {
  if (events.length === 0) return;
  const db = await getDb();
  let token: string | undefined;
  if (db) {
    const rows = await db
      .select({ token: devicePushTokens.token })
      .from(devicePushTokens)
      .where(eq(devicePushTokens.deviceId, deviceId));
    token = rows[0]?.token;
  } else {
    token = memoryTokens.get(deviceId)?.token;
  }
  if (!token || !Expo.isExpoPushToken(token)) return;
  try {
    const expo = new Expo({ accessToken: process.env.EXPO_PUSH_ACCESS_TOKEN });
    const messages = events.map((e) => ({
      to: token,
      title: e.title,
      body: e.body,
      data: { eventId: e.id },
    }));
    for (const chunk of expo.chunkPushNotifications(messages)) {
      await expo.sendPushNotificationsAsync(chunk);
    }
  } catch (error) {
    console.warn(`[Push] Failed to send push for device ${deviceId}:`, error);
  }
}

export function clearPushTokensForTests(): void {
  memoryTokens.clear();
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec vitest run tests/push-notifications.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Verify types**

Run: `pnpm check`
Expected: PASS (0 errors).

- [ ] **Step 7: Commit**

```bash
git add server/push-notifications.ts tests/push-notifications.test.ts package.json pnpm-lock.yaml
git commit -m "feat(server): push notification service with Expo push sending"
```

## Task 3: Wire push into the notification engine

**Files:**
- Modify: `server/notifications.ts:13` (import), `:123` (DB path), `:135-141` (memory path)
- Modify: `tests/notifications.test.ts` (add mock + one wiring test)

- [ ] **Step 1: Update the failing test mock**

In `tests/notifications.test.ts`, add a `vi.mock` for `../server/push-notifications` right after the existing `vi.mock("../server/price-cache", ...)` block (line ~6) and import the mocked `sendPushForDevice`:

```ts
vi.mock("../server/push-notifications", () => ({
  upsertPushToken: vi.fn(),
  sendPushForDevice: vi.fn(),
  clearPushTokensForTests: vi.fn(),
}));
```

Add `sendPushForDevice` to the existing `import { ... } from "../server/notifications"` — no. Instead add a separate import after it:

```ts
import { sendPushForDevice } from "../server/push-notifications";
```

Add a new test inside the `evaluateNotifications` describe (after the "queues a price_drop event when the best price is below target" test):

```ts
it("pushes newly created events to the device's channel", async () => {
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
  expect(vi.mocked(sendPushForDevice)).toHaveBeenCalledWith(
    "dev-1",
    expect.arrayContaining([expect.objectContaining({ type: "price_drop" })]),
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/notifications.test.ts`
Expected: FAIL — `expect(vi.mocked(sendPushForDevice))...` because `sendPushForDevice` is never called yet.

- [ ] **Step 3: Wire `sendPushForDevice` into `server/notifications.ts`**

Add the import after line 12 (`import { convertPrice, formatPrice } from "../lib/currency";`):

```ts
import { sendPushForDevice } from "./push-notifications";
```

Replace the DB-path insert (lines 119-123) so it pushes after inserting:

```ts
    const drafts = await buildEvents(config, now);
    const toInsert = drafts
      .filter((d) => !undelivered.has(d.dedupKey))
      .map((d) => ({ ...d, deviceId: row.deviceId }));
    if (toInsert.length > 0) {
      await db.insert(notificationEvents).values(toInsert);
      await sendPushForDevice(row.deviceId, toInsert);
    }
```

Replace the memory-path body of `evaluateConfig` (lines 127-142) so it tracks + pushes the newly added events:

```ts
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
  const added: NotificationEvent[] = [];
  for (const draft of drafts) {
    if (undelivered.has(draft.dedupKey)) continue;
    const event = draftToEvent(draft);
    list.push(event);
    added.push(event);
  }
  memoryEvents.set(deviceId, list);
  if (added.length > 0) await sendPushForDevice(deviceId, added);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/notifications.test.ts tests/push-notifications.test.ts`
Expected: PASS (11 + 4).

- [ ] **Step 5: Verify types**

Run: `pnpm check`
Expected: PASS (0 errors).

- [ ] **Step 6: Commit**

```bash
git add server/notifications.ts tests/notifications.test.ts
git commit -m "feat(server): push notification events at detection time"
```

## Task 4: `notifications.registerPushToken` router + `lastKnownStatus` schema fix

**Files:**
- Modify: `server/routers.ts:17` (import), `:123-168` (notifications router)
- Modify: `tests/notifications-router.test.ts` (add mock + tests)

> **Note — latent Phase 32 bug fixed here:** `lib/server-notifications.ts` uploads `stockWatches` entries with `lastKnownStatus`, but the router's zod schema (lines 137-143) omits it, so zod strips it and the restock transition check (`server/notifications.ts` `buildEvents`) never sees it. This task adds the field to the schema so the transition detection actually works through the upload path.

- [ ] **Step 1: Write the failing router tests**

In `tests/notifications-router.test.ts`, add a mock for `../server/push-notifications` after the existing `vi.mock("../server/notifications", ...)` block:

```ts
vi.mock("../server/push-notifications", () => ({
  upsertPushToken: vi.fn(),
}));
```

Add the import and mocked binding:

```ts
import { upsertPushToken } from "../server/push-notifications";

const mockedUpsertPush = vi.mocked(upsertPushToken);
```

Add two tests in the `notifications router` describe:

```ts
it("registers a push token for a device", async () => {
  mockedUpsertPush.mockResolvedValue(undefined);
  const caller = appRouter.createCaller(createPublicContext());
  const result = await caller.notifications.registerPushToken({
    deviceId: "dev-1",
    token: "ExponentPushToken[abc123]",
    platform: "ios",
  });
  expect(result).toEqual({ accepted: true });
  expect(mockedUpsertPush).toHaveBeenCalledWith(
    "dev-1",
    "ExponentPushToken[abc123]",
    "ios",
  );
});

it("rejects an invalid platform for registerPushToken", async () => {
  const caller = appRouter.createCaller(createPublicContext());
  await expect(
    caller.notifications.registerPushToken({
      deviceId: "dev-1",
      token: "ExponentPushToken[abc123]",
      platform: "web",
    } as never),
  ).rejects.toThrow();
  expect(mockedUpsertPush).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run tests/notifications-router.test.ts`
Expected: FAIL with `No procedure found on path "notifications,registerPushToken"`.

- [ ] **Step 3: Add the import + procedure to `server/routers.ts`**

Add to the imports (after line 17 `import { upsertDeviceConfig, pullPendingEvents } from "./notifications";`):

```ts
import { upsertPushToken } from "./push-notifications";
```

Add `lastKnownStatus` to the `stockWatches` item schema (lines 137-143), and add the `registerPushToken` procedure inside the `notifications` router after the `pull` procedure:

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
    registerPushToken: publicProcedure
      .input(
        z.object({
          deviceId: z.string().min(1).max(128),
          token: z.string().min(1).max(255),
          platform: z.enum(["ios", "android"]),
        }),
      )
      .mutation(async ({ input }) => {
        await upsertPushToken(input.deviceId, input.token, input.platform);
        return { accepted: true } as const;
      }),
  }),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/notifications-router.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Verify types + related suites**

Run: `pnpm check`
Expected: PASS.

Run: `pnpm exec vitest run tests/notifications-router.test.ts tests/notifications.test.ts tests/push-notifications.test.ts`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add server/routers.ts tests/notifications-router.test.ts
git commit -m "feat(server): add notifications.registerPushToken endpoint and preserve stock watch status"
```

## Task 5: `app.config.ts` project id + install `expo-device`

**Files:**
- Modify: `app.config.ts:40-128` (add `extra`)
- Modify: `package.json` (add `expo-device`)

- [ ] **Step 1: Install `expo-device`**

```bash
pnpm exec expo install expo-device
```

Expected: `expo-device` added to `package.json` at an SDK-54-compatible version.

- [ ] **Step 2: Add `extra.expoProjectId` to `app.config.ts`**

In `app.config.ts`, add an `extra` block to the config object (e.g., after `experiments`):

```ts
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    expoProjectId: process.env.EXPO_PUBLIC_EXPO_PROJECT_ID,
  },
```

- [ ] **Step 3: Verify types**

Run: `pnpm check`
Expected: PASS (0 errors).

- [ ] **Step 4: Commit**

```bash
git add app.config.ts package.json pnpm-lock.yaml
git commit -m "chore(mobile): expose expo project id and add expo-device"
```

## Task 6: Mobile `lib/push-token.ts` + tests

**Files:**
- Create: `lib/push-token.ts`
- Test: `tests/push-token.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/push-token.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  platform: "ios",
  isDevice: true,
  projectId: "proj-123",
  token: "ExponentPushToken[mobile]",
  mutateCalls: [] as unknown[],
}));

vi.mock("react-native", () => ({
  Platform: { get OS() { return state.platform; } },
}));

vi.mock("expo-device", () => ({
  Device: { get isDevice() { return state.isDevice; } },
}));

vi.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      get extra() { return { expoProjectId: state.projectId }; },
    },
  },
}));

vi.mock("expo-notifications", () => ({
  getExpoPushTokenAsync: vi.fn(async () => ({ data: state.token })),
}));

vi.mock("../lib/device-id", () => ({
  getDeviceId: vi.fn(async () => "dev-1"),
}));

vi.mock("../lib/trpc", () => ({
  createTRPCClient: vi.fn(() => ({
    notifications: {
      registerPushToken: {
        mutate: vi.fn(async (input: unknown) => {
          state.mutateCalls.push(input);
        }),
      },
    },
  })),
}));

import { registerPushToken } from "../lib/push-token";

describe("registerPushToken", () => {
  beforeEach(() => {
    state.platform = "ios";
    state.isDevice = true;
    state.projectId = "proj-123";
    state.mutateCalls.length = 0;
  });

  it("registers the push token on a physical device", async () => {
    await registerPushToken();
    expect(state.mutateCalls).toHaveLength(1);
    expect(state.mutateCalls[0]).toEqual({
      deviceId: "dev-1",
      token: "ExponentPushToken[mobile]",
      platform: "ios",
    });
  });

  it("skips on web", async () => {
    state.platform = "web";
    await registerPushToken();
    expect(state.mutateCalls).toHaveLength(0);
  });

  it("skips on a simulator/emulator", async () => {
    state.isDevice = false;
    await registerPushToken();
    expect(state.mutateCalls).toHaveLength(0);
  });

  it("skips when no project id is configured", async () => {
    state.projectId = undefined as unknown as string;
    await registerPushToken();
    expect(state.mutateCalls).toHaveLength(0);
  });

  it("never throws on failure", async () => {
    state.projectId = undefined as unknown as string;
    await expect(registerPushToken()).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/push-token.test.ts`
Expected: FAIL with "Cannot find module '../lib/push-token'".

- [ ] **Step 3: Write `lib/push-token.ts`**

Create the file:

```ts
import { Platform } from "react-native";
import * as Device from "expo-device";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { getDeviceId } from "./device-id";
import { createTRPCClient } from "./trpc";

const TIMEOUT_MS = 4000;

export async function registerPushToken(): Promise<void> {
  try {
    if (Platform.OS === "web") return;
    if (!Device.isDevice) return;
    const projectId = (
      Constants.expoConfig?.extra as { expoProjectId?: string } | undefined
    )?.expoProjectId;
    if (!projectId) return;
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    const deviceId = await getDeviceId();
    const client = createTRPCClient();
    await Promise.race([
      client.notifications.registerPushToken.mutate({
        deviceId,
        token: token.data,
        platform: Platform.OS as "ios" | "android",
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
    ]);
  } catch {
    // push registration is best-effort
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/push-token.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Verify types + related suites**

Run: `pnpm check`
Expected: PASS.

Run: `pnpm exec vitest run tests/push-token.test.ts tests/server-notifications.test.ts`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/push-token.ts tests/push-token.test.ts
git commit -m "feat(mobile): register expo push token on launch"
```

## Task 7: Wire `registerPushToken` into `_layout.tsx`

**Files:**
- Modify: `app/_layout.tsx:45` (import), `:85-86` (call)

- [ ] **Step 1: Add the import**

In `app/_layout.tsx`, after `import { syncServerNotifications } from "@/lib/server-notifications";` (line 45), add:

```ts
import { registerPushToken } from "@/lib/push-token";
```

- [ ] **Step 2: Add the call**

In the notification-permission effect, after `checkPriceDropsNow();` (line 85) and before `void syncServerNotifications();`, add:

```ts
      // Register for Expo push delivery (best-effort)
      void registerPushToken();
```

- [ ] **Step 3: Verify types**

Run: `pnpm check`
Expected: PASS (0 errors).

- [ ] **Step 4: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat(mobile): register push token at launch"
```

## Task 8: Desktop `syncDesktopNotifications` + test

**Files:**
- Create: `desktop/src/server-notifications.ts`
- Test: `desktop/tests/server-notifications.test.ts`

> Uses the desktop web-safe tRPC client (`desktop/src/lib/trpc.ts`) and the desktop storage instance (`desktop/src/storage.ts`). Does NOT import `lib/server-notifications.ts` (that pulls `expo-secure-store` via mobile `./trpc`).

- [ ] **Step 1: Write the failing test**

Create `desktop/tests/server-notifications.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createStorage } from "../../lib/storage";

const store = new Map<string, string>();
const localStorageAdapter = {
  getItem: async (key: string) => store.get(key) ?? null,
  setItem: async (key: string, value: string) => store.set(key, value),
  removeItem: async (key: string) => store.delete(key),
  multiRemove: async (keys: string[]) => keys.forEach((k) => store.delete(k)),
};

const storage = createStorage(localStorageAdapter);

const state = vi.hoisted(() => ({
  uploaded: [] as unknown[],
  pulled: [] as unknown[],
  notifications: [] as unknown[],
}));

vi.mock("../src/lib/trpc", () => ({
  createTRPCClient: vi.fn(() => ({
    notifications: {
      uploadConfig: {
        mutate: vi.fn(async (input: unknown) => {
          state.uploaded.push(input);
          return { accepted: true };
        }),
      },
      pull: {
        query: vi.fn(async () => ({ events: state.pulled })),
      },
    },
  })),
}));

vi.mock("../src/notifications", () => ({
  sendDesktopNotification: vi.fn(async (title: string, body: string) => {
    state.notifications.push({ title, body });
  }),
}));

import { syncDesktopNotifications } from "../src/server-notifications";

describe("syncDesktopNotifications", () => {
  beforeEach(async () => {
    store.clear();
    state.uploaded.length = 0;
    state.pulled.length = 0;
    state.notifications.length = 0;
  });

  it("uploads the active config and shows pulled events", async () => {
    await storage.addAlert({
      id: "a1",
      productId: "mikrotik-crs804-4ddq-hrm",
      targetPrice: 500,
      currency: "USD",
      isActive: true,
      createdAt: new Date().toISOString(),
    });
    state.pulled = [
      {
        id: "e1",
        type: "price_drop",
        title: "💸 Price Drop Alert!",
        body: "CRS804 is now $480.00!",
        alertId: "a1",
        productId: "mikrotik-crs804-4ddq-hrm",
        createdAt: 123,
      },
    ];
    await syncDesktopNotifications();
    expect(state.uploaded).toHaveLength(1);
    const input = state.uploaded[0] as Record<string, unknown>;
    expect(input.deviceId).toBeTruthy();
    const alerts = input.alerts as Array<{ id: string }>;
    expect(alerts.map((a) => a.id)).toContain("a1");
    expect(state.notifications).toEqual([
      { title: "💸 Price Drop Alert!", body: "CRS804 is now $480.00!" },
    ]);
  });

  it("reconciles a pulled price_drop by deactivating the alert", async () => {
    await storage.addAlert({
      id: "a1",
      productId: "mikrotik-crs804-4ddq-hrm",
      targetPrice: 500,
      currency: "USD",
      isActive: true,
      createdAt: new Date().toISOString(),
    });
    state.pulled = [
      {
        id: "e1",
        type: "price_drop",
        title: "💸 Price Drop Alert!",
        body: "CRS804 is now $480.00!",
        alertId: "a1",
        productId: "mikrotik-crs804-4ddq-hrm",
        triggeredPrice: 480,
        createdAt: 123,
      },
    ];
    await syncDesktopNotifications();
    const alerts = await storage.getAlerts();
    expect(alerts[0]!.isActive).toBe(false);
    expect(alerts[0]!.triggeredPrice).toBe(480);
  });

  it("persists a stable device id in localStorage", async () => {
    globalThis.localStorage = localStorageAdapter as never;
    await syncDesktopNotifications();
    await syncDesktopNotifications();
    const ids = state.uploaded.map(
      (u) => (u as { deviceId: string }).deviceId,
    );
    expect(ids[0]).toBe(ids[1]);
  });
});
```

> If `storage.addAlert` is not exported by the `Storage` type, seed via `storage.saveAlerts([{ ... }])` instead — both exist on the `createStorage` return. `globalThis.localStorage` is set only if the jsdom environment doesn't already provide it.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter desktop test -- server-notifications`
Expected: FAIL with "Cannot find module '../src/server-notifications'".

- [ ] **Step 3: Write `desktop/src/server-notifications.ts`**

Create the file:

```ts
import { storage } from "./storage";
import { createTRPCClient } from "./lib/trpc";

const DEVICE_ID_KEY = "device_id";
const TIMEOUT_MS = 4000;

interface PushConfig {
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
}

interface PushEvent {
  id: string;
  type: string;
  title: string;
  body: string;
  alertId?: string;
  watchId?: string;
  reminderId?: string;
  triggeredPrice?: number;
}

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getDesktopDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = generateId();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

async function uploadConfig(
  deviceId: string,
  config: PushConfig,
): Promise<boolean> {
  try {
    const client = createTRPCClient();
    await Promise.race([
      client.notifications.uploadConfig.mutate({ deviceId, ...config }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
    ]);
    return true;
  } catch {
    return false;
  }
}

async function pullEvents(deviceId: string): Promise<PushEvent[]> {
  try {
    const client = createTRPCClient();
    const result = await Promise.race([
      client.notifications.pull.query({ deviceId }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
    ]);
    return result?.events ?? [];
  } catch {
    return [];
  }
}

async function reconcileEvent(event: PushEvent): Promise<void> {
  if (event.type === "price_drop" && event.alertId) {
    await storage.deactivateAlert(event.alertId, event.triggeredPrice ?? 0);
  }
  if (event.type === "restock" && event.watchId) {
    await storage.removeStockWatch(event.watchId);
  }
  if (event.type === "reminder" && event.reminderId) {
    await storage.removeBackOrderReminder(event.reminderId);
  }
}

export async function syncDesktopNotifications(): Promise<void> {
  try {
    const deviceId = getDesktopDeviceId();
    const alerts = await storage.getAlerts();
    const activeAlerts = alerts
      .filter((a) => a.isActive && !a.triggeredAt)
      .map((a) => ({
        id: a.id,
        productId: a.productId,
        targetPrice: a.targetPrice,
        currency: a.currency,
        distributorId: a.distributorId,
      }));
    const stockWatches = (await storage.getStockWatches()).map((w) => ({
      id: w.id,
      productId: w.productId,
      distributorId: w.distributorId,
      lastKnownStatus: w.lastKnownStatus,
    }));
    const dateReminders = (await storage.getBackOrderReminders())
      .filter((r) => r.reminderType === "date")
      .map((r) => ({
        id: r.id,
        productId: r.productId,
        distributorId: r.distributorId,
        reminderDate: r.reminderDate,
      }));

    await uploadConfig(deviceId, {
      alerts: activeAlerts,
      stockWatches,
      dateReminders,
    });

    const events = await pullEvents(deviceId);
    for (const event of events) {
      const { sendDesktopNotification } = await import("./notifications");
      await sendDesktopNotification(event.title, event.body);
      await reconcileEvent(event);
    }
  } catch {
    // desktop notification sync is best-effort
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter desktop test -- server-notifications`
Expected: PASS (3 tests).

- [ ] **Step 5: Verify types**

Run: `pnpm check:desktop`
Expected: PASS.

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add desktop/src/server-notifications.ts desktop/tests/server-notifications.test.ts
git commit -m "feat(desktop): sync and render server-queued notification events"
```

## Task 9: Desktop wiring in `App.tsx`

**Files:**
- Modify: `desktop/src/App.tsx` (import + effect)

- [ ] **Step 1: Add the import**

In `desktop/src/App.tsx`, after `import { getApiBaseUrl } from "./lib/api-base";` (line 24), add:

```ts
import { syncDesktopNotifications } from "./server-notifications";
```

- [ ] **Step 2: Add the sync effect**

After the `onPricesChecked` effect (after line 130), add:

```tsx
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      await syncDesktopNotifications();
    };
    void run();
    const timer = setInterval(() => {
      void run();
    }, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);
```

- [ ] **Step 3: Verify types + tests**

Run: `pnpm check:desktop`
Expected: PASS.

Run: `pnpm --filter desktop test`
Expected: PASS (33 tests).

- [ ] **Step 4: Commit**

```bash
git add desktop/src/App.tsx
git commit -m "feat(desktop): poll and show server notifications on a timer"
```

## Task 10: Verification + todo.md + checkpoint v3.12

**Files:**
- Modify: `todo.md` (append Phase 33)

- [ ] **Step 1: Full verification**

```bash
pnpm check
pnpm lint
pnpm test
pnpm check:desktop
pnpm --filter desktop test
```

Expected: `pnpm check` 0 errors; `pnpm lint` clean (only the pre-existing `MODULE_TYPELESS_PACKAGE_JSON` warning); `pnpm test` all pass (existing 397 + new 4 push-notifications + 1 notifications wiring + 2 router + 5 push-token = ~409); desktop tests all pass (~33); desktop typecheck clean.

- [ ] **Step 2: Update `todo.md`**

Append:

```md
## Phase 33: Push Notifications

- [x] device_push_tokens Drizzle table + migration
- [x] Server push service (upsert token + Expo push send) (server/push-notifications.ts)
- [x] Push notification events at detection time (warmer evaluation)
- [x] Public notifications.registerPushToken tRPC endpoint (+ stockWatches.lastKnownStatus schema fix)
- [x] Mobile expo push token registration (lib/push-token.ts) + launch wiring
- [x] Desktop syncDesktopNotifications + scheduled polling + native notifications
```

- [ ] **Step 3: Checkpoint commit**

```bash
git add todo.md
git commit -m "Checkpoint: v3.12: Push notifications (Expo push on mobile, scheduled pull + native notifications on desktop, pull fallback retained). TypeScript: 0 errors."
```

- [ ] **Step 4: Push**

```bash
git push origin main
```

## Self-Review Notes

- Task 4 fixes the latent Phase 32 bug where the router stripped `lastKnownStatus` from uploaded stock watches, breaking restock transition detection through the real upload path.
- Desktop deliberately does not reuse `lib/server-notifications.ts` (imports `expo-secure-store` via mobile `./trpc`); it uses `desktop/src/lib/trpc.ts` + `desktop/src/storage.ts`.
- All `tests/*.test.ts` that touch modules importing `expo-server-sdk` mock it (`tests/push-notifications.test.ts`) or mock `server/push-notifications` (`tests/notifications-router.test.ts`, `tests/notifications.test.ts`), so no test requires a live DB or Expo credentials.
