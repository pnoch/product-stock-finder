# Server-Side Notification Scheduling — Design

## Overview

Today all notification logic runs on-device: the mobile background task (`lib/background-price-check.ts`) scrapes prices, checks price alerts, restock watches, and date reminders, then fires local `expo-notifications`. This is unreliable — iOS/Android throttle background tasks, and the checks only run when the device is awake.

This phase moves the _detection_ to the server, which already warms prices continuously (phases 27–31). The server evaluates each device's alert config against warmed prices and queues notification events in a DB table. The client pulls pending events on launch and foreground, renders them as local notifications, and reconciles local state (deactivating fired alerts, removing restocked watches).

There is **no push infrastructure** (no FCM/APNs/Expo Push tokens). Delivery is pull-based: server detects + queues, client pulls + shows locally. This works in local-only mode with zero auth setup.

## Goals

- Server detects price drops, restocks, and date reminders against its continuously-warmed price data.
- Events are queued server-side with dedup (no re-fire every warmer tick).
- Client pulls events on launch + foreground and shows them as local notifications.
- Local state reconciles with what the server fired (alerts deactivate, stock watches remove).
- Works in local-only mode via an anonymous device ID. No auth required.

## Non-Goals

- No push infrastructure (FCM/APNs/Expo Push). Pull-based delivery only.
- No desktop support (desktop has no local notification system).
- No changes to the existing on-device background task — it stays as-is and remains the primary path when the app is open; the server path supplements it when the device was closed/backgrounded.
- No auth/account system.

## Architecture

```
┌────────────────────────────┐     uploadConfig (tRPC)     ┌─────────────────────────────┐
│  Mobile app (local-only)   │ ───────────────────────────► │  Server (Express + tRPC)    │
│  lib/device-id.ts          │                              │  server/notifications.ts     │
│  lib/server-notifications  │ ◄─────────────────────────── │  - upsertDeviceConfig       │
│    upload + pull           │       pull (tRPC)            │  - evaluateNotifications    │
│  lib/notifications.ts      │                              │  - pullPendingEvents        │
│    local render            │                              │                             │
└────────────────────────────┘                              │  Warmer tick → evaluate     │
                                                            │  Tables:                    │
                                                            │  device_notification_configs│
                                                            │  notification_events        │
                                                            └─────────────────────────────┘
```

**Flow:**

1. On launch and foreground, the client calls `uploadNotificationConfig(deviceId)` — builds a config from local AsyncStorage (`getAlerts`, `getStockWatches`, `getBackOrderReminders`) and sends it to `notifications.uploadConfig`.
2. The server's warmer tick calls `evaluateNotifications()` after warming prices. For each device config, it compares against warmed prices/cached stock status/reminder dates and queues `notification_events` rows (deduped by `dedupKey`).
3. On launch and foreground, the client calls `pullNotificationEvents(deviceId)`. The server returns undelivered events and marks them delivered.
4. The client renders each event as a local notification (immediate trigger) and reconciles local state.

## Data Model

### `device_notification_configs`

One row per device — what to watch.

| Column          | Type            | Notes                                                        |
| --------------- | --------------- | ------------------------------------------------------------ |
| `deviceId`      | varchar(128) PK | anonymous device ID                                          |
| `alerts`        | json            | `[{ id, productId, targetPrice, currency, distributorId? }]` |
| `stockWatches`  | json            | `[{ id, productId, distributorId }]`                         |
| `dateReminders` | json            | `[{ id, productId, distributorId, reminderDate }]`           |
| `updatedAt`     | bigint          | epoch ms                                                     |

Each config entry carries the **local** `id` from the device's AsyncStorage (`PriceAlert.id`, `BackOrderReminder.id`). These ids are used for dedup keys and for client-side reconciliation.

### `notification_events`

Queued events awaiting delivery.

| Column        | Type            | Notes                                          |
| ------------- | --------------- | ---------------------------------------------- |
| `id`          | varchar(128) PK | uuid                                           |
| `deviceId`    | varchar(128)    |                                                |
| `type`        | varchar         | `"price_drop" \| "restock" \| "reminder"`      |
| `dedupKey`    | varchar(255)    | prevents re-queueing the same event every tick |
| `title`       | text            | pre-rendered notification title                |
| `body`        | text            | pre-rendered notification body                 |
| `createdAt`   | bigint          | epoch ms                                       |
| `deliveredAt` | bigint nullable | set when the client pulls                      |

**Dedup keys:**

- Price drop: `price_drop:{alertId}`
- Restock: `restock:{productId}:{distributorId}`
- Date reminder: `reminder:{reminderId}`

**Dedup rule:** skip queueing if an **undelivered** event with the same `dedupKey` exists. Delivered events can re-fire (e.g. a re-armed alert drops again later).

## Server Module — `server/notifications.ts`

Mirrors the `price-insights.ts` pattern (DB + memory `Map` fallback when `getDb()` returns null; `clearForTests`).

### `upsertDeviceConfig(deviceId, config)`

Insert-or-update the device's config row (`onDuplicateKeyUpdate`). Memory fallback: `Map.set`.

### `evaluateNotifications(now)`

Called from the warmer tick. For each device config:

- **Price drops:** for each alert, find the best in-stock price across the product's distributors via `getCachedPrice`/`getPrice` (server warms all catalog pairs, so prices are available). Convert to the alert currency with `convertPrice`. If `bestPrice <= targetPrice`, queue a `price_drop` event with dedupKey `price_drop:{alertId}`.
  - Title: `"💸 Price Drop Alert!"`
  - Body: `"{productName} is now {formattedBestPrice} — below your target of {formattedTargetPrice}!"`
  - Product name resolved from `PRODUCT_CATALOG`; distributor names from `DISTRIBUTORS`.
- **Restocks:** for each stock watch, look up the distributor's cached status via `getCachedPrice`/`getPrice`. If `in_stock`, queue a `restock` event with dedupKey `restock:{productId}:{distributorId}`.
  - Title: `"🟢 Back In Stock!"`
  - Body: `"{productName} is now available at {distributorName}."`
- **Date reminders:** if `now >= reminderDate`, queue a `reminder` event with dedupKey `reminder:{reminderId}`.
  - Title: `"📦 Back-Order Reminder"`
  - Body: `"Check {distributorName} for {productName} — your reminder date is here!"`

Best-effort: missing price/status → skip that item, don't fail the whole device. If `getDb()` is null, evaluate against the memory config map and queue into the memory event map.

### `pullPendingEvents(deviceId)`

Returns `{ events: NotificationEvent[] }` for undelivered events of the device, then marks them `deliveredAt = now`. DB path: `select` undelivered, then `update` those ids. Memory path: filter + mark in place.

### `clearNotificationsForTests()`

Clears memory config map + event map.

## tRPC Router — `notifications`

Both public procedures (no auth — anonymous device ID):

- `notifications.uploadConfig` — input `{ deviceId: string, alerts: [...], stockWatches: [...], dateReminders: [...] }` → `upsertDeviceConfig` → `{ accepted: true }`.
- `notifications.pull` — input `{ deviceId: string }` → `pullPendingEvents` → `{ events: [...] }`.

Registered in `server/routers.ts` after the `images` router.

## Client

### `lib/device-id.ts`

- `getDeviceId(): Promise<string>` — reads AsyncStorage key `device_id`; if absent, generates a UUID (`crypto.randomUUID()` with fallback), stores it, returns it. Stable across launches.

### `lib/server-notifications.ts`

- `uploadNotificationConfig(deviceId)` — builds config from `getAlerts()` (active only), `getStockWatches()`, `getBackOrderReminders()` (date-type only), calls `notifications.uploadConfig`. 4s timeout + null-on-error (matches `server-images.ts` pattern).
- `pullNotificationEvents(deviceId)` — calls `notifications.pull`, returns `NotificationEvent[]` or `[]` on error. 4s timeout + null-on-error.

### `lib/notifications.ts` — new helper

- `scheduleServerEventNotification(title, body)` — immediate local notification (trigger null), guarded `Platform.OS === "web"`. Reuses the existing `requestNotificationPermissions` + `scheduleNotificationAsync` pattern.

### Wiring

- `app/_layout.tsx` launch (after seed): `getDeviceId()` → `uploadNotificationConfig` → `pullNotificationEvents` → render each as local notification + reconcile.
- `lib/background-price-check.ts` `checkPriceDropsNow` (foreground path, after the existing alert check): same sequence.
- **Reconciliation on pull:**
  - `price_drop` event → find the local alert by `id` (from the event's `alertId`) and `deactivateAlert(alert.id, bestPrice)` (existing storage helper). If not found, skip.
  - `restock` event → `removeStockWatch(watchId)` (existing storage helper, takes the watch's local id from the event's `watchId`).
  - `reminder` event → no local mutation (reminders are user-managed).

### Notification events carry `alertId`/`watchId`/`reminderId` (the local id from the config) plus `productId`, `distributorId?`, `targetPrice?`, `currency?`, `triggeredPrice?` in the event payload so the client can reconcile exactly.

## Error Handling

- Server evaluation is best-effort: any single item failure is skipped; the device loop continues.
- Client upload/pull failures are non-fatal — silently ignored (the on-device background task remains the primary path).
- No DB (`getDb()` null) → memory fallback keeps the server functional in tests and local dev.

## Testing

- `tests/notifications.test.ts` — `evaluateNotifications` queues price_drop (below target), restock (in_stock), reminder (past date); dedup prevents re-queue of undelivered events; `pullPendingEvents` returns only undelivered and marks delivered; `upsertDeviceConfig` replaces config; delivered events can re-fire.
- `tests/notifications-router.test.ts` — `uploadConfig` + `pull` via `appRouter.createCaller` (public context, mirroring `images-router.test.ts`).
- `tests/server-notifications.test.ts` — client helper upload/pull success, null-on-error, timeout.
- `tests/device-id.test.ts` — generates + persists ID, returns stable ID.
- `tests/prices.test.ts` — warmer tick calls `evaluateNotifications` (mock `server/notifications`).

## Files

**New:**

- `drizzle` migration `0006_*.sql` (2 tables)
- `server/notifications.ts`
- `lib/device-id.ts`
- `lib/server-notifications.ts`
- `tests/notifications.test.ts`
- `tests/notifications-router.test.ts`
- `tests/server-notifications.test.ts`
- `tests/device-id.test.ts`

**Modified:**

- `drizzle/schema.ts` (2 tables)
- `server/routers.ts` (notifications router)
- `server/prices.ts` (warmer tick calls `evaluateNotifications`)
- `lib/notifications.ts` (`scheduleServerEventNotification`)
- `app/_layout.tsx` (launch pull)
- `lib/background-price-check.ts` (foreground pull)
- `tests/prices.test.ts` (warmer tick mock)
- `todo.md` (Phase 32)

## Out of Scope

- Push notifications (FCM/APNs/Expo Push).
- Desktop notification display.
- Auth/account system.
- Changing the on-device background task.
