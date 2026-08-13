# In-App Notification Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent, offline-capable notification history (price drops, restocks, reminders) as a third "Notifications" segment in the Alerts tab, with unread state, tap-to-product navigation, and mark-as-read.

**Architecture:** Local-first. `runSyncServerNotifications` in `lib/server-notifications.ts` records every pulled `NotificationEvent` into a new AsyncStorage collection (`notification_history`) via `recordNotificationEvent`. A new `components/notification-center.tsx` component reads that store and is rendered when the Alerts tab's `activeTab` is `"notifications"`. No server, migration, or desktop changes.

**Tech Stack:** Expo SDK 54 / RN 0.81, TypeScript 5.9 strict, AsyncStorage, NativeWind + inline styles via `useColors()`, IconSymbol, vitest (node environment — no component test infra; UI verified via `pnpm check` + `pnpm lint`).

**Spec:** `docs/superpowers/specs/2026-08-13-notification-center-design.md`

---

### Task 1: Notification history storage collection

Add the `NotificationHistoryEntry` type and the storage methods with tests. TDD: write failing tests, verify fail, implement, verify pass.

**Files:**
- Modify: `lib/types.ts` (after `BackOrderReminder`, line ~92)
- Modify: `lib/storage.ts` (KEYS ~line 31, methods after line 458, return object ~line 480, default destructure ~line 527)
- Test: `tests/storage.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/storage.test.ts`. First extend the imports (lines 27-58):

```ts
import {
  getWatchlist,
  saveWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  updateProductListings,
  refreshWatchlistPrices,
  getAlerts,
  saveAlerts,
  addAlert,
  removeAlert,
  toggleAlert,
  rearmAlert,
  getSettings,
  saveSettings,
  getBackOrderReminders,
  addBackOrderReminder,
  removeBackOrderReminder,
  getStockWatches,
  addStockWatch,
  removeStockWatch,
  updateStockWatchStatus,
  getSyncMeta,
  saveSyncMeta,
  getDisplayedEventIds,
  recordDisplayedEventId,
  getNotificationHistory,
  recordNotificationEvent,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadNotificationCount,
  setItemSyncMeta,
  markItemDeleted,
  clearItemSyncMeta,
  clearAllData,
  createStorage,
} from "../lib/storage";
```

Add `NotificationHistoryEntry` to the type imports at the top of the file (lines 2-8):

```ts
import type {
  Product,
  PriceAlert,
  AppSettings,
  BackOrderReminder,
  DistributorListing,
  NotificationHistoryEntry,
} from "../lib/types";
```

Add a helper after `makeReminder` (line 103):

```ts
function makeHistoryEntry(
  id: string,
  overrides: Partial<NotificationHistoryEntry> = {},
): NotificationHistoryEntry {
  return {
    id,
    type: "price_drop",
    title: "Price dropped",
    body: "CRS804 below $500",
    productId: "p1",
    createdAt: 1000,
    read: false,
    ...overrides,
  };
}
```

Append this describe block at the end of the file (after the last existing block):

```ts
describe("notification history", () => {
  it("returns an empty array and zero unread when nothing is stored", async () => {
    expect(await getNotificationHistory()).toEqual([]);
    expect(await getUnreadNotificationCount()).toBe(0);
  });

  it("recordNotificationEvent prepends new entries newest-first as unread", async () => {
    await recordNotificationEvent(makeHistoryEntry("e1"));
    await recordNotificationEvent(makeHistoryEntry("e2"));
    const list = await getNotificationHistory();
    expect(list.map((e) => e.id)).toEqual(["e2", "e1"]);
    expect(list[0]!.read).toBe(false);
  });

  it("recordNotificationEvent does not duplicate an existing id and preserves read state", async () => {
    await recordNotificationEvent(makeHistoryEntry("e1"));
    await markNotificationRead("e1");
    await recordNotificationEvent(makeHistoryEntry("e1"));
    const list = await getNotificationHistory();
    expect(list).toHaveLength(1);
    expect(list[0]!.read).toBe(true);
  });

  it("recordNotificationEvent caps the list at 200 entries keeping the newest", async () => {
    for (let i = 0; i < 205; i++) {
      await recordNotificationEvent(makeHistoryEntry(`e${i}`));
    }
    const list = await getNotificationHistory();
    expect(list).toHaveLength(200);
    expect(list[0]!.id).toBe("e204");
  });

  it("markNotificationRead marks only the matching entry", async () => {
    await recordNotificationEvent(makeHistoryEntry("e1"));
    await recordNotificationEvent(makeHistoryEntry("e2"));
    await markNotificationRead("e1");
    const list = await getNotificationHistory();
    expect(list.find((e) => e.id === "e1")!.read).toBe(true);
    expect(list.find((e) => e.id === "e2")!.read).toBe(false);
    expect(await getUnreadNotificationCount()).toBe(1);
  });

  it("markAllNotificationsRead marks every entry read", async () => {
    await recordNotificationEvent(makeHistoryEntry("e1"));
    await recordNotificationEvent(makeHistoryEntry("e2"));
    await markAllNotificationsRead();
    expect(await getUnreadNotificationCount()).toBe(0);
  });

  it("clearAllData removes notification history", async () => {
    await recordNotificationEvent(makeHistoryEntry("e1"));
    await clearAllData();
    expect(await getNotificationHistory()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/storage.test.ts`
Expected: FAIL — the new functions are not exported (`recordNotificationEvent` is not a function / cannot be imported).

- [ ] **Step 3: Add the type and implement the storage methods**

In `lib/types.ts`, after the `BackOrderReminder` interface (line 92) and before `AppSettings`:

```ts
export interface NotificationHistoryEntry {
  id: string;
  type: "price_drop" | "restock" | "reminder";
  title: string;
  body: string;
  productId: string;
  distributorId?: string;
  triggeredPrice?: number;
  currency?: string;
  createdAt: number;
  read: boolean;
}
```

In `lib/storage.ts`:

Add `NotificationHistoryEntry` to the type import (lines 2-8):

```ts
import {
  Product,
  PriceAlert,
  AppSettings,
  DistributorListing,
  BackOrderReminder,
  NotificationHistoryEntry,
} from "./types";
```

Add the key to `KEYS` (after line 31):

```ts
    NOTIFICATION_HISTORY: "notification_history",
```

Add the methods right after the Displayed Event Ids section (after `recordDisplayedEventId`, line 458):

```ts
  // ─── Notification History ─────────────────────────────────────────────────

  async function getNotificationHistory(): Promise<NotificationHistoryEntry[]> {
    return readList<NotificationHistoryEntry>(KEYS.NOTIFICATION_HISTORY);
  }

  async function recordNotificationEvent(
    event: Omit<NotificationHistoryEntry, "read">,
  ): Promise<void> {
    await enqueue(KEYS.NOTIFICATION_HISTORY, async () => {
      const list = await getNotificationHistory();
      if (list.some((e) => e.id === event.id)) return;
      list.unshift({ ...event, read: false });
      if (list.length > 200) list.length = 200;
      await adapter.setItem(KEYS.NOTIFICATION_HISTORY, JSON.stringify(list));
    });
  }

  async function markNotificationRead(id: string): Promise<void> {
    await enqueue(KEYS.NOTIFICATION_HISTORY, async () => {
      const list = await getNotificationHistory();
      const entry = list.find((e) => e.id === id);
      if (entry && !entry.read) {
        entry.read = true;
        await adapter.setItem(KEYS.NOTIFICATION_HISTORY, JSON.stringify(list));
      }
    });
  }

  async function markAllNotificationsRead(): Promise<void> {
    await enqueue(KEYS.NOTIFICATION_HISTORY, async () => {
      const list = await getNotificationHistory();
      if (list.some((e) => !e.read)) {
        for (const e of list) e.read = true;
        await adapter.setItem(KEYS.NOTIFICATION_HISTORY, JSON.stringify(list));
      }
    });
  }

  async function getUnreadNotificationCount(): Promise<number> {
    const list = await getNotificationHistory();
    return list.filter((e) => !e.read).length;
  }
```

Add `KEYS.NOTIFICATION_HISTORY,` to `clearAllData`'s `multiRemove` array (after `KEYS.DISPLAYED_EVENT_IDS,` line 470).

Add the five functions to the `createStorage` return object (after `recordDisplayedEventId,` line 513):

```ts
    getNotificationHistory,
    recordNotificationEvent,
    markNotificationRead,
    markAllNotificationsRead,
    getUnreadNotificationCount,
```

Add the same five to the default destructure (after `recordDisplayedEventId,` line 560).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/storage.test.ts`
Expected: PASS (all storage tests, including the 7 new ones).

- [ ] **Step 5: Typecheck and commit**

Run: `pnpm check`
Expected: 0 errors.

```bash
git add lib/types.ts lib/storage.ts tests/storage.test.ts
git commit -m "feat(storage): add notification history collection"
```

---

### Task 2: Record pulled events into notification history

Record every pulled notification event during sync so the center's list populates. TDD: update the sync test first, then implement.

**Files:**
- Modify: `lib/server-notifications.ts` (destructure lines 50-56, loop lines 96-104)
- Test: `tests/sync-server-notifications.test.ts`

- [ ] **Step 1: Add the mock and failing assertions**

In `tests/sync-server-notifications.test.ts`:

Add `historyRecorded` to the hoisted state (after line 10, the `recorded` entry):

```ts
  historyRecorded: [] as Array<Record<string, unknown>>,
```

Add `recordNotificationEvent` to the `../lib/storage` mock (after `recordDisplayedEventId`, line 35):

```ts
  recordNotificationEvent: vi.fn(async (event: Record<string, unknown>) => {
    state.historyRecorded.push(event);
  }),
```

Reset it in `beforeEach` (after `state.recorded = [];` line 76):

```ts
  state.historyRecorded = [];
```

Add assertions in the first test (after line 87, `expect(state.recorded).toEqual(["evt-1"]);`):

```ts
    expect(state.historyRecorded).toHaveLength(1);
    expect(state.historyRecorded[0]!.id).toBe("evt-1");
```

Add an assertion in the second test (after line 95, `expect(state.recorded).toEqual([]);`):

```ts
    expect(state.historyRecorded).toHaveLength(1);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/sync-server-notifications.test.ts`
Expected: FAIL — `state.historyRecorded` stays `[]` because `recordNotificationEvent` is never called.

- [ ] **Step 3: Implement recording in the sync loop**

In `lib/server-notifications.ts`:

Add `recordNotificationEvent` to the dynamic-import destructure (after `recordDisplayedEventId,` line 55):

```ts
      recordNotificationEvent,
```

Add the recording call as the first line of the pull loop (line 96):

```ts
    for (const event of events) {
      await recordNotificationEvent(event);
      const stalePriceDrop =
        event.type === "price_drop" && event.alertId && !activeAlertIds.has(event.alertId);
      if (!stalePriceDrop && !displayedIds.has(event.id)) {
        await scheduleServerEventNotification(event.title, event.body);
        await recordDisplayedEventId(event.id);
      }
      await reconcileEvent(event);
    }
```

The server `NotificationEvent` shape (`{ id, type, title, body, productId, distributorId?, triggeredPrice?, currency?, createdAt, ... }`) is structurally assignable to `Omit<NotificationHistoryEntry, "read">` — extra optional fields are allowed.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/sync-server-notifications.test.ts`
Expected: PASS — `historyRecorded` has one entry in both tests (recording happens regardless of the render/dedup gate).

- [ ] **Step 5: Typecheck and commit**

Run: `pnpm check`
Expected: 0 errors.

```bash
git add lib/server-notifications.ts tests/sync-server-notifications.test.ts
git commit -m "feat(sync): record notification events to history"
```

---

### Task 3: NotificationCenter component + Alerts tab segment

Create the UI component and wire it as the third segment in the Alerts tab. There is no component-test infrastructure in this repo (vitest runs in a node environment), so this task is verified via `pnpm check` + `pnpm lint`.

**Files:**
- Create: `components/notification-center.tsx`
- Modify: `app/(tabs)/alerts.tsx`

- [ ] **Step 1: Create `components/notification-center.tsx`**

```tsx
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { syncServerNotifications } from "@/lib/server-notifications";
import {
  getNotificationHistory,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/storage";
import type { NotificationHistoryEntry } from "@/lib/types";

type HistoryType = NotificationHistoryEntry["type"];
type TypeIconName =
  | "dollarsign.circle.fill"
  | "checkmark.circle.fill"
  | "clock.fill";

const TYPE_ICONS: Record<HistoryType, TypeIconName> = {
  price_drop: "dollarsign.circle.fill",
  restock: "checkmark.circle.fill",
  reminder: "clock.fill",
};

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function NotificationCenter() {
  const colors = useColors();
  const router = useRouter();
  const [history, setHistory] = useState<NotificationHistoryEntry[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [list, unread] = await Promise.all([
      getNotificationHistory(),
      getUnreadNotificationCount(),
    ]);
    setHistory(list);
    setUnreadCount(unread);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await syncServerNotifications();
    await load();
    setRefreshing(false);
  }, [load]);

  const handleOpen = useCallback(
    async (item: NotificationHistoryEntry) => {
      if (Platform.OS !== "web")
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (!item.read) {
        await markNotificationRead(item.id);
        setUnreadCount((c) => Math.max(0, c - 1));
        setHistory((prev) =>
          prev.map((e) => (e.id === item.id ? { ...e, read: true } : e)),
        );
      }
      router.push(`/product/${item.productId}`);
    },
    [router],
  );

  const handleMarkAll = useCallback(async () => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await markAllNotificationsRead();
    setUnreadCount(0);
    setHistory((prev) => prev.map((e) => ({ ...e, read: true })));
  }, []);

  return (
    <FlatList
      data={history}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingBottom: 24,
        flexGrow: 1,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
      ListHeaderComponent={
        history.length > 0 ? (
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <Text
              style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}
            >
              {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
            </Text>
            {unreadCount > 0 && (
              <TouchableOpacity onPress={handleMarkAll} style={{ padding: 4 }}>
                <Text
                  style={{
                    color: colors.primary,
                    fontSize: 13,
                    fontWeight: "600",
                  }}
                >
                  Mark all read
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null
      }
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <Text
            style={{
              color: colors.muted,
              textAlign: "center",
              marginTop: 40,
            }}
          >
            No notifications yet.
          </Text>
        )
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          onPress={() => handleOpen(item)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            backgroundColor: colors.surface,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 14,
            marginBottom: 10,
          }}
        >
          <IconSymbol
            name={TYPE_ICONS[item.type]}
            size={22}
            color={item.type === "reminder" ? colors.warning : colors.success}
          />
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: colors.foreground,
                fontWeight: "700",
                fontSize: 14,
              }}
            >
              {item.title}
            </Text>
            <Text
              style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}
              numberOfLines={2}
            >
              {item.body}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>
              {formatRelativeTime(item.createdAt)}
            </Text>
          </View>
          {!item.read && (
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: colors.primary,
              }}
            />
          )}
        </TouchableOpacity>
      )}
    />
  );
}
```

- [ ] **Step 2: Wire the third segment into `app/(tabs)/alerts.tsx`**

Make these edits:

1. Add the import (after the storage import block, line 29):

```ts
import { NotificationCenter } from "@/components/notification-center";
```

2. Add `getUnreadNotificationCount` to the storage import (after `rearmAlert,` line 28):

```ts
  getUnreadNotificationCount,
```

3. Change the type (line 39):

```ts
type ActiveTab = "alerts" | "reminders" | "notifications";
```

4. Add state (after line 49, `const [refreshing, setRefreshing] = useState(false);`):

```ts
  const [unreadNotifications, setUnreadNotifications] = useState(0);
```

5. Extend `loadData` (lines 57-68):

```ts
  const loadData = useCallback(async () => {
    const [a, p, r, w, n] = await Promise.all([
      getAlerts(),
      getWatchlist(),
      getBackOrderReminders(),
      getStockWatches(),
      getUnreadNotificationCount(),
    ]);
    setAlerts(a);
    setProducts(p);
    setReminders(r);
    setStockWatches(w);
    setUnreadNotifications(n);
  }, []);
```

6. Add `notifications` to `tabCount` (line 209):

```ts
  const tabCount = {
    alerts: alerts.length,
    reminders: reminders.length + stockWatches.length,
    notifications: unreadNotifications,
  };
```

7. Extend the segment array (line 271):

```ts
        {(["alerts", "reminders", "notifications"] as ActiveTab[]).map((tab) => (
```

8. Extend the icon expression (lines 291-295):

```tsx
            <IconSymbol
              name={
                tab === "alerts"
                  ? "bell.fill"
                  : tab === "reminders"
                    ? "calendar"
                    : "bell.badge.fill"
              }
              size={15}
              color={activeTab === tab ? "#fff" : colors.muted}
            />
```

9. Extend the label (line 303):

```tsx
              {tab === "alerts" ? "Alerts" : tab === "reminders" ? "Reminders" : "Notifications"}
```

10. Render the component after the Reminders tab's closing `)}` (after line 1047, before the Reschedule Reminder Modal):

```tsx
      {/* Notifications Tab */}
      {activeTab === "notifications" && <NotificationCenter />}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm check`
Expected: 0 errors.

- [ ] **Step 4: Lint**

Run: `pnpm lint`
Expected: PASS (only the pre-existing `MODULE_TYPELESS_PACKAGE_JSON` warning).

- [ ] **Step 5: Run the full test suite**

Run: `pnpm test`
Expected: PASS — all storage + sync tests (Tasks 1-2) still green.

- [ ] **Step 6: Commit**

```bash
git add components/notification-center.tsx "app/(tabs)/alerts.tsx"
git commit -m "feat(alerts): add notification center tab"
```

---

### Task 4: Checkpoint commit

**Files:**
- Modify: `todo.md`

- [ ] **Step 1: Add the Phase 36 section to `todo.md`**

Append a new checked section at the end of `todo.md`:

```markdown
## Phase 36: In-app Notification Center

- [x] Notification history AsyncStorage collection (`notification_history`, capped at 200)
- [x] Record every pulled notification event into history during sync
- [x] Third "Notifications" segment in the Alerts tab with unread pill, mark-all-read, and tap-to-product
```

- [ ] **Step 2: Verify all gates**

Run: `pnpm check`, `pnpm lint`, `pnpm test`
Expected: 0 TS errors, lint clean (pre-existing warning only), all tests pass.

- [ ] **Step 3: Final review and checkpoint commit**

Review the full diff (`git diff HEAD~4`) for consistency: type names (`NotificationHistoryEntry`), function names (`getNotificationHistory`, `recordNotificationEvent`, `markNotificationRead`, `markAllNotificationsRead`, `getUnreadNotificationCount`), and key (`notification_history`) match everywhere.

```bash
git add todo.md
git commit -m "Checkpoint: v3.15: In-app notification center with persistent history, unread state, mark-as-read, and tap-to-product. TypeScript: 0 errors."
```

- [ ] **Step 4: Push**

```bash
git push
```
