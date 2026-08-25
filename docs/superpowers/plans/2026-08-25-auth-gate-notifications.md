# Auth-Gate Notification Endpoints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close audit finding #6 — make `notifications.uploadConfig`, `notifications.pull`, and `notifications.registerPushToken` require sign-in, derive `deviceId` from trusted context instead of client input, and enforce per-user device ownership.

**Architecture:** Three currently-public tRPC procedures become `protectedProcedure`. The server derives the device id from `ctx.deviceId` (session claim → `x-device-id` header fallback, already normalized in `createContext`) and runs a new `assertDeviceAccess` ownership guard before every read/write. Client wrappers stop sending `deviceId`; the web 60s poll gates on auth state.

**Commit-coupling note:** the tRPC input schemas couple server and client — changing one side alone breaks `pnpm check` (excess/missing `deviceId` on mutate/query calls). Tasks 2 and 3 therefore land as one combined commit (Task 4) so every commit stays typecheck-green.

**Tech Stack:** tRPC v11, Drizzle/MySQL with in-memory fallback, vitest, TypeScript strict.

**Spec:** `docs/superpowers/specs/2026-08-25-auth-gate-notifications-design.md`

---

### Task 1: `assertDeviceAccess` guard in `server/devices.ts`

**Files:**
- Modify: `server/devices.ts`
- Test: `tests/devices.test.ts`

- [ ] **Step 1: Write the failing tests**

In `tests/devices.test.ts`, add `assertDeviceAccess` to the import list from `"../server/devices"` (the block that starts `import { listDevicesForUser, ...`). Then append this describe block:

```ts
describe("assertDeviceAccess", () => {
  beforeEach(() => {
    clearDevicesForTests();
    clearNotificationsForTests();
    clearPushTokensForTests();
  });

  it("allows an unbound device (first-touch adopt)", async () => {
    await expect(assertDeviceAccess(7, "dev-new")).resolves.toBeUndefined();
  });

  it("allows the owning user", async () => {
    await upsertDeviceConfig("dev-1", baseConfig, 7);
    await expect(assertDeviceAccess(7, "dev-1")).resolves.toBeUndefined();
  });

  it("allows a device bound via a push token", async () => {
    await upsertPushToken("dev-2", "ExponentPushToken[abc]", "ios", 7);
    await expect(assertDeviceAccess(7, "dev-2")).resolves.toBeUndefined();
  });

  it("rejects a device bound to another user", async () => {
    await upsertDeviceConfig("dev-1", baseConfig, 7);
    await expect(assertDeviceAccess(8, "dev-1")).rejects.toThrow(
      "Notification device belongs to another account",
    );
  });
});
```

Note: `baseConfig`, `clearDevicesForTests`, `clearNotificationsForTests`, `clearPushTokensForTests`, `upsertDeviceConfig`, and `upsertPushToken` are already imported/defined in this test file.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/devices.test.ts -t "assertDeviceAccess"`
Expected: FAIL — `assertDeviceAccess` is not exported by `../server/devices`.

- [ ] **Step 3: Implement the guard**

In `server/devices.ts`, add to the import block at the top:

```ts
import { TRPCError } from "@trpc/server";
```

Add after `getDeviceBinding` (ends at `server/devices.ts:113`):

```ts
export async function assertDeviceAccess(
  userId: number,
  deviceId: string,
): Promise<void> {
  const { userId: boundTo } = await getDeviceBinding(deviceId);
  if (boundTo === null || boundTo === userId) return;
  throw new TRPCError({
    code: "FORBIDDEN",
    message: "Notification device belongs to another account",
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/devices.test.ts`
Expected: PASS — all tests including the new `assertDeviceAccess` block.

- [ ] **Step 5: Commit**

```bash
git add server/devices.ts tests/devices.test.ts
git commit -m "feat: add assertDeviceAccess ownership guard"
```

---

### Task 2: Gate the notification endpoints in `server/routers.ts`

No commit yet — Task 4 commits this together with the client updates (see commit-coupling note).

**Files:**
- Modify: `server/routers.ts` (notifications router, lines ~171-256)
- Test: `tests/notifications-router.test.ts`

- [ ] **Step 1: Rewrite the router tests (failing)**

In `tests/notifications-router.test.ts`:

a) Add a partial mock for `../server/devices` right after the existing `vi.mock("../server/push-notifications", ...)` block:

```ts
vi.mock("../server/devices", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../server/devices")>();
  return { ...actual, getDeviceBinding: vi.fn() };
});

import { getDeviceBinding } from "../server/devices";

const mockedBinding = vi.mocked(getDeviceBinding);
```

b) Change `createAuthedContext` to accept a device id (defaulting to `"dev-1"`):

```ts
function createAuthedContext(
  userId: number,
  deviceId: string | null = "dev-1",
): TrpcContext {
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
    deviceId,
  };
}
```

c) Update `beforeEach` to reset the binding mock with a permissive default:

```ts
beforeEach(() => {
  vi.clearAllMocks();
  mockedBinding.mockResolvedValue({ userId: null });
});
```

d) Replace the endpoint tests with the versions below (inputs lose `deviceId`; expectations gain the caller's user id; public access flips to rejection):

```ts
it("uploads a device config", async () => {
  mockedUpsert.mockResolvedValue(undefined);
  const caller = appRouter.createCaller(createAuthedContext(7));
  const result = await caller.notifications.uploadConfig({
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

it("uploads a device config with healthEvents", async () => {
  mockedUpsert.mockResolvedValue(undefined);
  const caller = appRouter.createCaller(createAuthedContext(7));
  const result = await caller.notifications.uploadConfig({
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
    7,
  );
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
  const caller = appRouter.createCaller(createAuthedContext(7));
  const result = await caller.notifications.pull({});
  expect(result.events).toHaveLength(1);
  expect(result.events[0]!.alertId).toBe("a1");
  expect(mockedPull).toHaveBeenCalledWith("dev-1", 7);
});

it("rejects unauthenticated uploadConfig", async () => {
  const caller = appRouter.createCaller(createPublicContext());
  await expect(
    caller.notifications.uploadConfig({
      alerts: [],
      stockWatches: [],
      dateReminders: [],
    }),
  ).rejects.toThrow("UNAUTHORIZED");
  expect(mockedUpsert).not.toHaveBeenCalled();
});

it("rejects unauthenticated pull", async () => {
  mockedPull.mockResolvedValue([]);
  const caller = appRouter.createCaller(createPublicContext());
  await expect(caller.notifications.pull({})).rejects.toThrow("UNAUTHORIZED");
  expect(mockedPull).not.toHaveBeenCalled();
});

it("rejects unauthenticated registerPushToken", async () => {
  const caller = appRouter.createCaller(createPublicContext());
  await expect(
    caller.notifications.registerPushToken({
      token: "ExponentPushToken[abc123]",
      platform: "ios",
    }),
  ).rejects.toThrow("UNAUTHORIZED");
  expect(mockedUpsertPush).not.toHaveBeenCalled();
});

it("registers a push token for a device", async () => {
  mockedUpsertPush.mockResolvedValue(undefined);
  const caller = appRouter.createCaller(createAuthedContext(7));
  const result = await caller.notifications.registerPushToken({
    token: "ExponentPushToken[abc123]",
    platform: "ios",
  });
  expect(result).toEqual({ accepted: true });
  expect(mockedUpsertPush).toHaveBeenCalledWith(
    "dev-1",
    "ExponentPushToken[abc123]",
    "ios",
    7,
  );
});

it("registers a web push subscription", async () => {
  mockedUpsertPush.mockResolvedValue(undefined);
  const caller = appRouter.createCaller(createAuthedContext(7));
  const result = await caller.notifications.registerPushToken({
    token: JSON.stringify({
      endpoint: "https://push.example.com/abc",
      keys: { p256dh: "p256dh-key", auth: "auth-key" },
    }),
    platform: "web",
  });
  expect(result).toEqual({ accepted: true });
  expect(mockedUpsertPush).toHaveBeenCalledWith(
    "dev-1",
    JSON.stringify({
      endpoint: "https://push.example.com/abc",
      keys: { p256dh: "p256dh-key", auth: "auth-key" },
    }),
    "web",
    7,
  );
});

it("rejects an invalid platform for registerPushToken", async () => {
  const caller = appRouter.createCaller(createAuthedContext(7));
  await expect(
    caller.notifications.registerPushToken({
      token: "ExponentPushToken[abc123]",
      platform: "desktop",
    } as never),
  ).rejects.toThrow();
  expect(mockedUpsertPush).not.toHaveBeenCalled();
});

it("forwards stock watch lastKnownStatus through uploadConfig", async () => {
  mockedUpsert.mockResolvedValue(undefined);
  const caller = appRouter.createCaller(createAuthedContext(7));
  await caller.notifications.uploadConfig({
    alerts: [],
    stockWatches: [
      {
        id: "w1",
        productId: "mikrotik-crs804-4ddq-hrm",
        distributorId: "d1",
        lastKnownStatus: "back_order",
      },
    ],
    dateReminders: [],
  });
  expect(mockedUpsert).toHaveBeenCalledWith(
    "dev-1",
    {
      alerts: [],
      stockWatches: [
        {
          id: "w1",
          productId: "mikrotik-crs804-4ddq-hrm",
          distributorId: "d1",
          lastKnownStatus: "back_order",
        },
      ],
      dateReminders: [],
    },
    7,
  );
});

it("rejects when the context has no device id", async () => {
  const caller = appRouter.createCaller(createAuthedContext(7, null));
  await expect(caller.notifications.pull({})).rejects.toThrow(
    "Missing device id",
  );
  expect(mockedPull).not.toHaveBeenCalled();
});

it("adopts an unbound device on uploadConfig", async () => {
  mockedBinding.mockResolvedValue({ userId: null });
  mockedUpsert.mockResolvedValue(undefined);
  const caller = appRouter.createCaller(createAuthedContext(7));
  await caller.notifications.uploadConfig({
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

it("rejects uploadConfig for a device owned by another user", async () => {
  mockedBinding.mockResolvedValue({ userId: 8 });
  const caller = appRouter.createCaller(createAuthedContext(7));
  await expect(
    caller.notifications.uploadConfig({
      alerts: [],
      stockWatches: [],
      dateReminders: [],
    }),
  ).rejects.toThrow("Notification device belongs to another account");
  expect(mockedUpsert).not.toHaveBeenCalled();
});

it("rejects pull for a device owned by another user", async () => {
  mockedBinding.mockResolvedValue({ userId: 8 });
  const caller = appRouter.createCaller(createAuthedContext(7));
  await expect(caller.notifications.pull({})).rejects.toThrow(
    "Notification device belongs to another account",
  );
  expect(mockedPull).not.toHaveBeenCalled();
});

it("allows pull for the owning user", async () => {
  mockedBinding.mockResolvedValue({ userId: 7 });
  mockedPull.mockResolvedValue([]);
  const caller = appRouter.createCaller(createAuthedContext(7));
  await caller.notifications.pull({});
  expect(mockedPull).toHaveBeenCalledWith("dev-1", 7);
});

it("rejects registerPushToken for a device owned by another user", async () => {
  mockedBinding.mockResolvedValue({ userId: 8 });
  const caller = appRouter.createCaller(createAuthedContext(7));
  await expect(
    caller.notifications.registerPushToken({
      token: "ExponentPushToken[abc123]",
      platform: "ios",
    }),
  ).rejects.toThrow("Notification device belongs to another account");
  expect(mockedUpsertPush).not.toHaveBeenCalled();
});
```

Delete the superseded tests: "works without authentication (public procedure)", "pulls user-scoped events when authenticated", "binds the device to the user on authenticated uploadConfig", "binds the device to the user on authenticated registerPushToken", "rejects an oversized deviceId for uploadConfig", "rejects an oversized deviceId for pull" (their coverage lives in the tests above).

- [ ] **Step 2: Gate the endpoints**

In `server/routers.ts`:

a) Add a `TRPCError` import near the top:

```ts
import { TRPCError } from "@trpc/server";
```

b) Extend the existing import from `"./devices"` (currently includes `getDeviceBinding`) to also import `assertDeviceAccess`.

c) Replace the entire `notifications: router({ ... })` block with:

```ts
notifications: router({
  uploadConfig: protectedProcedure
    .input(
      z.object({
        alerts: z.array(
          z.object({
            id: z.string().min(1),
            productId: z.string().min(1),
            targetPrice: z.number(),
            currency: z.string().min(1),
            distributorId: z.string().optional(),
            direction: z.enum(["drop", "rise"]).optional(),
            snoozedUntil: z.string().optional(),
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
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.deviceId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Missing device id",
        });
      }
      await assertDeviceAccess(ctx.user.id, ctx.deviceId);
      await upsertDeviceConfig(
        ctx.deviceId,
        {
          alerts: input.alerts,
          stockWatches: input.stockWatches,
          dateReminders: input.dateReminders,
          healthEvents: input.healthEvents,
        },
        ctx.user.id,
      );
      return { accepted: true } as const;
    }),
  pull: protectedProcedure.input(z.object({})).query(async ({ ctx }) => {
    if (!ctx.deviceId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Missing device id",
      });
    }
    await assertDeviceAccess(ctx.user.id, ctx.deviceId);
    const events = await pullPendingEvents(ctx.deviceId, ctx.user.id);
    return { events };
  }),
  registerPushToken: protectedProcedure
    .input(
      z.object({
        token: z.string().min(1).max(2048),
        platform: z.enum(["ios", "android", "web"]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.deviceId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Missing device id",
        });
      }
      await assertDeviceAccess(ctx.user.id, ctx.deviceId);
      await upsertPushToken(ctx.deviceId, input.token, input.platform, ctx.user.id);
      return { accepted: true } as const;
    }),
}),
```

Keep `getDeviceBinding` in the `"./devices"` import — it is still used by `devices.current` (~line 266).

- [ ] **Step 3: Run router tests to verify they pass**

Run: `pnpm vitest run tests/notifications-router.test.ts tests/devices.test.ts`
Expected: PASS. (`pnpm check` will fail here — client wrappers still send `deviceId`; fixed in Task 3.)

---

### Task 3: Client wrappers drop `deviceId`

No commit yet — Task 4 commits Tasks 2+3 together (see commit-coupling note).

**Files:**
- Modify: `lib/server-notifications.ts`
- Modify: `lib/push-token.ts`
- Modify: `lib/web-push.ts`
- Test: `tests/server-notifications.test.ts`
- Test: `tests/push-token.test.ts`
- Test: `tests/web-push.test.ts`

- [ ] **Step 1: Update `tests/server-notifications.test.ts` (failing)**

a) "uploads the config and returns true":

```ts
const ok = await uploadNotificationConfig({
  alerts: [],
  stockWatches: [],
  dateReminders: [],
});
expect(ok).toBe(true);
expect(mutate).toHaveBeenCalledWith({
  alerts: [],
  stockWatches: [],
  dateReminders: [],
});
```

b) "returns false when the mutate rejects":

```ts
const ok = await uploadNotificationConfig({
  alerts: [],
  stockWatches: [],
  dateReminders: [],
});
expect(ok).toBe(false);
```

c) All three `pullNotificationEvents(...)` calls become `pullNotificationEvents()`; the assertion in "returns events from the server" becomes:

```ts
expect(query).toHaveBeenCalledWith({});
```

d) "includes healthEvents in the mutate call":

```ts
const ok = await uploadNotificationConfig(
  {
    alerts: [],
    stockWatches: [],
    dateReminders: [],
  },
  [
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
);
expect(ok).toBe(true);
expect(mutate).toHaveBeenCalledWith({
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
```

e) Timeout-semantics test call becomes:

```ts
const promise = uploadNotificationConfig({
  alerts: [],
  stockWatches: [],
  dateReminders: [],
});
```

- [ ] **Step 2: Update `tests/push-token.test.ts` (failing)**

Delete the `vi.mock("../lib/device-id", ...)` block (lines 39-41). Change the first test:

```ts
it("registers the push token on a physical device", async () => {
  await registerPushToken();
  expect(state.mutateCalls).toHaveLength(1);
  expect(state.mutateCalls[0]).toEqual({
    token: "ExponentPushToken[mobile]",
    platform: "ios",
  });
});
```

- [ ] **Step 3: Update `tests/web-push.test.ts` (failing)**

In "subscribeWebPush registers the subscription with the server", delete the line

```ts
expect(state.mutateCalls[0]!.deviceId).toBe("web-dev-1");
```

keeping the `platform` and parsed-`token` assertions.

- [ ] **Step 4: Update `lib/server-notifications.ts`**

a) Replace `uploadNotificationConfig` (lines 9-38) with:

```ts
export async function uploadNotificationConfig(
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
    const result = await Promise.race([
      client.notifications.uploadConfig.mutate({
        ...config,
        healthEvents,
      }).then(() => true as const),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), TIMEOUT_MS),
      ),
    ]);
    return result === true;
  } catch {
    return false;
  }
}
```

b) Replace `pullNotificationEvents` (lines 54-69) with:

```ts
export async function pullNotificationEvents(): Promise<NotificationEvent[]> {
  try {
    const client = createTRPCClient();
    const result = await Promise.race([
      client.notifications.pull.query({}),
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

c) In `runSyncServerNotifications`: delete the `getDeviceId` dynamic import (lines 83-85), delete `const deviceId = await getDeviceId();` (line 94), change the master-switch-off call (line 105) to:

```ts
await uploadNotificationConfig({
  alerts: [],
  stockWatches: [],
  dateReminders: [],
});
```

change the main upload (lines 150-164) to:

```ts
const uploadOk = await uploadNotificationConfig(
  { alerts: activeAlerts, stockWatches, dateReminders },
  settings.healthAlerts && pendingHealthEvents.length > 0
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

and change line 174 to:

```ts
const events = await pullNotificationEvents();
```

- [ ] **Step 5: Update `lib/push-token.ts`**

Delete `import { getDeviceId } from "./device-id";` (line 5) and `const deviceId = await getDeviceId();` (line 19); change the mutation (lines 22-26) to:

```ts
client.notifications.registerPushToken.mutate({
  token: token.data,
  platform: Platform.OS as "ios" | "android",
}),
```

- [ ] **Step 6: Update `lib/web-push.ts`**

Delete `import { getDeviceId } from "./device-id";` (line 2) and `const deviceId = await getDeviceId();` (line 55); change the mutation (lines 57-61) to:

```ts
await client.notifications.registerPushToken.mutate({
  token: JSON.stringify(subscription),
  platform: "web",
});
```

- [ ] **Step 7: Run affected tests to verify they pass**

Run: `pnpm vitest run tests/server-notifications.test.ts tests/sync-server-notifications.test.ts tests/push-token.test.ts tests/web-push.test.ts`
Expected: PASS.

---

### Task 4: Combined verification and commit for Tasks 2+3

**Files:** none new

- [ ] **Step 1: Typecheck**

Run: `pnpm check`
Expected: 0 errors.

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: 0 errors (pre-existing warnings acceptable).

- [ ] **Step 3: Commit**

```bash
git add server/routers.ts tests/notifications-router.test.ts \
  lib/server-notifications.ts lib/push-token.ts lib/web-push.ts \
  tests/server-notifications.test.ts tests/push-token.test.ts tests/web-push.test.ts
git commit -m "feat: auth-gate notification endpoints with context-derived device ownership"
```

---

### Task 5: Gate the web poll on auth state — `lib/web-notifications.ts`

The spec says "start the poll only when authenticated; stop it on sign-out". This implementation keeps the interval running but gates each tick on auth state — observably identical (zero server requests while signed out) and needs no sign-in/sign-out event wiring; a mid-session sign-in resumes syncing on the next tick.

**Files:**
- Modify: `lib/web-notifications.ts`
- Test: `tests/web-notifications.test.ts`

- [ ] **Step 1: Write the failing tests**

In `tests/web-notifications.test.ts`:

a) Add to the hoisted `state` object: `authenticated: true,`

b) Add a mock after the `vi.mock("../lib/server-notifications", ...)` block:

```ts
vi.mock("../lib/_core/auth", () => ({
  getUserInfo: vi.fn(async () =>
    state.authenticated
      ? ({
          id: 1,
          openId: "open-1",
          name: null,
          email: null,
          loginMethod: null,
          lastSignedIn: new Date(),
        } as const)
      : null,
  ),
}));
```

c) Reset it in `beforeEach`: `state.authenticated = true;`

d) Add these tests inside the main describe:

```ts
it("poll skips syncServerNotifications when signed out", async () => {
  state.authenticated = false;
  state.webNotificationsEnabled = true;
  state.permission = "granted";
  MockNotification.permission = "granted";
  vi.useFakeTimers();
  const cleanup = setupWebNotifications();
  await vi.advanceTimersByTimeAsync(0);
  await vi.advanceTimersByTimeAsync(120_000);
  expect(state.syncCalls).toBe(0);
  cleanup();
});

it("poll resumes when the user signs in mid-session", async () => {
  state.authenticated = false;
  state.webNotificationsEnabled = true;
  state.permission = "granted";
  MockNotification.permission = "granted";
  vi.useFakeTimers();
  const cleanup = setupWebNotifications();
  await vi.advanceTimersByTimeAsync(60_000);
  expect(state.syncCalls).toBe(0);
  state.authenticated = true;
  await vi.advanceTimersByTimeAsync(60_000);
  expect(state.syncCalls).toBe(1);
  cleanup();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/web-notifications.test.ts`
Expected: FAIL — the poll currently syncs regardless of auth state (the first new test sees `syncCalls > 0`).

- [ ] **Step 3: Implement the gate**

In `lib/web-notifications.ts`, add above `startPolling`:

```ts
async function isAuthenticatedClient(): Promise<boolean> {
  try {
    const { getUserInfo } = await import("./_core/auth");
    return Boolean(await getUserInfo());
  } catch {
    return false;
  }
}

async function pollTick(): Promise<void> {
  if (!(await isAuthenticatedClient())) return;
  void syncServerNotifications();
}
```

Change `startPolling` (lines 77-86) to:

```ts
function startPolling(): void {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    void pollTick();
  }, POLL_INTERVAL_MS);
  focusListener = () => {
    void pollTick();
  };
  window.addEventListener("focus", focusListener);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/web-notifications.test.ts`
Expected: PASS — including the pre-existing polling tests (they run with `state.authenticated = true`).

- [ ] **Step 5: Commit**

```bash
git add lib/web-notifications.ts tests/web-notifications.test.ts
git commit -m "feat: gate web notification poll on authentication"
```

---

### Task 6: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Typecheck**

Run: `pnpm check`
Expected: 0 errors.

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: 0 errors (pre-existing warnings acceptable).

- [ ] **Step 3: Full test suite**

Run: `pnpm test`
Expected: all tests pass (previously 997 passed / 10 skipped; count shifts slightly with the rewritten router tests).

- [ ] **Step 4: Checkpoint commit (if any stragglers)**

If Steps 1-3 required fixups, commit them:

```bash
git add -A
git commit -m "Checkpoint: v6.7: Auth-gated notification endpoints. TypeScript: 0 errors."
```

If the working tree is already clean (all tasks committed individually), skip this step.

---

## Out of scope (per spec)

- `devices.current` stays public (pre-auth binding lookup).
- Launch/background call sites (`app/_layout.tsx`, `lib/background-tasks/price-check.ts`) unchanged — best-effort semantics already degrade gracefully to local-only when signed out.
- No data migration: legacy `userId=null` rows are inert (evaluation skips them) and become claimable on first authenticated touch.
