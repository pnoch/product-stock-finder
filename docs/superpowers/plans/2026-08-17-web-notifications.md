# Web Notifications (Foreground Pull) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add foreground web notifications so price-drop/restock/reminder events display via the Web Notification API while the web app is open, enabled by a Settings toggle.

**Architecture:** A new `lib/web-notifications.ts` module owns web permission, display, and a 60s poll of `syncServerNotifications()` (the existing tRPC `notifications.pull`). `scheduleServerEventNotification` delegates to it on web; the Settings screen gets a web-only toggle; `_layout.tsx` calls `setupWebNotifications()` on launch. Pull-only — no service worker, no VAPID, no server changes.

**Tech Stack:** TypeScript strict, React Native `Platform`, vitest + jsdom (existing `// @vitest-environment jsdom` pattern), Web Notification API.

---

### Task 1: Add `webNotificationsEnabled` to `AppSettings`

**Files:**
- Modify: `lib/types.ts:112` (AppSettings interface)
- Modify: `lib/storage.ts:81-89` (DEFAULT_SETTINGS)
- Test: `tests/storage.test.ts:234-256`

- [ ] **Step 1: Write the failing test**

In `tests/storage.test.ts`, in the `describe("settings", ...)` block, extend the first test (line 235) to also assert the new default:

```ts
  it("returns defaults when nothing is stored", async () => {
    const s = await getSettings();
    expect(s.theme).toBe("auto");
    expect(s.displayCurrency).toBe("USD");
    expect(s.checkInterval).toBe("manual");
    expect(s.webNotificationsEnabled).toBe(false);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/storage.test.ts`
Expected: FAIL — `s.webNotificationsEnabled` is `undefined`, not `false`.

- [ ] **Step 3: Add the field to the type**

In `lib/types.ts`, in the `AppSettings` interface (line 112), add after `digestFrequency`:

```ts
  webNotificationsEnabled?: boolean;
```

- [ ] **Step 4: Add the default**

In `lib/storage.ts`, in `DEFAULT_SETTINGS` (lines 81-89), add:

```ts
    webNotificationsEnabled: false,
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test tests/storage.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/storage.ts tests/storage.test.ts
git commit -m "feat: add webNotificationsEnabled setting (default off)"
```

---

### Task 2: Create `lib/web-notifications.ts`

**Files:**
- Create: `lib/web-notifications.ts`
- Test: `tests/web-notifications.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/web-notifications.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const state = vi.hoisted(() => ({
  platform: "web",
  permission: "default" as NotificationPermission,
  requestResult: "granted" as NotificationPermission,
  displayed: [] as Array<{ title: string; body: string }>,
  syncCalls: 0,
  webNotificationsEnabled: false,
}));

vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return state.platform;
    },
  },
}));

vi.mock("./storage", () => ({
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
}));

vi.mock("./server-notifications", () => ({
  syncServerNotifications: vi.fn(async () => {
    state.syncCalls += 1;
  }),
}));

import {
  displayWebNotification,
  isWebNotificationsSupported,
  requestWebNotificationPermission,
  setWebNotificationsEnabled,
  setupWebNotifications,
} from "../lib/web-notifications";

class MockNotification {
  static permission: NotificationPermission = "default";
  static requestPermission = vi.fn(
    async (): Promise<NotificationPermission> => state.requestResult,
  );
  title: string;
  body: string;
  onclick: (() => void) | null = null;
  close = vi.fn();
  constructor(title: string, options?: NotificationOptions) {
    this.title = title;
    this.body = options?.body ?? "";
    state.displayed.push({ title: this.title, body: this.body });
  }
}

describe("web notifications", () => {
  beforeEach(async () => {
    state.platform = "web";
    state.permission = "default";
    state.requestResult = "granted";
    state.displayed = [];
    state.syncCalls = 0;
    state.webNotificationsEnabled = false;
    window.isSecureContext = true;
    MockNotification.permission = state.permission;
    MockNotification.requestPermission.mockClear();
    // @ts-expect-error jsdom has no Notification
    window.Notification = MockNotification;
    // Reset module-level poll timer between tests
    await setWebNotificationsEnabled(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("isWebNotificationsSupported is true on web with Notification", () => {
    expect(isWebNotificationsSupported()).toBe(true);
  });

  it("isWebNotificationsSupported is false when Notification is missing", () => {
    // @ts-expect-error remove Notification
    delete window.Notification;
    expect(isWebNotificationsSupported()).toBe(false);
  });

  it("isWebNotificationsSupported is false on native", () => {
    state.platform = "ios";
    expect(isWebNotificationsSupported()).toBe(false);
  });

  it("requestWebNotificationPermission returns the permission result", async () => {
    state.requestResult = "denied";
    const result = await requestWebNotificationPermission();
    expect(result).toBe("denied");
    expect(MockNotification.requestPermission).toHaveBeenCalled();
  });

  it("displayWebNotification constructs a Notification when granted", () => {
    state.permission = "granted";
    MockNotification.permission = "granted";
    displayWebNotification("Price drop!", "CRS804 is $89");
    expect(state.displayed).toEqual([
      { title: "Price drop!", body: "CRS804 is $89" },
    ]);
  });

  it("displayWebNotification no-ops when permission is not granted", () => {
    state.permission = "denied";
    MockNotification.permission = "denied";
    displayWebNotification("Price drop!", "CRS804 is $89");
    expect(state.displayed).toEqual([]);
  });

  it("setWebNotificationsEnabled(true) persists and starts polling when granted", async () => {
    vi.useFakeTimers();
    const result = await setWebNotificationsEnabled(true);
    expect(result).toBe("granted");
    expect(state.webNotificationsEnabled).toBe(true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(state.syncCalls).toBeGreaterThan(0);
  });

  it("setWebNotificationsEnabled(true) does not persist when denied", async () => {
    state.requestResult = "denied";
    const result = await setWebNotificationsEnabled(true);
    expect(result).toBe("denied");
    expect(state.webNotificationsEnabled).toBe(false);
  });

  it("setWebNotificationsEnabled(false) persists off and stops polling", async () => {
    vi.useFakeTimers();
    await setWebNotificationsEnabled(true);
    expect(state.syncCalls).toBe(0);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(state.syncCalls).toBeGreaterThan(0);
    await setWebNotificationsEnabled(false);
    expect(state.webNotificationsEnabled).toBe(false);
    const callsAfterDisable = state.syncCalls;
    await vi.advanceTimersByTimeAsync(120_000);
    expect(state.syncCalls).toBe(callsAfterDisable);
  });

  it("setupWebNotifications starts polling when enabled and granted", async () => {
    state.webNotificationsEnabled = true;
    state.permission = "granted";
    MockNotification.permission = "granted";
    vi.useFakeTimers();
    const cleanup = setupWebNotifications();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(state.syncCalls).toBeGreaterThan(0);
    cleanup();
  });

  it("setupWebNotifications does not poll when disabled", async () => {
    state.webNotificationsEnabled = false;
    vi.useFakeTimers();
    const cleanup = setupWebNotifications();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(state.syncCalls).toBe(0);
    cleanup();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/web-notifications.test.ts`
Expected: FAIL — module `../lib/web-notifications` does not exist (cannot find module).

- [ ] **Step 3: Write the implementation**

Create `lib/web-notifications.ts`:

```ts
import { Platform } from "react-native";
import { getSettings, saveSettings } from "./storage";
import { syncServerNotifications } from "./server-notifications";

const POLL_INTERVAL_MS = 60 * 1000;

function isWeb(): boolean {
  return Platform.OS === "web";
}

export function isWebNotificationsSupported(): boolean {
  if (!isWeb()) return false;
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    typeof window.Notification !== "undefined"
  );
}

export async function requestWebNotificationPermission(): Promise<
  "granted" | "denied" | "default"
> {
  if (!isWebNotificationsSupported()) return "denied";
  try {
    return await window.Notification.requestPermission();
  } catch {
    return "denied";
  }
}

export function displayWebNotification(title: string, body: string): void {
  if (!isWebNotificationsSupported()) return;
  if (window.Notification.permission !== "granted") return;
  try {
    const notification = new window.Notification(title, { body });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch (err) {
    console.warn("[web-notifications] display failed", err);
  }
}

let pollTimer: ReturnType<typeof setInterval> | null = null;
let focusListener: (() => void) | null = null;

function startPolling(): void {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    void syncServerNotifications();
  }, POLL_INTERVAL_MS);
  focusListener = () => {
    void syncServerNotifications();
  };
  window.addEventListener("focus", focusListener);
}

function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (focusListener) {
    window.removeEventListener("focus", focusListener);
    focusListener = null;
  }
}

export function setupWebNotifications(): () => void {
  if (!isWeb()) return () => {};
  void getSettings().then((settings) => {
    if (
      settings.webNotificationsEnabled &&
      window.Notification?.permission === "granted"
    ) {
      startPolling();
    }
  });
  return () => {
    stopPolling();
  };
}

export async function setWebNotificationsEnabled(
  enabled: boolean,
): Promise<"granted" | "denied" | "default"> {
  if (!isWeb()) return "denied";
  if (enabled) {
    const permission = await requestWebNotificationPermission();
    if (permission === "granted") {
      const settings = await getSettings();
      await saveSettings({ ...settings, webNotificationsEnabled: true });
      startPolling();
    }
    return permission;
  }
  const settings = await getSettings();
  await saveSettings({ ...settings, webNotificationsEnabled: false });
  stopPolling();
  return "denied";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/web-notifications.test.ts`
Expected: PASS (all 10 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/web-notifications.ts tests/web-notifications.test.ts
git commit -m "feat: web notification permission, display, and 60s pull polling"
```

---

### Task 3: Delegate `scheduleServerEventNotification` to web display

**Files:**
- Modify: `lib/notifications.ts:189-204`
- Test: `tests/schedule-server-event-web.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/schedule-server-event-web.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  platform: "web",
  displayed: [] as Array<{ title: string; body: string }>,
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
  scheduleNotificationAsync: vi.fn(),
}));

vi.mock("../lib/storage", () => ({
  recordDisplayedEventId: vi.fn(),
}));

vi.mock("../lib/web-notifications", () => ({
  displayWebNotification: vi.fn((title: string, body: string) => {
    state.displayed.push({ title, body });
  }),
}));

import { scheduleServerEventNotification } from "../lib/notifications";

describe("scheduleServerEventNotification on web", () => {
  beforeEach(() => {
    state.platform = "web";
    state.displayed = [];
  });

  it("delegates to displayWebNotification on web", async () => {
    await scheduleServerEventNotification("Price drop!", "CRS804 is $89");
    expect(state.displayed).toEqual([
      { title: "Price drop!", body: "CRS804 is $89" },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/schedule-server-event-web.test.ts`
Expected: FAIL — `state.displayed` is empty (web early-return).

- [ ] **Step 3: Modify `scheduleServerEventNotification`**

In `lib/notifications.ts`, add the import at the top (after line 3):

```ts
import { displayWebNotification } from "./web-notifications";
```

Then replace the web early-return in `scheduleServerEventNotification` (line 193):

```ts
export async function scheduleServerEventNotification(
  title: string,
  body: string,
): Promise<void> {
  if (Platform.OS === "web") {
    displayWebNotification(title, body);
    return;
  }
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

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/schedule-server-event-web.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full suite**

Run: `pnpm check && pnpm lint && pnpm test`
Expected: 0 TS errors, lint clean, all tests green (634 + new tests).

- [ ] **Step 6: Commit**

```bash
git add lib/notifications.ts tests/schedule-server-event-web.test.ts
git commit -m "feat: display server events via Web Notification API on web"
```

---

### Task 4: Add the web notifications toggle to Settings

**Files:**
- Modify: `app/(tabs)/settings.tsx`

- [ ] **Step 1: Add the import**

In `app/(tabs)/settings.tsx`, add after the `sendTestNotification` import (line 39):

```ts
import { setWebNotificationsEnabled } from "@/lib/web-notifications";
```

- [ ] **Step 2: Add the hint state**

In `app/(tabs)/settings.tsx`, near the other `useState` declarations (line 162), add:

```ts
const [webNotificationHint, setWebNotificationHint] = useState<string | null>(
  null,
);
```

- [ ] **Step 3: Add the web-only toggle row**

In `app/(tabs)/settings.tsx`, immediately after the "Enable Notifications" `SettingRow` (which closes at line 997), insert:

```tsx
          {Platform.OS === "web" && (
            <>
              <SettingRow
                icon="bell.badge.fill"
                label="Web Notifications"
                description="Show price and stock alerts in your browser"
                right={
                  <Switch
                    value={!!settings.webNotificationsEnabled}
                    onValueChange={(v) => {
                      void setWebNotificationsEnabled(v).then((permission) => {
                        if (v && permission !== "granted") {
                          setWebNotificationHint(
                            permission === "denied"
                              ? "Notifications are blocked in your browser settings."
                              : "Allow notifications in your browser to receive alerts.",
                          );
                        } else {
                          setWebNotificationHint(null);
                        }
                      });
                    }}
                    trackColor={{
                      false: colors.border,
                      true: colors.primary + "88",
                    }}
                    thumbColor={
                      settings.webNotificationsEnabled
                        ? colors.primary
                        : colors.muted
                    }
                  />
                }
              />
              {webNotificationHint && (
                <Text
                  style={{
                    color: colors.warning,
                    fontSize: 13,
                    paddingHorizontal: 16,
                    paddingBottom: 12,
                  }}
                >
                  {webNotificationHint}
                </Text>
              )}
            </>
          )}
```

- [ ] **Step 4: Verify**

Run: `pnpm check && pnpm lint`
Expected: 0 TS errors, lint clean. (`Text`, `Switch`, `Platform`, `colors` are already imported/available in this file.)

- [ ] **Step 5: Commit**

```bash
git add "app/(tabs)/settings.tsx"
git commit -m "feat: add web notifications toggle to Settings (web only)"
```

---

### Task 5: Wire `setupWebNotifications` in the root layout

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Add the import**

In `app/_layout.tsx`, add after the `background-price-check` import (line 27):

```ts
import { setupWebNotifications } from "@/lib/web-notifications";
```

- [ ] **Step 2: Add the web bootstrap effect**

In `app/_layout.tsx`, immediately after the native notification effect (which ends at line 111), insert:

```tsx
  // Web notifications: poll server events while the tab is open
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const stopWebNotifications = setupWebNotifications();
    return () => {
      stopWebNotifications();
    };
  }, []);
```

- [ ] **Step 3: Verify**

Run: `pnpm check && pnpm lint && pnpm test`
Expected: 0 TS errors, lint clean, all tests green.

- [ ] **Step 4: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat: start web notification polling on launch"
```

---

### Task 6: Final verification + checkpoint

**Files:**
- Modify: `todo.md`

- [ ] **Step 1: Full verification**

Run: `pnpm check && pnpm lint && pnpm test`
Expected: 0 TS errors, lint clean, full suite green (634 + 11 new = 645, DB-gated 9 skipped).

- [ ] **Step 2: Add the Phase entry to `todo.md`**

Append a new phase at the end of `todo.md`:

```markdown
## Phase 51: Web Notifications (v4.9)

- [x] Web notification permission + display via Web Notification API (lib/web-notifications.ts)
- [x] 60s pull polling of server events while the web tab is open (setupWebNotifications + focus listener)
- [x] scheduleServerEventNotification delegates to displayWebNotification on web
- [x] Settings gets a web-only "Web Notifications" toggle with permission-denied hint
- [x] webNotificationsEnabled AppSettings field (default off), syncs via existing settings sync
```

- [ ] **Step 3: Checkpoint commit**

```bash
git add todo.md
git commit -m "Checkpoint: v4.9: Web notifications (foreground pull). TypeScript: 0 errors."
```

- [ ] **Step 4: Push**

```bash
git push origin main
```