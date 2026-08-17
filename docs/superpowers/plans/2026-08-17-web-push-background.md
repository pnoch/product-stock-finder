# Web Push Background Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver server-queued notification events to the web target even when the tab is closed, via the standard Web Push API (VAPID + service worker + PushManager).

**Architecture:** The server sends events to web devices through the `web-push` library (VAPID-signed) using a stored `PushSubscription` JSON; a service worker (`public/sw.js`) shows the notification when no tab is focused. The v4.9 foreground pull stays as the open-tab delivery path; client-side `displayed_notification_event_ids` dedups across the two paths.

**Tech Stack:** `web-push` (server), Web Push API + service worker (client), Expo web `public/` static output, drizzle (MySQL), tRPC v11.

---

## File Structure

- **Create `server/web-push.ts`** — VAPID config + `sendWebPush(deviceId, subscription, event)` helper (prunes on 404/410).
- **Modify `drizzle/schema.ts`** — `device_push_tokens.token` `varchar(255)` → `text`.
- **Modify `server/push-notifications.ts`** — `upsertPushToken` platform union + `sendPushForDevice` platform routing.
- **Modify `server/routers.ts`** — `registerPushToken` platform enum + token max length.
- **Create `public/sw.js`** — push + notificationclick handlers.
- **Create `lib/web-push.ts`** — client-side SW registration, subscribe/unsubscribe, helpers.
- **Modify `lib/web-notifications.ts`** — toggle subscribes/unsubscribes; postMessage dedup listener.
- **Modify `app/_layout.tsx`** — register SW on web launch.
- **Create `scripts/generate-vapid-keys.js`** — prints a VAPID keypair.
- **Tests:** `tests/web-push-server.test.ts` (new), `tests/web-push.test.ts` (new), extend `tests/push-notifications.test.ts`, `tests/notifications-router.test.ts`, `tests/web-notifications.test.ts`.

---

### Task 1: Server — `web-push` dependency + `server/web-push.ts`

**Files:**
- Modify: `package.json` (add `web-push` dependency)
- Create: `server/web-push.ts`
- Create: `tests/web-push-server.test.ts`

- [ ] **Step 1: Add the `web-push` dependency**

Run: `pnpm add web-push@^3.6.7`
Expected: dependency added to `package.json` and lockfile updated.

- [ ] **Step 2: Write the failing test**

Create `tests/web-push-server.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const sent = vi.hoisted(
  () =>
    [] as Array<{ subscription: unknown; payload: string }>,
);
const sendError = vi.hoisted(() => ({ statusCode: 0 }));

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(async (subscription: unknown, payload: string) => {
      if (sendError.statusCode) {
        const err = new Error("push failed") as Error & { statusCode: number };
        err.statusCode = sendError.statusCode;
        throw err;
      }
      sent.push({ subscription, payload });
    }),
  },
}));

vi.mock("../server/push-notifications", () => ({
  pruneDeviceToken: vi.fn(async () => {}),
}));

import { sendWebPush } from "../server/web-push";
import { pruneDeviceToken } from "../server/push-notifications";

const subscription = {
  endpoint: "https://push.example.com/abc",
  keys: { p256dh: "p256dh-key", auth: "auth-key" },
};
const event = {
  id: "evt-1",
  title: "💸 Price Drop Alert!",
  body: "CRS804 is now $480.00!",
};

describe("web-push server", () => {
  beforeEach(() => {
    sent.length = 0;
    sendError.statusCode = 0;
    delete process.env.VAPID_SUBJECT;
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    vi.clearAllMocks();
  });

  it("no-ops when VAPID env vars are missing", async () => {
    await sendWebPush("dev-1", subscription, event);
    expect(sent).toHaveLength(0);
  });

  it("sends a VAPID-signed notification with the event payload", async () => {
    process.env.VAPID_SUBJECT = "mailto:test@example.com";
    process.env.VAPID_PUBLIC_KEY = "pub";
    process.env.VAPID_PRIVATE_KEY = "priv";
    await sendWebPush("dev-1", subscription, event);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.subscription).toEqual(subscription);
    expect(JSON.parse(sent[0]!.payload)).toEqual({
      title: event.title,
      body: event.body,
      eventId: "evt-1",
    });
  });

  it("prunes the device token on 404 (subscription gone)", async () => {
    process.env.VAPID_SUBJECT = "mailto:test@example.com";
    process.env.VAPID_PUBLIC_KEY = "pub";
    process.env.VAPID_PRIVATE_KEY = "priv";
    sendError.statusCode = 404;
    await sendWebPush("dev-1", subscription, event);
    expect(pruneDeviceToken).toHaveBeenCalledWith("dev-1");
  });

  it("prunes the device token on 410 (subscription gone)", async () => {
    process.env.VAPID_SUBJECT = "mailto:test@example.com";
    process.env.VAPID_PUBLIC_KEY = "pub";
    process.env.VAPID_PRIVATE_KEY = "priv";
    sendError.statusCode = 410;
    await sendWebPush("dev-1", subscription, event);
    expect(pruneDeviceToken).toHaveBeenCalledWith("dev-1");
  });

  it("warns without crashing on other errors", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env.VAPID_SUBJECT = "mailto:test@example.com";
    process.env.VAPID_PUBLIC_KEY = "pub";
    process.env.VAPID_PRIVATE_KEY = "priv";
    sendError.statusCode = 500;
    await expect(
      sendWebPush("dev-1", subscription, event),
    ).resolves.toBeUndefined();
    expect(pruneDeviceToken).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test tests/web-push-server.test.ts`
Expected: FAIL — `Cannot find module '../server/web-push'` (file not created yet).

- [ ] **Step 4: Write the minimal implementation**

Create `server/web-push.ts`:

```ts
import webPush from "web-push";

export interface WebPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface WebPushEvent {
  id: string;
  title: string;
  body: string;
}

export async function sendWebPush(
  deviceId: string,
  subscription: WebPushSubscription,
  event: WebPushEvent,
): Promise<void> {
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) return;
  webPush.setVapidDetails(subject, publicKey, privateKey);
  try {
    await webPush.sendNotification(
      subscription,
      JSON.stringify({ title: event.title, body: event.body, eventId: event.id }),
    );
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 404 || statusCode === 410) {
      const { pruneDeviceToken } = await import("./push-notifications");
      await pruneDeviceToken(deviceId);
    } else {
      console.warn(`[WebPush] Failed to send to device ${deviceId}:`, error);
    }
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test tests/web-push-server.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml server/web-push.ts tests/web-push-server.test.ts
git commit -m "feat: add VAPID web push sending to the server"
```

---

### Task 2: Server — subscription storage (schema + `upsertPushToken` + router)

**Files:**
- Modify: `drizzle/schema.ts` (`device_push_tokens.token`)
- Modify: `server/push-notifications.ts:20-43` (`upsertPushToken` platform union)
- Modify: `server/routers.ts:209-225` (`registerPushToken` input)
- Modify: `tests/notifications-router.test.ts:133-143`

- [ ] **Step 1: Write the failing test**

Update the "rejects an invalid platform" test in `tests/notifications-router.test.ts` (line 133) — platform `"web"` is now valid, so use `"desktop"` as the invalid value, and add a test that `"web"` is accepted:

```ts
  it("registers a web push subscription", async () => {
    mockedUpsertPush.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.notifications.registerPushToken({
      deviceId: "dev-1",
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
      null,
    );
  });

  it("rejects an invalid platform for registerPushToken", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.notifications.registerPushToken({
        deviceId: "dev-1",
        token: "ExponentPushToken[abc123]",
        platform: "desktop",
      } as never),
    ).rejects.toThrow();
    expect(mockedUpsertPush).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/notifications-router.test.ts`
Expected: FAIL — the new "registers a web push subscription" test rejects (platform `"web"` not in enum).

- [ ] **Step 3: Implement the changes**

In `drizzle/schema.ts`, change the `device_push_tokens` `token` column (line ~210) from `varchar` to `text`:

```ts
  token: text("token").notNull(),
```

In `server/push-notifications.ts`, widen the `upsertPushToken` platform union (line 23):

```ts
  platform: "ios" | "android" | "web",
```

In `server/routers.ts`, update the `registerPushToken` input (lines 210-215):

```ts
        z.object({
          deviceId: z.string().min(1).max(128),
          token: z.string().min(1).max(2048),
          platform: z.enum(["ios", "android", "web"]),
        }),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/notifications-router.test.ts tests/push-notifications.test.ts`
Expected: PASS. The `push-notifications.test.ts` "upserts the push token through the database" test still passes (it uses platform `"ios"`).

- [ ] **Step 5: Commit**

```bash
git add drizzle/schema.ts server/push-notifications.ts server/routers.ts tests/notifications-router.test.ts
git commit -m "feat: store web push subscriptions in device_push_tokens"
```

---

### Task 3: Server — route web subscriptions in `sendPushForDevice`

**Files:**
- Modify: `server/push-notifications.ts:45-93` (`sendPushForDevice`)
- Modify: `tests/push-notifications.test.ts` (add `web-push` mock + routing tests)

- [ ] **Step 1: Write the failing test**

In `tests/push-notifications.test.ts`, add a `vi.mock` for `../server/web-push` near the other mocks (after the `expo-server-sdk` mock at line 56):

```ts
vi.mock("../server/web-push", () => ({
  sendWebPush: vi.fn(async () => {}),
}));
```

Import `sendWebPush` alongside the other imports (line 58-64):

```ts
import { sendWebPush } from "../server/web-push";
```

Add these tests inside the top-level `describe("push-notifications", ...)` block (after the "no-ops when the stored token is not a valid Expo push token" test):

```ts
  it("routes web subscriptions through sendWebPush", async () => {
    mockedGetDb.mockResolvedValue(null);
    const subscription = {
      endpoint: "https://push.example.com/abc",
      keys: { p256dh: "p256dh-key", auth: "auth-key" },
    };
    await upsertPushToken("dev-1", JSON.stringify(subscription), "web");
    await sendPushForDevice("dev-1", [event]);
    expect(sendWebPush).toHaveBeenCalledWith("dev-1", subscription, event);
    expect(sent).toHaveLength(0);
  });

  it("does not send Expo push for web subscriptions", async () => {
    mockedGetDb.mockResolvedValue(null);
    await upsertPushToken(
      "dev-1",
      JSON.stringify({
        endpoint: "https://push.example.com/abc",
        keys: { p256dh: "p256dh-key", auth: "auth-key" },
      }),
      "web",
    );
    await sendPushForDevice("dev-1", [event]);
    expect(sent).toHaveLength(0);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/push-notifications.test.ts`
Expected: FAIL — `sendPushForDevice` ignores platform and no-ops on the non-Expo token, so `sendWebPush` is never called.

- [ ] **Step 3: Implement the change**

In `server/push-notifications.ts`, add the import at the top (after line 7):

```ts
import { sendWebPush, type WebPushSubscription } from "./web-push";
```

Replace the body of `sendPushForDevice` (lines 45-93) with:

```ts
export async function sendPushForDevice(
  deviceId: string,
  events: PushableEvent[],
): Promise<void> {
  if (events.length === 0) return;
  // Token lookup is best-effort: a failing read must not abort the caller's loop.
  let token: string | undefined;
  let platform: string | undefined;
  try {
    const db = await getDb();
    if (db) {
      const rows = await db
        .select({
          token: devicePushTokens.token,
          platform: devicePushTokens.platform,
        })
        .from(devicePushTokens)
        .where(eq(devicePushTokens.deviceId, deviceId));
      token = rows[0]?.token;
      platform = rows[0]?.platform;
    } else {
      const mem = memoryTokens.get(deviceId);
      token = mem?.token;
      platform = mem?.platform;
    }
  } catch (error) {
    console.warn(
      `[Push] Failed to read push token for device ${deviceId}:`,
      error,
    );
    return;
  }
  if (!token) return;
  if (platform === "web") {
    try {
      const subscription = JSON.parse(token) as WebPushSubscription;
      for (const event of events) {
        await sendWebPush(deviceId, subscription, event);
      }
    } catch (error) {
      console.warn(
        `[Push] Failed to send web push for device ${deviceId}:`,
        error,
      );
    }
    return;
  }
  if (!Expo.isExpoPushToken(token)) return;
  try {
    const expo = new Expo({ accessToken: process.env.EXPO_PUSH_ACCESS_TOKEN });
    const messages = events.map((e) => ({
      to: token,
      title: e.title,
      body: e.body,
      data: { eventId: e.id },
    }));
    for (const chunk of expo.chunkPushNotifications(messages)) {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      if (
        tickets.some(
          (t) =>
            t.status === "error" && t.details?.error === "DeviceNotRegistered",
        )
      ) {
        await pruneDeviceToken(deviceId);
      }
    }
  } catch (error) {
    console.warn(`[Push] Failed to send push for device ${deviceId}:`, error);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/push-notifications.test.ts tests/web-push-server.test.ts`
Expected: PASS — all existing Expo tests still pass (their db stubs return rows without `platform`, so `platform` is `undefined` → Expo path), plus the two new web routing tests.

- [ ] **Step 5: Commit**

```bash
git add server/push-notifications.ts tests/push-notifications.test.ts
git commit -m "feat: route web push subscriptions through VAPID sending"
```

---

### Task 4: Client — service worker `public/sw.js`

**Files:**
- Create: `public/sw.js`

- [ ] **Step 1: Write the service worker**

Create `public/sw.js`:

```js
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // malformed payloads are ignored
  }
  const { title = "Product Stock Finder", body = "", eventId = null } = data;
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const focused = clients.some((client) => client.focused);
      if (focused) return;
      await self.registration.showNotification(title, {
        body,
        data: { eventId },
      });
      for (const client of clients) {
        client.postMessage({ type: "web-push-shown", eventId });
      }
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clients) {
        if ("focus" in client) {
          client.focus();
          return;
        }
      }
      await self.clients.openWindow("/");
    })(),
  );
});
```

- [ ] **Step 2: Verify the file is valid JS**

Run: `node --check public/sw.js`
Expected: no output (syntax OK).

- [ ] **Step 3: Commit**

```bash
git add public/sw.js
git commit -m "feat: add web push service worker"
```

---

### Task 5: Client — `lib/web-push.ts` module

**Files:**
- Create: `lib/web-push.ts`
- Create: `tests/web-push.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/web-push.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  platform: "web",
  registered: false,
  subscription: null as unknown,
  mutateCalls: [] as Array<{
    deviceId: string;
    token: string;
    platform: string;
  }>,
}));

vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return state.platform;
    },
  },
}));

vi.mock("../lib/trpc", () => ({
  createTRPCClient: vi.fn(() => ({
    notifications: {
      registerPushToken: {
        mutate: vi.fn(
          async (input: { deviceId: string; token: string; platform: string }) => {
            state.mutateCalls.push(input);
          },
        ),
      },
    },
  })),
}));

vi.mock("../lib/device-id", () => ({
  getDeviceId: vi.fn(async () => "web-dev-1"),
}));

import {
  isPushSupported,
  urlBase64ToUint8Array,
  registerWebPushServiceWorker,
  subscribeWebPush,
  unsubscribeWebPush,
} from "../lib/web-push";

class MockServiceWorkerRegistration {
  pushManager = {
    subscribe: vi.fn(async () => state.subscription),
    getSubscription: vi.fn(async () => state.subscription),
  };
}

describe("web push client", () => {
  beforeEach(() => {
    state.platform = "web";
    state.registered = false;
    state.mutateCalls = [];
    state.subscription = {
      endpoint: "https://push.example.com/abc",
      keys: { p256dh: "p256dh-key", auth: "auth-key" },
    };
    process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY = "AQID";
    // @ts-expect-error jsdom lacks serviceWorker
    navigator.serviceWorker = {
      register: vi.fn(async () => {
        state.registered = true;
        return new MockServiceWorkerRegistration();
      }),
      getRegistration: vi.fn(async () => new MockServiceWorkerRegistration()),
    };
    // @ts-expect-error jsdom lacks PushManager
    window.PushManager = class {};
    // @ts-expect-error jsdom lacks Notification
    window.Notification = class {};
  });

  it("urlBase64ToUint8Array decodes base64url", () => {
    const bytes = urlBase64ToUint8Array("AQID");
    expect(Array.from(bytes)).toEqual([1, 2, 3]);
  });

  it("urlBase64ToUint8Array handles base64url padding", () => {
    const bytes = urlBase64ToUint8Array("AQI");
    expect(Array.from(bytes)).toEqual([1, 2]);
  });

  it("isPushSupported is true on web with PushManager and Notification", () => {
    expect(isPushSupported()).toBe(true);
  });

  it("isPushSupported is false on native", () => {
    state.platform = "ios";
    expect(isPushSupported()).toBe(false);
  });

  it("isPushSupported is false without PushManager", () => {
    // @ts-expect-error remove PushManager
    delete window.PushManager;
    expect(isPushSupported()).toBe(false);
  });

  it("registerWebPushServiceWorker registers /sw.js", async () => {
    const reg = await registerWebPushServiceWorker();
    expect(reg).not.toBeNull();
    expect(state.registered).toBe(true);
  });

  it("subscribeWebPush registers the subscription with the server", async () => {
    const result = await subscribeWebPush();
    expect(result).toBe(true);
    expect(state.mutateCalls).toHaveLength(1);
    expect(state.mutateCalls[0]!.platform).toBe("web");
    expect(state.mutateCalls[0]!.deviceId).toBe("web-dev-1");
    expect(JSON.parse(state.mutateCalls[0]!.token)).toEqual(state.subscription);
  });

  it("subscribeWebPush returns false when the VAPID key is missing", async () => {
    delete process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
    const result = await subscribeWebPush();
    expect(result).toBe(false);
  });

  it("unsubscribeWebPush unsubscribes the active subscription", async () => {
    const sub = { unsubscribe: vi.fn(async () => true) };
    state.subscription = sub;
    await unsubscribeWebPush();
    expect(sub.unsubscribe).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/web-push.test.ts`
Expected: FAIL — `Cannot find module '../lib/web-push'`.

- [ ] **Step 3: Write the minimal implementation**

Create `lib/web-push.ts`:

```ts
import { Platform } from "react-native";
import { getDeviceId } from "./device-id";
import { createTRPCClient } from "./trpc";

const SW_PATH = "/sw.js";

function isWeb(): boolean {
  return Platform.OS === "web";
}

export function isPushSupported(): boolean {
  if (!isWeb()) return false;
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof window !== "undefined" &&
    "PushManager" in window &&
    typeof window.Notification !== "undefined"
  );
}

export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Url = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64Url);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerWebPushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  try {
    return await navigator.serviceWorker.register(SW_PATH);
  } catch (error) {
    console.warn("[web-push] service worker registration failed", error);
    return null;
  }
}

export async function subscribeWebPush(): Promise<boolean> {
  if (!isPushSupported()) return false;
  const applicationServerKey = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
  if (!applicationServerKey) return false;
  try {
    let registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      registration = await registerWebPushServiceWorker();
    }
    if (!registration) return false;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(applicationServerKey),
    });
    const deviceId = await getDeviceId();
    const client = createTRPCClient();
    await client.notifications.registerPushToken.mutate({
      deviceId,
      token: JSON.stringify(subscription),
      platform: "web",
    });
    return true;
  } catch (error) {
    console.warn("[web-push] subscribe failed", error);
    return false;
  }
}

export async function unsubscribeWebPush(): Promise<void> {
  if (!isPushSupported()) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
    }
  } catch (error) {
    console.warn("[web-push] unsubscribe failed", error);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/web-push.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/web-push.ts tests/web-push.test.ts
git commit -m "feat: add web push subscription lifecycle client module"
```

---

### Task 6: Client — toggle wiring + SW registration + dedup listener

**Files:**
- Modify: `lib/web-notifications.ts`
- Modify: `app/_layout.tsx:28` (import) and `:114-121` (web effect)
- Modify: `tests/web-notifications.test.ts`

- [ ] **Step 1: Write the failing test**

In `tests/web-notifications.test.ts`:

1. Add a `web-push` mock after the `../lib/server-notifications` mock (line 36-40):

```ts
vi.mock("../lib/web-push", () => ({
  subscribeWebPush: vi.fn(async () => true),
  unsubscribeWebPush: vi.fn(async () => {}),
}));
```

2. Add `recordDisplayedEventId` to the storage mock (lines 21-34):

```ts
vi.mock("../lib/storage", () => ({
  getSettings: vi.fn(async () => ({
    theme: "auto",
    displayCurrency: "USD",
    checkInterval: "manual",
    notificationsEnabled: true,
    stockAlerts: true,
    priceAlerts: true,
    webNotificationsEnabled: state.webNotificationsEnabled,
  })),
  saveSettings: vi.fn(async (settings: Record<string, unknown>) => {
    state.webNotificationsEnabled = Boolean(settings.webNotificationsEnabled);
  }),
  recordDisplayedEventId: vi.fn(async (id: string) => {
    state.recordedEventIds.push(id);
  }),
}));
```

3. Add `recordedEventIds` to the `state` object (line 4-11):

```ts
const state = vi.hoisted(() => ({
  platform: "web",
  permission: "default" as NotificationPermission,
  requestResult: "granted" as NotificationPermission,
  displayed: [] as Array<{ title: string; body: string }>,
  syncCalls: 0,
  webNotificationsEnabled: false,
  recordedEventIds: [] as string[],
}));
```

4. Import the mocked functions and add a `navigator.serviceWorker` mock in `beforeEach`. Replace the import block (lines 42-48) with:

```ts
import {
  displayWebNotification,
  isWebNotificationsSupported,
  requestWebNotificationPermission,
  setWebNotificationsEnabled,
  setupWebNotifications,
} from "../lib/web-notifications";
import { subscribeWebPush, unsubscribeWebPush } from "../lib/web-push";
```

5. In `beforeEach` (line 67-81), add after the `window.Notification = MockNotification;` line:

```ts
    state.recordedEventIds = [];
    const serviceWorkerListeners: Record<
      string,
      Array<(event: MessageEvent) => void>
    > = {};
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        addEventListener: (
          type: string,
          cb: (event: MessageEvent) => void,
        ) => {
          (serviceWorkerListeners[type] ??= []).push(cb);
        },
        removeEventListener: (
          type: string,
          cb: (event: MessageEvent) => void,
        ) => {
          serviceWorkerListeners[type] = (
            serviceWorkerListeners[type] ?? []
          ).filter((f) => f !== cb);
        },
      },
    });
    (globalThis as Record<string, unknown>).__swListeners =
      serviceWorkerListeners;
```

6. Add these tests at the end of the `describe` block:

```ts
  it("setWebNotificationsEnabled(true) subscribes for background push", async () => {
    const result = await setWebNotificationsEnabled(true);
    expect(result).toBe("granted");
    expect(subscribeWebPush).toHaveBeenCalled();
  });

  it("setWebNotificationsEnabled(false) unsubscribes from background push", async () => {
    await setWebNotificationsEnabled(false);
    expect(unsubscribeWebPush).toHaveBeenCalled();
  });

  it("setupWebNotifications records displayed event ids from the service worker", async () => {
    state.webNotificationsEnabled = true;
    state.permission = "granted";
    MockNotification.permission = "granted";
    const cleanup = setupWebNotifications();
    const listeners = (
      globalThis as Record<string, unknown>
    ).__swListeners as Record<string, Array<(event: MessageEvent) => void>>;
    for (const cb of listeners.message ?? []) {
      cb(
        new MessageEvent("message", {
          data: { type: "web-push-shown", eventId: "evt-9" },
        }),
      );
    }
    expect(state.recordedEventIds).toContain("evt-9");
    cleanup();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/web-notifications.test.ts`
Expected: FAIL — `subscribeWebPush`/`unsubscribeWebPush` are never called (module not wired), and the dedup listener test finds no recorded event id.

- [ ] **Step 3: Implement the changes**

In `lib/web-notifications.ts`:

1. Update the storage import (line 2):

```ts
import { getSettings, saveSettings, recordDisplayedEventId } from "./storage";
```

2. Add the push-subscription helper and dedup listener after `displayWebNotification` (after line 43):

```ts
async function syncPushSubscription(enabled: boolean): Promise<void> {
  const { subscribeWebPush, unsubscribeWebPush } = await import("./web-push");
  if (enabled) {
    await subscribeWebPush();
  } else {
    await unsubscribeWebPush();
  }
}

let messageListener: ((event: MessageEvent) => void) | null = null;

function startPushDedupListener(): void {
  if (messageListener) return;
  messageListener = (event: MessageEvent) => {
    const data = event.data as { type?: string; eventId?: string } | null;
    if (data?.type === "web-push-shown" && data.eventId) {
      void recordDisplayedEventId(data.eventId);
    }
  };
  navigator.serviceWorker?.addEventListener("message", messageListener);
}

function stopPushDedupListener(): void {
  if (messageListener) {
    navigator.serviceWorker?.removeEventListener("message", messageListener);
    messageListener = null;
  }
}
```

3. In `setupWebNotifications` (lines 70-86), call `startPushDedupListener()` at the top and `stopPushDedupListener()` in the cleanup:

```ts
export function setupWebNotifications(): () => void {
  if (!isWeb()) return () => {};
  let disposed = false;
  startPushDedupListener();
  void getSettings().then((settings) => {
    if (disposed) return;
    if (
      settings.webNotificationsEnabled &&
      window.Notification?.permission === "granted"
    ) {
      startPolling();
    }
  });
  return () => {
    disposed = true;
    stopPolling();
    stopPushDedupListener();
  };
}
```

4. In `setWebNotificationsEnabled` (lines 88-105), add subscribe/unsubscribe calls:

```ts
export async function setWebNotificationsEnabled(
  enabled: boolean,
): Promise<"granted" | "denied" | "default"> {
  if (!isWeb()) return "denied";
  if (enabled) {
    const permission = await requestWebNotificationPermission();
    if (permission === "granted") {
      const settings = await getSettings();
      await saveSettings({ ...settings, webNotificationsEnabled: true });
      await syncPushSubscription(true);
      startPolling();
    }
    return permission;
  }
  const settings = await getSettings();
  await saveSettings({ ...settings, webNotificationsEnabled: false });
  await syncPushSubscription(false);
  stopPolling();
  return "denied";
}
```

In `app/_layout.tsx`:

1. Add the import after line 28 (`setupWebNotifications` import):

```ts
import { registerWebPushServiceWorker } from "@/lib/web-push";
```

2. Update the web notifications effect (lines 114-121):

```tsx
  // Web notifications: poll server events while the tab is open
  useEffect(() => {
    if (Platform.OS !== "web") return;
    void registerWebPushServiceWorker();
    const stopWebNotifications = setupWebNotifications();
    return () => {
      stopWebNotifications();
    };
  }, []);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/web-notifications.test.ts tests/web-push.test.ts`
Expected: PASS — all existing web-notification tests plus the three new ones.

- [ ] **Step 5: Commit**

```bash
git add lib/web-notifications.ts app/_layout.tsx tests/web-notifications.test.ts
git commit -m "feat: subscribe web push on toggle and dedup via service worker"
```

---

### Task 7: VAPID key generation script + docs

**Files:**
- Create: `scripts/generate-vapid-keys.js`
- Modify: `server/README.md` (VAPID env vars)
- Modify: `AGENTS.md` (Environment section)

- [ ] **Step 1: Write the script**

Create `scripts/generate-vapid-keys.js`:

```js
const webPush = require("web-push");

const keys = webPush.generateVAPIDKeys();
console.log("VAPID_SUBJECT=mailto:you@example.com");
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log("Add these to your server env, and EXPO_PUBLIC_VAPID_PUBLIC_KEY to your client env.");
```

- [ ] **Step 2: Verify it runs**

Run: `node scripts/generate-vapid-keys.js`
Expected: prints three env var lines (keys are random strings).

- [ ] **Step 3: Document the env vars**

In `server/README.md`, add a "Web Push (VAPID)" section:

```md
## Web Push (VAPID)

Web push delivery requires three env vars (generate a keypair with
`node scripts/generate-vapid-keys.js`):

- `VAPID_SUBJECT` — a `mailto:` contact for the push service
- `VAPID_PUBLIC_KEY` — the VAPID public key
- `VAPID_PRIVATE_KEY` — the VAPID private key

The client needs the matching public key bundled as
`EXPO_PUBLIC_VAPID_PUBLIC_KEY`. Without these vars, web push silently no-ops
and the app keeps working (foreground pull only).
```

In `AGENTS.md`, extend the Environment bullet:

```md
- Backend needs `DATABASE_URL`, `EXPO_PUBLIC_OAUTH_*`, `EXPO_PUBLIC_API_BASE_URL` for full functionality. Web push needs `VAPID_SUBJECT`/`VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` (server) and `EXPO_PUBLIC_VAPID_PUBLIC_KEY` (client); without them the app runs local-only and web notifications fall back to foreground pull.
```

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-vapid-keys.js server/README.md AGENTS.md
git commit -m "docs: add VAPID key generation script and env docs"
```

---

### Task 8: Final verification + checkpoint

**Files:**
- Modify: `todo.md` (Phase 52 entry)

- [ ] **Step 1: Run full verification**

Run: `pnpm check`
Expected: `tsc --noEmit` exits 0 (no TypeScript errors).

Run: `pnpm lint`
Expected: passes (only the pre-existing `MODULE_TYPELESS_PACKAGE_JSON` warning).

Run: `pnpm test`
Expected: all pass (previous baseline 646 passed / 9 skipped, plus the new web-push tests).

- [ ] **Step 2: Add the Phase 52 entry to `todo.md`**

Append at the end of `todo.md`:

```md
## Phase 52: Web Push Background Delivery (v5.0)

- [x] Server sends web pushes via web-push (VAPID) with 404/410 token pruning (server/web-push.ts)
- [x] device_push_tokens stores web PushSubscription JSON (token column → text; platform "web")
- [x] sendPushForDevice routes platform "web" to sendWebPush; Expo path unchanged
- [x] public/sw.js service worker shows notifications when no tab is focused; notificationclick focuses/opens
- [x] lib/web-push.ts: SW registration, PushManager subscribe/unsubscribe, base64url helper
- [x] Web Notifications toggle subscribes/unsubscribes; SW-shown event ids dedup the foreground pull
- [x] scripts/generate-vapid-keys.js + VAPID env docs
```

- [ ] **Step 3: Commit the checkpoint**

```bash
git add todo.md
git commit -m "Checkpoint: v5.0: Web push background delivery. TypeScript: 0 errors."
```

- [ ] **Step 4: Push**

```bash
git push origin main
```

Expected: all feature commits + checkpoint pushed to `origin/main`.

---

## Self-Review Notes

- **Spec coverage:** §1 (web-push dep + VAPID + script + docs) → Tasks 1, 7. §2 (schema + platform + router) → Task 2. §3 (delivery routing, no delivery row) → Task 3. §4 (SW) → Task 4. §5 (client module + postMessage listener) → Tasks 5, 6. §6 (toggle wiring + SW registration) → Task 6. Dedup table → Task 6 (listener) + Task 4 (SW focused-client skip). Testing section → Tasks 1-6. Out-of-scope items are not implemented.
- **Type consistency:** `WebPushSubscription`/`WebPushEvent` defined in Task 1, used in Tasks 3/5. `sendWebPush(deviceId, subscription, event)` signature consistent. `subscribeWebPush`/`unsubscribeWebPush`/`registerWebPushServiceWorker`/`isPushSupported`/`urlBase64ToUint8Array` all defined in Task 5, used in Task 6.
- **Known tradeoff:** dynamic import of `./web-push` in `lib/web-notifications.ts` keeps tRPC out of the native module graph (matches the existing `server-notifications.ts:65` pattern).