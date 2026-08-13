# Mobile Notification Dedup Design

> **Date:** 2026-08-13
> **Phase:** 33 follow-up (target checkpoint v3.13)
> **Status:** Approved

## Problem

When the server's notification engine creates a `notification_event`, it sends an Expo push to the device AND leaves the event queued for pull delivery (`server/notifications.ts` marks `deliveredAt` only when pulled). On mobile, the same event can therefore reach the user twice:

1. As an OS push banner delivered by Expo's push service while the app is closed.
2. As a **local** notification rendered by `syncServerNotifications` on the next launch, because `pullPendingEvents` still returns the undelivered event.

There is currently no `eventId`-based dedup anywhere client-side. The result: users routinely see each alert twice.

## Scope

- Mobile only (iOS + Android). Desktop has no push path (scheduled pull + native notification only), so it cannot double-notify.
- No server or schema/migration changes. The pull fallback remains the correctness guarantee.
- Accepted tradeoff: a push banner seen while the app is closed **and never tapped** is not observed by the JS runtime, so the launch pull may still render it. Tapping the banner (the common path) records the id via the response listener / last-response capture and prevents the duplicate.

## Approach

Client-side `eventId` dedup. The mobile app records the ids of notification events it has already shown (from push payloads it receives/taps), then skips the local render of any pulled event whose id is recorded — while still reconciling local state (deactivating the alert, removing the watch/reminder).

## Components

### 1. `lib/storage.ts` — displayed-event-id store

Add to `KEYS`: `DISPLAYED_EVENT_IDS: "displayed_notification_event_ids"`.

Add two methods to `createStorage` (matching existing style, using `enqueue` for write serialization):

- `getDisplayedEventIds(): Promise<string[]>` — reads the JSON list; returns `[]` on missing/corrupt data.
- `recordDisplayedEventId(id: string): Promise<void>` — appends `id` if not already present, caps the list at the most recent **200** ids, persists. Safe against concurrent writes.

Export both from `defaultStorage` as named exports (same pattern as the other storage helpers) so `lib/server-notifications.ts` can `import { getDisplayedEventIds, recordDisplayedEventId } from "./storage"`.

### 2. `lib/notifications.ts` — push event tracking

Add `setupPushEventTracking(): void`:

- Guard: `if (Platform.OS === "web") return;`
- Register `Notifications.addNotificationReceivedListener` — extracts `notification.request.content.data?.eventId` and `void recordDisplayedEventId(id)` when present. (Covers push received while the app is in the foreground.)
- Register `Notifications.addNotificationResponseReceivedListener` — extracts `response.notification.request.content.data?.eventId` and records it. (Covers the user tapping/opening the push.)
- On startup, `void Notifications.getLastNotificationResponseAsync().then(...)` — records the `eventId` of the notification that cold-launched the app.
- Returns an unsubscribe function that cancels both listeners, so the caller can clean them up on unmount; all recording is best-effort (errors swallowed).

### 3. `lib/server-notifications.ts` — skip already-displayed events

In `runSyncServerNotifications` (the body behind the `syncServerNotifications` single-flight wrapper):

- Load `const displayed = new Set(await getDisplayedEventIds());` once, before the pull loop.
- For each pulled event, before rendering:
  - If `displayed.has(event.id)` → skip `scheduleServerEventNotification(...)` but still call `reconcileEvent(event)`.
  - Otherwise → render the local notification **and** `await recordDisplayedEventId(event.id)` (defense-in-depth for re-pulls).
- The existing `stalePriceDrop` guard is unchanged and independent (dedup and staleness are orthogonal).

### 4. `app/_layout.tsx` — wire tracking at launch

In the existing notification-permission effect (next to `void registerPushToken();` / `void syncServerNotifications();`), add `setupPushEventTracking()` (web-guarded inside the effect). Register once per launch; keep the returned unsubscribers and clean them up in the effect's teardown.

## Data Flow

```
Server creates event (push + queue)
  → push banner shown by OS
      → app foreground / tapped / cold-launch → setupPushEventTracking records eventId
  → next launch: syncServerNotifications pulls event
      → event.id in displayed set? → skip local render (still reconcile)
```

## Error Handling

- All recording is best-effort; failures are swallowed (storage read/write errors, missing `data.eventId`, missing `extra`).
- Dedup never blocks pull or reconcile: a storage read failure simply yields an empty set (renders normally).
- No new notification permission prompts.

## Testing

- `lib/storage.ts` (root test suite): `getDisplayedEventIds` empty/corrupt; `recordDisplayedEventId` dedupes, caps at 200, persists across instances.
- `lib/server-notifications.ts` (root test suite, extending the existing mock style with `vi.mock` for the dynamically imported `./device-id`, `./storage`, `./notifications`): a pulled event whose id is recorded does **not** call `scheduleServerEventNotification` but **does** reconcile; an unrecorded event renders and records its id.
- `lib/notifications.ts`: `setupPushEventTracking` registers the listeners and records `eventId` from a received/response notification payload (expo-notifications mocked); web is a no-op.
- Regression: existing suites stay green — `pnpm check`, `pnpm lint`, `pnpm test`, `pnpm check:desktop`, `pnpm --filter desktop test`.

## Non-Goals

- No server-side "push attempted" flag / schema change (rejected: risks losing events on silent push failure).
- No marking `deliveredAt` on push send (rejected: breaks the pull-fallback guarantee).
- No desktop changes (no duplicate path).
- No dedup of historical local-only alerts (`schedulePriceAlert` etc.) — only server `notification_event`s carry stable ids.
