# In-App Notification Center Design

> **Date:** 2026-08-13
> **Phase:** v3.15
> **Status:** Approved

## Goal

Give users a persistent, offline-capable history of notification events (price drops, restocks, reminders) inside the Alerts tab, with unread state, tap-to-product navigation, and mark-as-read. Today notification events are rendered as transient local banners on pull and then discarded — nothing persists them.

## Approach

Local-first. Record every pulled `notification_event` into a new AsyncStorage collection as the launch pull sync receives it. The Notification Center is a third segment in the Alerts tab that reads that store. No server, migration, or desktop changes; works on web.

## Components

### 1. Data model — `lib/types.ts`

Add:

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

### 2. Storage — `lib/storage.ts`, new collection `notification_history`

Key: `NOTIFICATION_HISTORY: "notification_history"`. Methods (following the existing `enqueue`/`readList` patterns, exported from `createStorage` return + `defaultStorage` destructure, added to `clearAllData`):

- `getNotificationHistory(): Promise<NotificationHistoryEntry[]>` — newest-first, capped at 200.
- `recordNotificationEvent(event: Omit<NotificationHistoryEntry, "read">): Promise<void>` — prepend `{ ...event, read: false }`; if an entry with the same `id` already exists, skip (preserving its `read` state); trim to most recent 200.
- `markNotificationRead(id: string): Promise<void>` — set `read: true` on the matching entry (no-op if absent).
- `markAllNotificationsRead(): Promise<void>` — set `read: true` on all entries.
- `getUnreadNotificationCount(): Promise<number>` — count of entries with `read: false`.

All read-modify-write operations serialized with `enqueue(KEYS.NOTIFICATION_HISTORY, ...)` to prevent lost updates under concurrent syncs.

### 3. Recording — `lib/server-notifications.ts`

In `runSyncServerNotifications`, inside the pull loop, record every event before the render/dedup gate:

```ts
for (const event of events) {
  await recordNotificationEvent(event);
  const stalePriceDrop = ...;
  ...
}
```

`recordNotificationEvent` is added to the existing dynamic-import destructure of `./storage`. This records events regardless of whether the local render was deduped (push-shown events are still pulled on the next launch and thus appear in history). Push payloads alone carry only `eventId`/`title`/`body`, so push-receive time is not a recording point.

### 4. UI — third segment in the Alerts tab

- `app/(tabs)/alerts.tsx`: extend the `activeTab` state union from `"alerts" | "reminders"` to include `"notifications"`; add the third segment button; render `components/notification-center.tsx` when active. This file is already ~1177 lines, so the new screen is a separate component rather than more inline code.
- `components/notification-center.tsx` (new):
  - `useFocusEffect` loads `getNotificationHistory()` and `getUnreadNotificationCount()`.
  - List rows: type icon (price_drop 💸 / restock 🟢 / reminder 📦), title, body, relative timestamp, unread dot for unread entries.
  - Tap row → `markNotificationRead(id)` + `router.push(`/product/${productId}`)`.
  - Header: unread-count pill + "Mark all read" button (`markAllNotificationsRead()`).
  - Empty state ("No notifications yet").
  - Pull-to-refresh re-runs `syncServerNotifications()` so newly-queued events are pulled and recorded, then reloads the list.
- The Alerts tab badge (active-setup count from `useAlertBadge`) is unchanged.

### 5. Testing

- `tests/storage.test.ts`: record/prepend/dedupe-by-id/cap-200/mark-read/mark-all/unread-count/clearAllData clears the key.
- `tests/sync-server-notifications.test.ts`: extend the storage mock with `recordNotificationEvent`; assert it is called with each pulled event (both the new-event and already-displayed paths).

## Error Handling

- Storage methods are best-effort (readList returns `[]` on corrupt/missing data; enqueue swallows write failures) — the center degrades to an empty list.
- Recording is inside the sync's existing try/catch (best-effort; a failing record must not abort the loop).

## Non-Goals

- No server history endpoint (rejected in favor of the local store).
- No push-receive-time recording (payloads lack the full event; the launch pull is the recording point).
- No changes to the Alerts tab badge semantics.
- No desktop changes.
