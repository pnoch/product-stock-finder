# Mobile Notification Dedup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop mobile users from seeing the same server notification twice (Expo push banner + local pull render) by recording the `eventId` of push notifications the app observes and skipping the local render for already-displayed events.

**Architecture:** Client-side `eventId` dedup. The mobile app persists the ids of notification events already shown (via expo-notifications received/response listeners + last-response capture) in AsyncStorage under `displayed_notification_event_ids`. The launch pull sync (`runSyncServerNotifications`) loads that set and skips `scheduleServerEventNotification` for pulled events whose id is already recorded, while still reconciling local state. Zero server/schema changes; pull remains the correctness guarantee.

**Tech Stack:** TypeScript 5.9 (strict), Expo SDK 54, expo-notifications, AsyncStorage (`lib/storage.ts` readList/enqueue pattern), vitest, NativeWind (untouched).

---

## File Structure

- Modify: `lib/storage.ts` — add `DISPLAYED_EVENT_IDS` key + `getDisplayedEventIds()` / `recordDisplayedEventId()` methods, export from `createStorage` return + `defaultStorage` destructure.
- Modify: `lib/notifications.ts` — add `setupPushEventTracking()` using static `recordDisplayedEventId` import.
- Modify: `lib/server-notifications.ts` — load displayed set in `runSyncServerNotifications`, skip render for recorded ids, record after rendering.
- Modify: `app/_layout.tsx` — call `setupPushEventTracking()` in the launch notification effect with teardown.
- Modify: `tests/storage.test.ts` — add "displayed event ids" describe block + import entries.
- Create: `tests/push-event-tracking.test.ts` — mocks expo-notifications, react-native, lib/storage.
- Create: `tests/sync-server-notifications.test.ts` — mocks trpc, device-id, storage, notifications; verifies dedup + reconcile.
- Modify: `todo.md` — append Phase 34 section.

## Test baseline (must all stay green)

- `pnpm check` — 0 TypeScript errors
- `pnpm lint` — clean (pre-existing `MODULE_TYPELESS_PACKAGE_JSON` warning only)
- `pnpm test` — all root tests
- `pnpm check:desktop` + `pnpm --filter desktop test` — desktop gates

---

### Task 1: Storage — displayed event id store

**Files:**
- Modify: `lib/storage.ts`
- Test: `tests/storage.test.ts`

- [ ] **Step 1: Write the failing tests**

In `tests/storage.test.ts`, add `getDisplayedEventIds` and `recordDisplayedEventId` to the import list at line 49-50 (next to `getSyncMeta`, `saveSyncMeta`):

```ts
  getSyncMeta,
  saveSyncMeta,
  getDisplayedEventIds,
  recordDisplayedEventId,
  setItemSyncMeta,
```

Append a new describe block at the end of the file (after the `clearAllData` describe):

```ts
describe("displayed event ids", () => {
  it("returns an empty list by default", async () => {
    expect(await getDisplayedEventIds()).toEqual([]);
  });

  it("records ids and dedupes repeats", async () => {
    await recordDisplayedEventId("e1");
    await recordDisplayedEventId("e1");
    await recordDisplayedEventId("e2");
    expect(await getDisplayedEventIds()).toEqual(["e1", "e2"]);
  });

  it("keeps only the most recent 200 ids", async () => {
    for (let i = 0; i < 250; i++) {
      await recordDisplayedEventId(`e${i}`);
    }
    const ids = await getDisplayedEventIds();
    expect(ids).toHaveLength(200);
    expect(ids[0]).toBe("e50");
    expect(ids[199]).toBe("e249");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/storage.test.ts`
Expected: FAIL — `getDisplayedEventIds is not a function` (not yet exported from `lib/storage.ts`).

- [ ] **Step 3: Implement the storage methods**

In `lib/storage.ts`:

1. Add the key to the `KEYS` map (line 30, after `SYNC_META`):

```ts
    SYNC_META: "sync_meta",
    DISPLAYED_EVENT_IDS: "displayed_notification_event_ids",
```

2. Add a new section after the `Sync Meta` section (after the `clearItemSyncMeta` function ending at line 440):

```ts
  // ─── Displayed Event Ids (notification dedup) ──────────────────────────────

  async function getDisplayedEventIds(): Promise<string[]> {
    return readList<string>(KEYS.DISPLAYED_EVENT_IDS);
  }

  async function recordDisplayedEventId(id: string): Promise<void> {
    await enqueue(KEYS.DISPLAYED_EVENT_IDS, async () => {
      const ids = await getDisplayedEventIds();
      if (!ids.includes(id)) {
        ids.push(id);
        if (ids.length > 200) ids.splice(0, ids.length - 200);
        await adapter.setItem(KEYS.DISPLAYED_EVENT_IDS, JSON.stringify(ids));
      }
    });
  }
```

3. Add both to the `createStorage` return object (after `clearItemSyncMeta` at line 492):

```ts
    getDisplayedEventIds,
    recordDisplayedEventId,
```

4. Add both to the `defaultStorage` destructure (after `clearItemSyncMeta` at line 537):

```ts
  getDisplayedEventIds,
  recordDisplayedEventId,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/storage.test.ts`
Expected: PASS — 3 new tests green; existing storage tests unaffected.

- [ ] **Step 5: Commit**

```bash
git add lib/storage.ts tests/storage.test.ts
git commit -m "feat(storage): track displayed notification event ids"
```

---

### Task 2: Push event tracking

**Files:**
- Modify: `lib/notifications.ts`
- Create: `tests/push-event-tracking.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/push-event-tracking.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  platform: "ios",
  recorded: [] as string[],
  receivedHandler: null as null | ((notification: unknown) => void),
  responseHandler: null as null | ((response: unknown) => void),
  lastResponse: null as unknown,
}));

vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return state.platform;
    },
  },
}));

vi.mock("expo-notifications", () => ({
  setNotificationHandler: vi.fn(),
  addNotificationReceivedListener: vi.fn(
    (handler: (notification: unknown) => void) => {
      state.receivedHandler = handler;
      return { remove: vi.fn() };
    },
  ),
  addNotificationResponseReceivedListener: vi.fn(
    (handler: (response: unknown) => void) => {
      state.responseHandler = handler;
      return { remove: vi.fn() };
    },
  ),
  getLastNotificationResponseAsync: vi.fn(async () => state.lastResponse),
}));

vi.mock("../lib/storage", () => ({
  recordDisplayedEventId: vi.fn(async (id: string) => {
    state.recorded.push(id);
  }),
}));

import { setupPushEventTracking } from "../lib/notifications";

describe("setupPushEventTracking", () => {
  it("records the eventId of a received push notification", () => {
    state.platform = "ios";
    const stop = setupPushEventTracking();
    state.receivedHandler?.({
      request: { content: { data: { eventId: "e1" } } },
    });
    expect(state.recorded).toEqual(["e1"]);
    stop();
  });

  it("records the eventId of a notification the user tapped", () => {
    state.platform = "ios";
    const stop = setupPushEventTracking();
    state.responseHandler?.({
      notification: { request: { content: { data: { eventId: "e2" } } } },
    });
    expect(state.recorded).toEqual(["e2"]);
    stop();
  });

  it("records the eventId of the notification that launched the app", async () => {
    state.platform = "ios";
    state.lastResponse = {
      notification: { request: { content: { data: { eventId: "e3" } } } },
    };
    setupPushEventTracking();
    await vi.waitFor(() => expect(state.recorded).toEqual(["e3"]));
  });

  it("ignores notifications without an eventId", () => {
    state.platform = "ios";
    const stop = setupPushEventTracking();
    state.receivedHandler?.({ request: { content: { data: {} } } });
    expect(state.recorded).toEqual([]);
    stop();
  });

  it("is a no-op on web and does not register listeners", () => {
    state.platform = "web";
    const stop = setupPushEventTracking();
    expect(state.receivedHandler).toBeNull();
    expect(state.recorded).toEqual([]);
    stop();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/push-event-tracking.test.ts`
Expected: FAIL — `setupPushEventTracking is not a function` (not yet exported from `lib/notifications.ts`).

- [ ] **Step 3: Implement the minimal code**

In `lib/notifications.ts`:

1. Add a static import at the top (after line 2, `import { Platform } from "react-native";`):

```ts
import { recordDisplayedEventId } from "./storage";
```

2. Add `setupPushEventTracking` at the end of the file (after `scheduleServerEventNotification`):

```ts
// ─── Push Event Tracking (dedup) ──────────────────────────────────────────────
// Records the eventIds of push notifications the app receives or the user
// taps, so the launch pull sync can skip re-rendering them locally.
export function setupPushEventTracking(): () => void {
  if (Platform.OS === "web") return () => {};
  const subscriptions: Array<{ remove: () => void }> = [];
  const recordEventId = (data: unknown): void => {
    const eventId = (data as { eventId?: unknown } | undefined)?.eventId;
    if (typeof eventId === "string" && eventId) {
      void recordDisplayedEventId(eventId);
    }
  };
  try {
    subscriptions.push(
      Notifications.addNotificationReceivedListener((notification) => {
        recordEventId(notification.request.content.data);
      }),
    );
    subscriptions.push(
      Notifications.addNotificationResponseReceivedListener((response) => {
        recordEventId(response.notification.request.content.data);
      }),
    );
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) recordEventId(response.notification.request.content.data);
    });
  } catch {
    // push event tracking is best-effort
  }
  return () => {
    for (const sub of subscriptions) {
      try {
        sub.remove();
      } catch {
        // ignore
      }
    }
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/push-event-tracking.test.ts`
Expected: PASS — 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/notifications.ts tests/push-event-tracking.test.ts
git commit -m "feat(notifications): track push event ids for dedup"
```

---

### Task 3: Sync dedup — skip already-displayed events

**Files:**
- Modify: `lib/server-notifications.ts`
- Create: `tests/sync-server-notifications.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/sync-server-notifications.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  deviceId: "dev-1",
  alerts: [] as Array<Record<string, unknown>>,
  stockWatches: [] as Array<Record<string, unknown>>,
  dateReminders: [] as Array<Record<string, unknown>>,
  pulledEvents: [] as Array<Record<string, unknown>>,
  displayed: [] as string[],
  recorded: [] as string[],
  rendered: [] as Array<Record<string, unknown>>,
  deactivated: [] as Array<Record<string, unknown>>,
}));

vi.mock("../lib/trpc", () => ({
  createTRPCClient: vi.fn(() => ({
    notifications: {
      uploadConfig: { mutate: vi.fn(async () => ({ accepted: true })) },
      pull: { query: vi.fn(async () => ({ events: state.pulledEvents })) },
    },
  })),
}));

vi.mock("../lib/device-id", () => ({
  getDeviceId: vi.fn(async () => state.deviceId),
}));

vi.mock("../lib/storage", () => ({
  getAlerts: vi.fn(async () => state.alerts),
  getStockWatches: vi.fn(async () => state.stockWatches),
  getBackOrderReminders: vi.fn(async () => state.dateReminders),
  getDisplayedEventIds: vi.fn(async () => state.displayed),
  recordDisplayedEventId: vi.fn(async (id: string) => {
    state.recorded.push(id);
  }),
  deactivateAlert: vi.fn(async (alertId: string, price: number) => {
    state.deactivated.push({ alertId, price });
  }),
  removeStockWatch: vi.fn(async () => {}),
  removeBackOrderReminder: vi.fn(async () => {}),
}));

vi.mock("../lib/notifications", () => ({
  scheduleServerEventNotification: vi.fn(async (title: string, body: string) => {
    state.rendered.push({ title, body });
  }),
}));

import { syncServerNotifications } from "../lib/server-notifications";

const priceDropEvent = {
  id: "evt-1",
  type: "price_drop",
  alertId: "a1",
  triggeredPrice: 480,
  title: "Price dropped",
  body: "CRS804 below $500",
  createdAt: 1,
};

const activeAlert = {
  id: "a1",
  productId: "p1",
  targetPrice: 500,
  currency: "USD",
  isActive: true,
  createdAt: "2026-01-01",
};

beforeEach(() => {
  state.alerts = [activeAlert];
  state.stockWatches = [];
  state.dateReminders = [];
  state.pulledEvents = [];
  state.displayed = [];
  state.recorded = [];
  state.rendered = [];
  state.deactivated = [];
});

describe("syncServerNotifications dedup", () => {
  it("renders and records a new event", async () => {
    state.pulledEvents = [priceDropEvent];
    await syncServerNotifications();
    expect(state.rendered).toHaveLength(1);
    expect(state.recorded).toEqual(["evt-1"]);
    expect(state.deactivated).toEqual([{ alertId: "a1", price: 480 }]);
  });

  it("skips rendering an already-displayed event but still reconciles", async () => {
    state.displayed = ["evt-1"];
    state.pulledEvents = [priceDropEvent];
    await syncServerNotifications();
    expect(state.rendered).toHaveLength(0);
    expect(state.recorded).toEqual([]);
    expect(state.deactivated).toEqual([{ alertId: "a1", price: 480 }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/sync-server-notifications.test.ts`
Expected: FAIL — the second test: `expected 0, received 1` in `expect(state.rendered).toHaveLength(0)` (current code renders unconditionally for non-stale events).

- [ ] **Step 3: Implement the dedup**

In `lib/server-notifications.ts`:

1. Extend the storage dynamic-import destructure at line 50:

```ts
    const {
      getAlerts,
      getStockWatches,
      getBackOrderReminders,
      getDisplayedEventIds,
      recordDisplayedEventId,
    } = await import("./storage");
```

2. Load the displayed set and gate rendering in the pull loop (lines 88-96). Replace:

```ts
    const events = await pullNotificationEvents(deviceId);
    for (const event of events) {
      const stalePriceDrop =
        event.type === "price_drop" && event.alertId && !activeAlertIds.has(event.alertId);
      if (!stalePriceDrop) {
        await scheduleServerEventNotification(event.title, event.body);
      }
      await reconcileEvent(event);
    }
```

with:

```ts
    const displayedIds = new Set(await getDisplayedEventIds());
    const events = await pullNotificationEvents(deviceId);
    for (const event of events) {
      const stalePriceDrop =
        event.type === "price_drop" && event.alertId && !activeAlertIds.has(event.alertId);
      if (!stalePriceDrop && !displayedIds.has(event.id)) {
        await scheduleServerEventNotification(event.title, event.body);
        await recordDisplayedEventId(event.id);
      }
      await reconcileEvent(event);
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/sync-server-notifications.test.ts`
Expected: PASS — both tests green (new event renders + records; displayed event skipped but reconciled).

- [ ] **Step 5: Commit**

```bash
git add lib/server-notifications.ts tests/sync-server-notifications.test.ts
git commit -m "feat(notifications): dedup locally rendered server events"
```

---

### Task 4: Wire push tracking at launch + full verification + checkpoint

**Files:**
- Modify: `app/_layout.tsx`
- Modify: `todo.md`

- [ ] **Step 1: Add the import**

In `app/_layout.tsx`, extend the notifications import (lines 11-14):

```ts
import {
  requestNotificationPermissions,
  setupAndroidNotificationChannel,
  setupPushEventTracking,
} from "@/lib/notifications";
```

- [ ] **Step 2: Wire into the launch notification effect**

Replace the notification effect (lines 75-92):

```ts
  // Request notification permissions and set up Android channel on first load
  useEffect(() => {
    if (Platform.OS === "web") return;
    let stopPushTracking: (() => void) | null = null;
    setupAndroidNotificationChannel().then(async () => {
      // Only prompt for notification permission if the user has enabled notifications
      const settings = await getSettings();
      if (settings.notificationsEnabled) {
        await requestNotificationPermissions();
      }
      // Register background price-check task
      registerPriceCheckTask();
      // Run a foreground check immediately on app launch
      checkPriceDropsNow();
      // Record eventIds from push notifications for dedup
      stopPushTracking = setupPushEventTracking();
      // Register for Expo push delivery (best-effort)
      void registerPushToken();
      // Pull any server-queued notification events
      void syncServerNotifications();
    });
    return () => {
      stopPushTracking?.();
    };
  }, []);
```

- [ ] **Step 3: Run the full verification gates**

Run each and confirm:

```bash
pnpm check
# Expected: 0 TypeScript errors

pnpm lint
# Expected: clean (pre-existing MODULE_TYPELESS_PACKAGE_JSON warning only)

pnpm test
# Expected: all root tests pass (66 files / ~423 tests — 10 new: 3 storage + 5 push-tracking + 2 sync)

pnpm check:desktop
# Expected: 0 errors

pnpm --filter desktop test
# Expected: 35 tests pass
```

If any gate fails, fix and re-run before committing.

- [ ] **Step 4: Update todo.md**

Append a new phase section at the end of `todo.md`:

```md
## Phase 34: Mobile Notification Dedup

- [x] displayed_notification_event_ids storage key (getDisplayedEventIds / recordDisplayedEventId, capped 200)
- [x] setupPushEventTracking (received + response listeners + last-response capture)
- [x] Launch pull sync skips re-render for already-displayed events (still reconciles)
- [x] Launch wiring in app/_layout.tsx
```

- [ ] **Step 5: Commit the checkpoint**

```bash
git add app/_layout.tsx todo.md
git commit -m "Checkpoint: v3.13: Dedup duplicate mobile notifications (eventId tracking, skip re-render on pull). TypeScript: 0 errors."
```

---

## Self-Review Notes

- **Spec coverage:** storage key (Task 1), push tracking (Task 2), pull dedup + reconcile (Task 3), layout wiring + verification (Task 4) — all four spec components covered; testing requirements covered in each task.
- **Static import of `./storage` in `lib/notifications.ts` is test-safe:** no existing test loads the real `lib/notifications` module (all mock it); the new push-event-tracking test mocks `../lib/storage`. `tests/notifications.test.ts` tests the server engine only.
- **Type consistency:** `getDisplayedEventIds(): Promise<string[]>` and `recordDisplayedEventId(id: string): Promise<void>` — identical names/signatures across storage, sync, and tests.
- **No placeholders:** every step contains exact code, paths, commands, and expected output.
