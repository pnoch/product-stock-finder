# Push Notifications — Design

## Overview

Phase 32 built the server-side notification engine: the server evaluates each device's alert/restock/reminder config against continuously-warmed prices, queues `notification_events`, and the client pulls them on launch/foreground. The gap: **the client only receives events when the app is opened** — a price drop while the app is closed is shown the next launch, not immediately.

This phase adds **immediate delivery**. Mobile registers an Expo push token; the server sends events via Expo's hosted push API at detection time. Desktop (Tauri) polls `notifications.pull` on a schedule and renders native OS notifications via `tauri-plugin-notification`. The existing pull-based flow stays as a fallback everywhere.

## Goals

- Price-drop, restock, and date-reminder events are delivered while the mobile app is closed/backgrounded (Expo push).
- Desktop receives and renders the same events as native OS notifications on a schedule.
- The Phase 32 pull-based delivery remains as a fallback for both platforms (token expired, push failed, desktop poller skipped a tick).
- Works with the existing anonymous device-ID model — no auth required.
- Push is best-effort: any failure degrades gracefully to the pull fallback, never breaking the app.

## Non-Goals

- No FCM/APNs direct integration, no native certificate/key setup. Expo's hosted push service only.
- No web push (service worker / VAPID). Web keeps pull-only.
- No changes to the on-device background task or the Phase 32 notification engine's dedup/reconciliation semantics.
- No auth/account system.

## Architecture

```
┌────────────────────────────┐  registerPushToken (tRPC)  ┌─────────────────────────────┐
│  Mobile (iOS/Android)      │ ──────────────────────────► │  Server (Express + tRPC)    │
│  lib/push-token.ts         │                             │  device_push_tokens table   │
│   getExpoPushTokenAsync    │ ◄─────────────────────────  │  server/push-notifications  │
│  lib/server-notifications  │      push event             │   sendPushForDevice         │
│   pull fallback            │      (Expo Push API)        │  server/notifications.ts    │
└────────────────────────────┘                             │   evaluateNotifications     │
                                                           │    → push after create      │
┌────────────────────────────┐  uploadConfig + pull        │                             │
│  Desktop (Tauri/React)     │ ──────────────────────────► │                             │
│  server-notifications.ts   │ ◄────────────────────────── │  notifications.uploadConfig │
│   syncDesktopNotifications │      native notification    │  notifications.pull         │
│   sendDesktopNotification  │                             │  notifications.registerPushToken
└────────────────────────────┘                             └─────────────────────────────┘
```

Delivery paths for a single `notification_events` row:

1. **Mobile push:** `evaluateNotifications` creates events → `sendPushForDevice` posts to Expo Push API → OS notification.
2. **Mobile pull (fallback):** `syncServerNotifications` on launch/foreground pulls + renders locally.
3. **Desktop:** scheduled `syncDesktopNotifications` pulls + renders native notifications.

## Data Model

New Drizzle table `device_push_tokens` (mirrors `device_notification_configs`):

| Column | Type | Notes |
| ------ | ---- | ----- |
| `deviceId` | varchar(128) | Primary key |
| `token` | varchar(255) | Expo push token |
| `platform` | varchar(16) | `ios` or `android` |
| `updatedAt` | bigint | `Date.now()` |

Each device registers its current push token; re-registration overwrites (upsert). A device with no row simply never receives push.

## Server

### `server/push-notifications.ts` (new)

Follows the `server/notifications.ts` DB + in-memory `Map` fallback pattern (`getDb()` returns null → memory).

- `upsertPushToken(deviceId, token, platform): Promise<void>` — DB `insert(...).onDuplicateKeyUpdate({ set: { token, platform, updatedAt } })`; memory `Map.set`.
- `sendPushForDevice(deviceId, events): Promise<void>` — resolve the device's token; if none, no-op. For each event, enqueue a push message `{ to: token, title, body, data: { eventId } }` and send via Expo's push service. Failures are caught + logged (never thrown). No-op when `expo-server-sdk` is unavailable or a send key is missing.
- `clearPushTokensForTests(): void` — clears memory map.

### `server/notifications.ts` wiring

After events are created for a device, push them immediately:

- DB path: after `db.insert(notificationEvents).values(toInsert)`, call `await sendPushForDevice(row.deviceId, toInsert)` — the inserted drafts already carry `title` and `body`.
- Memory path: in `evaluateConfig`, after appending the new drafts, call `sendPushForDevice(deviceId, newlyAddedDrafts)`.

Push is fire-and-forget-ish (awaited inside the tick but failures swallowed), so the engine's behavior is unchanged if push fails.

### `server/routers.ts`

Add to the `notifications` router (public, consistent with Phase 32):

- `registerPushToken: publicProcedure.input(z.object({ deviceId: z.string().min(1).max(128), token: z.string().min(1).max(255), platform: z.enum(["ios", "android"]) })).mutation(({ input }) => upsertPushToken(input.deviceId, input.token, input.platform))`.

### Expo push sending

Use `expo-server-sdk` (`Expo` class). `new Expo({ accessToken })` with the access token read from env when present (optional; Expo's hosted service works without one). Sending:

```ts
import { Expo } from "expo-server-sdk";
const expo = new Expo({ accessToken: process.env.EXPO_PUSH_ACCESS_TOKEN });
// per event:
if (!Expo.isExpoPushToken(event.token)) continue;
const chunks = expo.chunkPushNotifications([{ to, title, body, data }]);
for (const chunk of chunks) await expo.sendPushNotificationsAsync(chunk);
```

## Mobile

### `app.config.ts`

Add to `extra`:

```ts
extra: {
  expoProjectId: process.env.EXPO_PUBLIC_EXPO_PROJECT_ID,
},
```

### `lib/push-token.ts` (new)

`registerPushToken(): Promise<void>`:

1. Guard: `Platform.OS === "web"` → return.
2. Guard: physical device via `expo-device` (`Device.isDevice`); simulator/emulator → return (no valid Expo token).
3. Read `projectId` from app config `extra.expoProjectId` (via `Constants.expoConfig?.extra?.expoProjectId`); if missing → return (local-dev mode, no push).
4. `Notifications.getExpoPushTokenAsync({ projectId })` → token.
5. `getDeviceId()` (Phase 32) → deviceId.
6. Call `client.notifications.registerPushToken.mutate({ deviceId, token, platform })` (4s timeout like `lib/server-notifications.ts`).
7. Entire body wrapped in try/catch — failures silent (push is best-effort).

### `app/_layout.tsx`

In the notification-permission effect (after `setupAndroidNotificationChannel`, alongside `requestNotificationPermissions` / `registerPriceCheckTask`), call `void registerPushToken()`.

## Desktop

### `desktop/src/server-notifications.ts` (new)

`syncDesktopNotifications(): Promise<void>` — mirrors mobile's `syncServerNotifications` but desktop-flavored:

1. Desktop device ID: read/create `device_id` in `localStorage` (desktop runs a React webview with `localStorage` available; do not use `lib/device-id.ts` which targets AsyncStorage). Reuse `lib/device-id.ts` `generateId()` if importable without RN deps, else inline a `crypto.randomUUID()` fallback.
2. Build config from the desktop storage instance — desktop already runs `createStorage(localStorageAdapter)` as `storage` (`desktop/src/storage.ts`). Use `storage.getAlerts()` / `storage.getStockWatches()` / `storage.getBackOrderReminders()` with the same active-only / date-only filters as mobile. Do NOT import the AsyncStorage-backed named exports from `lib/storage.ts` (they target the mobile default instance).
3. `uploadNotificationConfig(deviceId, config)` then `pullNotificationEvents(deviceId)` (reused from `lib/server-notifications.ts` — these only import tRPC, safe on desktop).
4. For each event, `sendDesktopNotification(event.title, event.body)` (existing `desktop/src/notifications.ts`).
5. Reconcile via the desktop `storage` instance's mutators (`storage.deactivateAlert(alertId, triggeredPrice)`, `storage.removeStockWatch(watchId)`, `storage.removeBackOrderReminder(reminderId)`) — the same semantics mobile's `reconcileEvent` applies, but bound to the desktop instance.
6. try/catch around everything — best-effort.

### Wiring

- On launch in `App.tsx` (after providers mount) and on a `setInterval` (e.g., 60s) alongside the existing price poller. Do NOT replace the poller's price-drop logic — desktop keeps its local detection; this adds server-queued event delivery on top.

## Error Handling

- Every push path is best-effort with try/catch; failures are logged at most, never thrown to break the tick or the app.
- `sendPushForDevice` no-ops when there is no registered token (device never opted in) or when Expo env is missing.
- Mobile registration is silent-fail — a missing projectId or simulator just means no push; pull fallback still works.
- Pull-based delivery remains the correctness guarantee.

## Testing

- `tests/push-notifications.test.ts` — `upsertPushToken` (DB not available → memory), `sendPushForDevice` no-op without token, `sendPushForDevice` calls Expo send with the right payload (mock `expo-server-sdk`), `clearPushTokensForTests`.
- `tests/notifications-router.test.ts` — extend with a `registerPushToken` test (stores token, rejects invalid platform via zod).
- `tests/push-token.test.ts` — `registerPushToken` guards (web / simulator / no projectId skip; happy path uploads), mocking `expo-device`, `expo-notifications`, and the tRPC client.
- Desktop — `syncDesktopNotifications` test mocking tRPC + `sendDesktopNotification` (or a `desktop` vitest test mirroring `tests/server-notifications.test.ts`).

## Out of Scope

- Replacing the pull model, changing dedup/reconciliation semantics.
- Web push, FCM/APNs direct, native key setup.
- Auth/accounts.
