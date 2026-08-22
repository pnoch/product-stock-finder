# Server-Side Health Alert Mirroring (v5.15) Design

**Date:** 2026-08-20

**Status:** Approved design

## Overview

Health outage and recovery notifications (Phases 63–64) are detected client-side via `checkHealthAlerts`. The server never probes distributor health. This means signed-in web users only get health alerts when the tab is open and a foreground price check runs. When the tab is closed, web users miss health events entirely.

This phase mirrors detected health events to the server via the existing `uploadNotificationConfig` endpoint. The server stores the events scoped to the user and pushes them to all the user's devices via Expo push (including web push via service worker), so signed-in web users receive health alerts even when the tab is closed.

## Decisions

1. **Buffered client upload.** Health events accumulate in AsyncStorage (`pending_health_events`) and are included in the next `syncServerNotifications` cycle via extended `uploadConfig`. No new call paths.
2. **Extend uploadConfig, not a new endpoint.** Matches the existing periodic sync pattern.
3. **Push exclusion.** Server pushes to all user devices EXCEPT the source deviceId to avoid duplicate notifications on the detecting device.
4. **Stable event IDs.** Client uses `health:${distributorId}:${status}:${sampleTimestamp}` as event ID (stable across retries) and records `displayedEventId` locally so the pull side doesn't re-display on the detecting device.

## Client-Side Changes

### New types (`lib/server-notifications.ts`)

```ts
interface HealthEventPayload {
  distributorId: string;
  distributorName: string;
  status: "blocked" | "error";
  title: string;
  body: string;
  createdAt: number;
}
```

### New AsyncStorage key (`lib/storage.ts`)

`pending_health_events` — array of `HealthEventPayload`. CRUD: `getPendingHealthEvents`, `savePendingHealthEvents`, `clearPendingHealthEvents`.

### New helper (`lib/server-notifications.ts`)

```ts
export async function uploadHealthEventToServer(
  event: HealthEventPayload,
): Promise<void> {
  const pending = await getPendingHealthEvents();
  pending.push(event);
  await savePendingHealthEvents(pending);
}
```

### Modified `checkHealthAlerts` (`lib/background-price-check.ts`)

After `scheduleHealthAlert`/`scheduleHealthRecovery` succeeds, also call `uploadHealthEventToServer` with the event payload (distributorId, distributorName, status, title, body, createdAt). Use stable event id: `health:${distributorId}:${status}:${sampleTimestamp}`.

### Modified `syncServerNotifications` (`lib/server-notifications.ts`)

Before calling `uploadNotificationConfig`, read `pending_health_events` and include them in the config upload as `healthEvents`. After successful upload, clear the buffer.

### Modified `uploadNotificationConfig` (`lib/server-notifications.ts`)

Accept optional `healthEvents` array. Include it in the tRPC mutation call.

## Server-Side Changes

### Extended `NotificationConfig` (`server/notifications.ts`)

```ts
healthEvents?: Array<{
  id: string;
  distributorId: string;
  distributorName: string;
  status: "blocked" | "error";
  title: string;
  body: string;
  createdAt: number;
}>;
```

### Modified `upsertDeviceConfig` (`server/notifications.ts`)

After storing config, process `healthEvents` if present:
- For each healthEvent, create a `NotificationEvent` in `notificationEvents` scoped to userId
- DedupKey: `health:${distributorId}:${status}:${createdAt}` (avoids duplicates on retry)
- Push to all user devices EXCEPT the source deviceId via `sendPushForUser` (with new `excludeDeviceId` param)

### Extended `uploadConfig` tRPC schema (`server/routers.ts`)

Accept optional `healthEvents` array in the input schema.

### Modified `sendPushForUser` (`server/push-notifications.ts`)

Add optional `excludeDeviceId` param. When iterating devices, skip the excluded deviceId.

## Dedup Flow

1. **Detecting device**: records `displayedEventId(id)` after upload → when it pulls later, `displayedIds.has(event.id)` → true → no re-display. `recordNotificationEvent` dedups by id → no duplicate history entry.
2. **Server push**: excludes source deviceId → no duplicate OS notification on detecting device.
3. **Other devices**: pull the event → record in history → display via `scheduleServerEventNotification` → web push delivers when tab closed.

## Pull Side (Existing Flow)

- `syncServerNotifications` pulls events via `pullPendingEvents`
- `recordNotificationEvent(event)` dedups by id
- `scheduleServerEventNotification(event.title, event.body)` displays notification
- `reconcileEvent` handles health events (no action needed — no deactivation/reschedule)
- Web push service worker delivers even when tab closed

## Out of Scope

- Server-side health probing (server detects health itself)
- Health events for anonymous devices (user-scoped only)
- Health event click navigation to drill-down (existing focus-window only)