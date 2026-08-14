# Device Management UI Implementation Plan (v4.1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Device Management" section in Settings where a signed-in user can see the current device's binding status, bind the current device to their account explicitly, list every device bound to their account (platform + last seen), and unbind a sold/lost device (full removal). Anonymous users see nothing.

**Architecture:** New `server/devices.ts` module with memory/DB parallel helpers (mirroring `server/notifications.ts` / `server/push-notifications.ts`), surfaced through a new `devices` router in `server/routers.ts`. Client side: new `lib/devices.ts` best-effort tRPC helper + a new Settings section. **No schema changes, no migration.** The existing device tables already carry everything needed.

**Tech Stack:** TypeScript, Drizzle ORM (MySQL), tRPC, vitest. Server modules use in-memory fallbacks when `getDb()` returns null (all tests run against these).

**Spec:** `docs/superpowers/specs/2026-08-14-device-management-design.md` (approved).

---

### Task 1: `server/devices.ts` module + memory helpers + tests

**Files:**
- Modify: `server/notifications.ts` (add 2 exported helpers)
- Modify: `server/push-notifications.ts` (add 2 exported helpers)
- New: `server/devices.ts`
- New: `tests/devices.test.ts`

- [ ] **Step 1: Add memory helpers to `server/notifications.ts`**

The maps `memoryConfigs`/`memoryDeliveries`/`memoryEvents` are module-private. `server/devices.ts` must NOT reach into them directly. Add two exports after `clearNotificationsForTests` (currently line 483):

```ts
export function listMemoryConfigDevices(): Array<{
  deviceId: string;
  userId: number | null;
}> {
  return [...memoryConfigs.entries()].map(([deviceId, entry]) => ({
    deviceId,
    userId: entry.userId,
  }));
}

export function removeMemoryDevice(deviceId: string): void {
  memoryConfigs.delete(deviceId);
  memoryDeliveries.delete(deviceId);
  for (const [id, event] of memoryEvents) {
    if (event.deviceId === deviceId) memoryEvents.delete(id);
  }
}
```

Note: user-scoped events have `deviceId: null`, so the `event.deviceId === deviceId` filter only removes anon-scoped events for that device — exactly the spec's unbind semantics.

- [ ] **Step 2: Add memory helpers to `server/push-notifications.ts`**

Add after `clearPushTokensForTests` (currently line 144):

```ts
export function listMemoryTokenDevices(): Array<{
  deviceId: string;
  userId: number | null;
  platform: string | null;
}> {
  return [...memoryTokens.entries()].map(([deviceId, token]) => ({
    deviceId,
    userId: token.userId,
    platform: token.platform,
  }));
}

export function removeMemoryToken(deviceId: string): void {
  memoryTokens.delete(deviceId);
}
```

- [ ] **Step 3: Create `server/devices.ts`**

```ts
import { eq } from "drizzle-orm";
import {
  deviceNotificationConfigs,
  devicePushTokens,
  notificationEventDeliveries,
  notificationEvents,
} from "../drizzle/schema";
import { getDb } from "./db";
import {
  listMemoryConfigDevices,
  removeMemoryDevice,
} from "./notifications";
import {
  listMemoryTokenDevices,
  removeMemoryToken,
} from "./push-notifications";

export interface DeviceInfo {
  deviceId: string;
  platform: string | null;
  lastSeenAt: number;
}

export async function listDevicesForUser(
  userId: number,
): Promise<DeviceInfo[]> {
  const db = await getDb();
  if (!db) {
    const configDevices = listMemoryConfigDevices();
    const tokenDevices = listMemoryTokenDevices();
    const byDevice = new Map<string, DeviceInfo>();
    for (const c of configDevices) {
      if (c.userId !== userId) continue;
      byDevice.set(c.deviceId, {
        deviceId: c.deviceId,
        platform: null,
        lastSeenAt: 0,
      });
    }
    for (const t of tokenDevices) {
      if (t.userId !== userId) continue;
      const existing = byDevice.get(t.deviceId);
      byDevice.set(t.deviceId, {
        deviceId: t.deviceId,
        platform: existing?.platform ?? t.platform,
        lastSeenAt: Math.max(existing?.lastSeenAt ?? 0, 0),
      });
    }
    return [...byDevice.values()].sort((a, b) => b.lastSeenAt - a.lastSeenAt);
  }
  const configRows = await db
    .select()
    .from(deviceNotificationConfigs)
    .where(eq(deviceNotificationConfigs.userId, userId));
  const tokenRows = await db
    .select()
    .from(devicePushTokens)
    .where(eq(devicePushTokens.userId, userId));
  const byDevice = new Map<string, DeviceInfo>();
  for (const row of configRows) {
    const existing = byDevice.get(row.deviceId);
    byDevice.set(row.deviceId, {
      deviceId: row.deviceId,
      platform: existing?.platform ?? null,
      lastSeenAt: Math.max(existing?.lastSeenAt ?? 0, row.updatedAt),
    });
  }
  for (const row of tokenRows) {
    const existing = byDevice.get(row.deviceId);
    byDevice.set(row.deviceId, {
      deviceId: row.deviceId,
      platform: existing?.platform ?? row.platform,
      lastSeenAt: Math.max(existing?.lastSeenAt ?? 0, row.updatedAt),
    });
  }
  return [...byDevice.values()].sort((a, b) => b.lastSeenAt - a.lastSeenAt);
}

export async function getDeviceBinding(
  deviceId: string,
): Promise<{ userId: number | null }> {
  const db = await getDb();
  if (!db) {
    const config = listMemoryConfigDevices().find(
      (d) => d.deviceId === deviceId,
    );
    if (config) return { userId: config.userId };
    const token = listMemoryTokenDevices().find(
      (d) => d.deviceId === deviceId,
    );
    return { userId: token?.userId ?? null };
  }
  const configRows = await db
    .select()
    .from(deviceNotificationConfigs)
    .where(eq(deviceNotificationConfigs.deviceId, deviceId));
  if (configRows.length > 0) {
    return { userId: configRows[0].userId };
  }
  const tokenRows = await db
    .select()
    .from(devicePushTokens)
    .where(eq(devicePushTokens.deviceId, deviceId));
  return { userId: tokenRows[0]?.userId ?? null };
}

export async function unbindDevice(
  userId: number,
  deviceId: string,
): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    const config = listMemoryConfigDevices().find(
      (d) => d.deviceId === deviceId,
    );
    const token = listMemoryTokenDevices().find(
      (d) => d.deviceId === deviceId,
    );
    const boundTo = config?.userId ?? token?.userId ?? null;
    if (boundTo !== userId) return false;
    removeMemoryDevice(deviceId);
    removeMemoryToken(deviceId);
    return true;
  }
  const configRows = await db
    .select()
    .from(deviceNotificationConfigs)
    .where(eq(deviceNotificationConfigs.deviceId, deviceId));
  const tokenRows = await db
    .select()
    .from(devicePushTokens)
    .where(eq(devicePushTokens.deviceId, deviceId));
  const boundTo = configRows[0]?.userId ?? tokenRows[0]?.userId ?? null;
  if (boundTo !== userId) return false;
  await db
    .delete(deviceNotificationConfigs)
    .where(eq(deviceNotificationConfigs.deviceId, deviceId));
  await db
    .delete(devicePushTokens)
    .where(eq(devicePushTokens.deviceId, deviceId));
  await db
    .delete(notificationEventDeliveries)
    .where(eq(notificationEventDeliveries.deviceId, deviceId));
  await db
    .delete(notificationEvents)
    .where(eq(notificationEvents.deviceId, deviceId));
  return true;
}
```

> **Plan clarification:** `unbindDevice` deletes `notificationEvents` rows by `deviceId`. User-scoped events have `deviceId: null`, so this only removes anon-scoped events — exactly the spec's "anon-scoped events" wording.

- [ ] **Step 4: Create `tests/devices.test.ts`**

Memory-path tests (mock `getDb` → null) plus DB-path tests for the union/lastSeenAt logic and the four deletes (matching the v4.0 quality bar of covering both backends):

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => null),
}));

vi.mock("expo-server-sdk", () => ({
  Expo: class {
    static isExpoPushToken = (value: unknown) =>
      typeof value === "string" && value.startsWith("ExponentPushToken");
    chunkPushNotifications(messages: unknown[]) {
      return [messages];
    }
    async sendPushNotificationsAsync() {
      return [{ status: "ok" }];
    }
  },
}));

import {
  listDevicesForUser,
  getDeviceBinding,
  unbindDevice,
} from "../server/devices";
import {
  upsertDeviceConfig,
  evaluateNotifications,
  pullPendingEvents,
  clearNotificationsForTests,
  type NotificationConfig,
} from "../server/notifications";
import {
  upsertPushToken,
  clearPushTokensForTests,
} from "../server/push-notifications";
import { setCachedPrice } from "../server/price-cache";
import { getDb } from "../server/db";
import {
  deviceNotificationConfigs,
  devicePushTokens,
  notificationEventDeliveries,
  notificationEvents,
} from "../drizzle/schema";

const mockedGetDb = vi.mocked(getDb);

const baseConfig: NotificationConfig = {
  alerts: [],
  stockWatches: [],
  dateReminders: [],
};

describe("devices (memory backend)", () => {
  beforeEach(() => {
    clearNotificationsForTests();
    clearPushTokensForTests();
    vi.clearAllMocks();
    mockedGetDb.mockResolvedValue(null);
  });

  it("lists a user's devices from config and token maps, deduped", async () => {
    await upsertDeviceConfig("dev-1", baseConfig, 7);
    await upsertDeviceConfig("dev-2", baseConfig, 7);
    await upsertPushToken("dev-1", "ExponentPushToken[abc123]", "ios", 7);
    const devices = await listDevicesForUser(7);
    expect(devices).toHaveLength(2);
    const dev1 = devices.find((d) => d.deviceId === "dev-1");
    expect(dev1?.platform).toBe("ios");
    expect(dev1?.lastSeenAt).toBe(0);
    const dev2 = devices.find((d) => d.deviceId === "dev-2");
    expect(dev2?.platform).toBeNull();
    expect(dev2?.lastSeenAt).toBe(0);
  });

  it("returns the config binding, falling back to the token", async () => {
    await upsertPushToken("dev-1", "ExponentPushToken[abc123]", "ios", 7);
    expect(await getDeviceBinding("dev-1")).toEqual({ userId: 7 });
    expect(await getDeviceBinding("unknown")).toEqual({ userId: null });
  });

  it("unbinds a device bound to the user", async () => {
    await upsertDeviceConfig("dev-1", baseConfig, 7);
    await upsertPushToken("dev-1", "ExponentPushToken[abc123]", "ios", 7);
    expect(await unbindDevice(7, "dev-1")).toBe(true);
    expect(await listDevicesForUser(7)).toEqual([]);
    expect(await getDeviceBinding("dev-1")).toEqual({ userId: null });
  });

  it("refuses to unbind another user's device", async () => {
    await upsertDeviceConfig("dev-1", baseConfig, 7);
    expect(await unbindDevice(8, "dev-1")).toBe(false);
    expect(await listDevicesForUser(7)).toHaveLength(1);
  });

  it("returns false for an unknown device", async () => {
    expect(await unbindDevice(7, "unknown")).toBe(false);
  });

  it("removes anon events for the unbound device", async () => {
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
    await upsertDeviceConfig("dev-1", baseConfig, 7);
    expect(await pullPendingEvents("dev-1")).toHaveLength(1);
    expect(await unbindDevice(7, "dev-1")).toBe(true);
    expect(await pullPendingEvents("dev-1")).toEqual([]);
  });
});

describe("devices (database backend)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists a user's devices with max lastSeenAt and token platform", async () => {
    const dbStub = {
      select: vi.fn(() => ({
        from: vi.fn((table: unknown) => {
          if (table === deviceNotificationConfigs) {
            return {
              where: vi.fn(async () => [
                { deviceId: "dev-1", userId: 7, updatedAt: 100 },
                { deviceId: "dev-2", userId: 7, updatedAt: 200 },
              ]),
            };
          }
          if (table === devicePushTokens) {
            return {
              where: vi.fn(async () => [
                { deviceId: "dev-1", userId: 7, platform: "ios", updatedAt: 150 },
              ]),
            };
          }
          return { where: vi.fn(async () => []) };
        }),
      })),
    };
    mockedGetDb.mockResolvedValue(dbStub as never);
    const devices = await listDevicesForUser(7);
    expect(devices).toHaveLength(2);
    const dev1 = devices.find((d) => d.deviceId === "dev-1");
    expect(dev1).toEqual({ deviceId: "dev-1", platform: "ios", lastSeenAt: 150 });
    const dev2 = devices.find((d) => d.deviceId === "dev-2");
    expect(dev2).toEqual({ deviceId: "dev-2", platform: null, lastSeenAt: 200 });
    mockedGetDb.mockResolvedValue(null);
  });

  it("unbinds a bound device by deleting all its rows", async () => {
    const deleted: unknown[] = [];
    const dbStub = {
      select: vi.fn(() => ({
        from: vi.fn((table: unknown) => {
          if (table === deviceNotificationConfigs) {
            return {
              where: vi.fn(async () => [{ deviceId: "dev-1", userId: 7 }]),
            };
          }
          return { where: vi.fn(async () => []) };
        }),
      })),
      delete: vi.fn((table: unknown) => {
        deleted.push(table);
        return { where: vi.fn(async () => undefined) };
      }),
    };
    mockedGetDb.mockResolvedValue(dbStub as never);
    expect(await unbindDevice(7, "dev-1")).toBe(true);
    expect(deleted).toEqual([
      deviceNotificationConfigs,
      devicePushTokens,
      notificationEventDeliveries,
      notificationEvents,
    ]);
    mockedGetDb.mockResolvedValue(null);
  });

  it("refuses to unbind another user's device in the database", async () => {
    const deleteFn = vi.fn(() => ({ where: vi.fn(async () => undefined) }));
    const dbStub = {
      select: vi.fn(() => ({
        from: vi.fn((table: unknown) => {
          if (table === deviceNotificationConfigs) {
            return {
              where: vi.fn(async () => [{ deviceId: "dev-1", userId: 7 }]),
            };
          }
          return { where: vi.fn(async () => []) };
        }),
      })),
      delete: deleteFn,
    };
    mockedGetDb.mockResolvedValue(dbStub as never);
    expect(await unbindDevice(8, "dev-1")).toBe(false);
    expect(deleteFn).not.toHaveBeenCalled();
    mockedGetDb.mockResolvedValue(null);
  });
});
```

- [ ] **Step 5: Typecheck + run tests**

Run: `pnpm check` then `pnpm test -- tests/devices.test.ts`
Expected: 0 type errors; devices tests green (memory + DB backends).

- [ ] **Step 6: Commit**

```bash
git add server/notifications.ts server/push-notifications.ts server/devices.ts tests/devices.test.ts
git commit -m "feat(devices): add server device management module"
```

---

### Task 2: `devices` router

**Files:**
- Modify: `server/routers.ts`
- New: `tests/devices-router.test.ts`

- [ ] **Step 1: Add the `devices` router to `server/routers.ts`**

Add import (with the other server imports, near line 18):

```ts
import {
  listDevicesForUser,
  getDeviceBinding,
  unbindDevice,
} from "./devices";
```

Add the router inside `appRouter` (e.g. after the `notifications` router, before the closing `}),`):

```ts
devices: router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const devices = await listDevicesForUser(ctx.user.id);
    return { devices };
  }),
  current: publicProcedure
    .input(z.object({ deviceId: z.string().min(1).max(128) }))
    .query(async ({ input }) => {
      const { userId } = await getDeviceBinding(input.deviceId);
      return { deviceId: input.deviceId, userId };
    }),
  unbind: protectedProcedure
    .input(z.object({ deviceId: z.string().min(1).max(128) }))
    .mutation(async ({ ctx, input }) => {
      const unbound = await unbindDevice(ctx.user.id, input.deviceId);
      return { unbound };
    }),
}),
```

- [ ] **Step 2: Create `tests/devices-router.test.ts`**

Copy the `createPublicContext` / `createAuthedContext` helpers verbatim from `tests/notifications-router.test.ts` (lines 23-59). Mock the `server/devices` module:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

vi.mock("../server/devices", () => ({
  listDevicesForUser: vi.fn(),
  getDeviceBinding: vi.fn(),
  unbindDevice: vi.fn(),
}));

import {
  listDevicesForUser,
  getDeviceBinding,
  unbindDevice,
} from "../server/devices";

const mockedList = vi.mocked(listDevicesForUser);
const mockedBinding = vi.mocked(getDeviceBinding);
const mockedUnbind = vi.mocked(unbindDevice);

// ... createPublicContext / createAuthedContext copied from notifications-router.test.ts ...

describe("devices router", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists devices for the signed-in user", async () => {
    mockedList.mockResolvedValue([
      { deviceId: "dev-1", platform: "ios", lastSeenAt: 123 },
    ]);
    const caller = appRouter.createCaller(createAuthedContext(7));
    const result = await caller.devices.list();
    expect(result.devices).toHaveLength(1);
    expect(mockedList).toHaveBeenCalledWith(7);
  });

  it("throws UNAUTHORIZED for list without a user", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.devices.list()).rejects.toThrow();
    expect(mockedList).not.toHaveBeenCalled();
  });

  it("returns the current device binding anonymously", async () => {
    mockedBinding.mockResolvedValue({ userId: 7 });
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.devices.current({ deviceId: "dev-1" });
    expect(result).toEqual({ deviceId: "dev-1", userId: 7 });
    expect(mockedBinding).toHaveBeenCalledWith("dev-1");
  });

  it("unbinds a device for the signed-in user", async () => {
    mockedUnbind.mockResolvedValue(true);
    const caller = appRouter.createCaller(createAuthedContext(7));
    const result = await caller.devices.unbind({ deviceId: "dev-1" });
    expect(result).toEqual({ unbound: true });
    expect(mockedUnbind).toHaveBeenCalledWith(7, "dev-1");
  });

  it("throws UNAUTHORIZED for unbind without a user", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.devices.unbind({ deviceId: "dev-1" })).rejects.toThrow();
    expect(mockedUnbind).not.toHaveBeenCalled();
  });

  it("rejects an oversized deviceId for current", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.devices.current({ deviceId: "x".repeat(129) }),
    ).rejects.toThrow();
    expect(mockedBinding).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Typecheck + run tests**

Run: `pnpm check` then `pnpm test -- tests/devices-router.test.ts`
Expected: 0 type errors; router tests green.

- [ ] **Step 4: Commit**

```bash
git add server/routers.ts tests/devices-router.test.ts
git commit -m "feat(devices): add devices router"
```

---

### Task 3: `lib/devices.ts` client helper

**Files:**
- New: `lib/devices.ts`

- [ ] **Step 1: Create `lib/devices.ts`**

Best-effort helper following `lib/server-notifications.ts` shape (4s timeout, try/catch, safe fallbacks, `createTRPCClient()`):

```ts
import { createTRPCClient } from "./trpc";
import type { DeviceInfo } from "../server/devices";

export type { DeviceInfo } from "../server/devices";

const TIMEOUT_MS = 4000;

export async function fetchDevices(): Promise<DeviceInfo[] | null> {
  try {
    const client = createTRPCClient();
    const result = await Promise.race([
      client.devices.list.query(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
    ]);
    return result?.devices ?? null;
  } catch {
    return null;
  }
}

export async function fetchCurrentDeviceBinding(): Promise<{
  userId: number | null;
} | null> {
  try {
    const { getDeviceId } = await import("./device-id");
    const deviceId = await getDeviceId();
    const client = createTRPCClient();
    const result = await Promise.race([
      client.devices.current.query({ deviceId }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
    ]);
    return result ? { userId: result.userId } : null;
  } catch {
    return null;
  }
}

export async function unbindDevice(deviceId: string): Promise<boolean> {
  try {
    const client = createTRPCClient();
    const result = await Promise.race([
      client.devices.unbind.mutate({ deviceId }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
    ]);
    return result?.unbound ?? false;
  } catch {
    return false;
  }
}

export async function bindCurrentDevice(): Promise<void> {
  try {
    const { registerPushToken } = await import("./push-token");
    const { syncServerNotifications } = await import("./server-notifications");
    await registerPushToken();
    await syncServerNotifications();
  } catch {
    // best-effort
  }
}
```

> **Plan clarification (spec deviation):** The spec says `fetchDevices` returns `[]` and `fetchCurrentDeviceBinding` returns `{ userId: null }` on error. The Settings UI spec requires a distinct "Couldn't load devices" error row with Retry, which is impossible to distinguish from "no devices" if errors collapse to `[]`. So these two helpers return `null` on failure (safe fallback, no crash) so the UI can render the error state. `unbindDevice` keeps the spec's `false` fallback.

- [ ] **Step 2: Typecheck**

Run: `pnpm check`
Expected: 0 errors (the tRPC client type picks up `devices` from `AppRouter` automatically).

- [ ] **Step 3: Commit**

```bash
git add lib/devices.ts
git commit -m "feat(devices): add client device management helper"
```

---

### Task 4: Settings "Device Management" section

**Files:**
- Modify: `app/(tabs)/settings.tsx`
- Modify: `components/ui/icon-symbol.tsx`

- [ ] **Step 1: Add the `iphone` icon mapping to `components/ui/icon-symbol.tsx`**

Add to the `MAPPING` object (SF Symbol → Material):

```ts
iphone: "smartphone",
```

- [ ] **Step 2: Add imports to `app/(tabs)/settings.tsx`**

Add to the existing imports:

```ts
import {
  fetchDevices,
  fetchCurrentDeviceBinding,
  unbindDevice,
  bindCurrentDevice,
} from "@/lib/devices";
import type { DeviceInfo } from "@/lib/devices";
import { getDeviceId } from "@/lib/device-id";
```

- [ ] **Step 3: Add module-level formatter helpers**

Add below `SectionHeader` (module scope, outside the component):

```ts
function platformLabel(platform: string | null): string {
  if (platform === "ios") return "iOS";
  if (platform === "android") return "Android";
  return "Unknown";
}

function formatLastSeen(lastSeenAt: number, now: number): string {
  if (!lastSeenAt) return "last seen unknown";
  const diff = Math.max(0, now - lastSeenAt);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "last seen just now";
  if (minutes < 60) return `last seen ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `last seen ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `last seen ${days}d ago`;
}
```

- [ ] **Step 4: Add state + load logic inside `SettingsScreen`**

Add state near the other `useState` calls:

```ts
const [devices, setDevices] = useState<DeviceInfo[] | null>(null);
const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
const [currentBinding, setCurrentBinding] = useState<{
  userId: number | null;
} | null>(null);
const [devicesLoading, setDevicesLoading] = useState(true);
const [bindingAction, setBindingAction] = useState(false);
```

Add the load callback (near `handleSyncNow`):

```ts
const loadDevices = useCallback(async () => {
  setDevicesLoading(true);
  const [deviceList, binding, deviceId] = await Promise.all([
    fetchDevices(),
    fetchCurrentDeviceBinding(),
    getDeviceId(),
  ]);
  setDevices(deviceList);
  setCurrentBinding(binding);
  setCurrentDeviceId(deviceId);
  setDevicesLoading(false);
}, []);
```

Add the load effect (near the existing sync effect):

```ts
useEffect(() => {
  if (!isAuthenticated) return;
  void loadDevices();
}, [isAuthenticated, loadDevices]);
```

Add the handlers:

```ts
const handleBindCurrentDevice = useCallback(async () => {
  if (Platform.OS !== "web")
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  setBindingAction(true);
  try {
    await bindCurrentDevice();
    await loadDevices();
  } finally {
    setBindingAction(false);
  }
}, [loadDevices]);

const handleUnbindDevice = useCallback(
  (device: DeviceInfo) => {
    Alert.alert(
      "Unbind Device",
      `Stop ${device.deviceId.slice(0, 12)}… from receiving your notifications and remove it from your account?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unbind",
          style: "destructive",
          onPress: async () => {
            if (Platform.OS !== "web")
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await unbindDevice(device.deviceId);
            await loadDevices();
          },
        },
      ],
    );
  },
  [loadDevices],
);
```

- [ ] **Step 5: Insert the Device Management section in the JSX**

Insert **after** the Account card's closing `</View>` (currently line 460) and **before** `<SectionHeader title="Notifications" />` (line 462):

```tsx
{isAuthenticated && user ? (
  <>
    <SectionHeader title="Device Management" />
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        marginHorizontal: 16,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: "hidden",
      }}
    >
      <SettingRow
        icon="iphone"
        label="This device"
        description={
          devicesLoading
            ? "Checking…"
            : currentBinding === null
              ? "Couldn't load device status"
              : currentBinding.userId === user.id
                ? "Bound to your account"
                : currentBinding.userId
                  ? "Bound to another account"
                  : "Not bound to any account"
        }
        descriptionColor={
          currentBinding?.userId === user.id
            ? colors.success
            : currentBinding && currentBinding.userId !== null
              ? colors.warning
              : undefined
        }
        right={
          bindingAction ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : currentBinding && currentBinding.userId !== user.id ? (
            <TouchableOpacity
              onPress={handleBindCurrentDevice}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 12,
                backgroundColor: colors.primary + "22",
              }}
            >
              <Text
                style={{
                  color: colors.primary,
                  fontSize: 13,
                  fontWeight: "600",
                }}
              >
                Bind to my account
              </Text>
            </TouchableOpacity>
          ) : undefined
        }
      />
      {devicesLoading ? (
        <View style={{ alignItems: "center", paddingVertical: 20 }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : devices === null ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: 14,
            paddingHorizontal: 16,
          }}
        >
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Couldn't load devices
          </Text>
          <TouchableOpacity onPress={loadDevices}>
            <Text
              style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}
            >
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      ) : devices.length === 0 ? (
        <View style={{ paddingVertical: 14, paddingHorizontal: 16 }}>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            No other devices bound to your account
          </Text>
        </View>
      ) : (
        devices.map((device, idx) => (
          <View
            key={device.deviceId}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderBottomWidth: idx < devices.length - 1 ? 1 : 0,
              borderBottomColor: colors.border,
            }}
          >
            <View style={{ flex: 1 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Text
                  style={{
                    color: colors.foreground,
                    fontWeight: "500",
                    fontSize: 15,
                  }}
                >
                  {device.deviceId.slice(0, 12)}
                  {device.deviceId.length > 12 ? "…" : ""}
                </Text>
                {device.deviceId === currentDeviceId && (
                  <View
                    style={{
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: 8,
                      backgroundColor: colors.primary + "22",
                    }}
                  >
                    <Text
                      style={{
                        color: colors.primary,
                        fontSize: 10,
                        fontWeight: "600",
                      }}
                    >
                      This device
                    </Text>
                  </View>
                )}
              </View>
              <Text
                style={{ color: colors.muted, fontSize: 12, marginTop: 1 }}
              >
                {platformLabel(device.platform)} ·{" "}
                {formatLastSeen(device.lastSeenAt, now)}
              </Text>
            </View>
            {device.deviceId !== currentDeviceId && (
              <TouchableOpacity
                onPress={() => handleUnbindDevice(device)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 12,
                  backgroundColor: colors.error + "22",
                }}
              >
                <Text
                  style={{
                    color: colors.error,
                    fontSize: 13,
                    fontWeight: "600",
                  }}
                >
                  Unbind
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ))
      )}
    </View>
  </>
) : null}
```

- [ ] **Step 6: Typecheck + lint**

Run: `pnpm check` then `pnpm lint`
Expected: 0 type errors; lint clean (only pre-existing `MODULE_TYPELESS_PACKAGE_JSON` warning).

- [ ] **Step 7: Commit**

```bash
git add app/\(tabs\)/settings.tsx components/ui/icon-symbol.tsx
git commit -m "feat(devices): add Device Management settings section"
```

---

### Task 5: Checkpoint

**Files:**
- Modify: `todo.md`

- [ ] **Step 1: Format**

Run: `pnpm exec prettier --write .`

- [ ] **Step 2: Gates**

Run: `pnpm check` (0 errors), `pnpm lint` (clean), `pnpm test` (full suite green — expect ~517 tests across 73 files).

- [ ] **Step 3: Update `todo.md`**

Append Phase 41:

```markdown
## Phase 41: Device Management

- [x] Server device management module (server/devices.ts): listDevicesForUser, getDeviceBinding, unbindDevice (memory/DB parallel)
- [x] devices router: list (protected), current (public), unbind (protected)
- [x] Client helper (lib/devices.ts): fetchDevices, fetchCurrentDeviceBinding, unbindDevice, bindCurrentDevice
- [x] Settings "Device Management" section: current-device status, bind action, bound-devices list, unbind with destructive confirm
```

- [ ] **Step 4: Commit + push**

```bash
git add todo.md
git commit -m "Checkpoint: v4.1: device management — list, bind, and unbind devices from Settings. TypeScript: 0 errors."
git push
```

> Note: this push also carries the v4.1 spec commit `8de3c32` (currently local-only; `origin/main` is at `b056bbb`).