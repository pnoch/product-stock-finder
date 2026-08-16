# Design: Web Notifications (Foreground Pull) — v4.9

Date: 2026-08-17
Status: Approved

## Problem

The web target (Expo web) has no notifications. Every path in `lib/notifications.ts`
early-returns on `Platform.OS === "web"`; `lib/push-token.ts` is web-guarded; there is no
service worker, PWA config, or web-push library. Price-drop/restock/reminder alerts only reach
iOS/Android (expo-notifications + Expo push) and desktop (Tauri native notifications + 60s pull).

However, the pull model already works on web: `syncServerNotifications()` (tRPC
`notifications.pull`) runs from the NotificationCenter and records server events into the in-app
`notification_history`. The only missing pieces are OS-level display and a periodic poll while the
web app is open.

## Approach

Foreground-only pull, mirroring the desktop app's pattern. The web tab polls
`notifications.pull` every 60s while open (when enabled + permission granted) and displays events
via the Web Notification API. No VAPID keys, no service worker, no new server dependencies.
Delivery only fires while the tab is open — background delivery (tab closed) is out of scope for
v1 and can be a later phase (web push / VAPID).

## Changes

### 1. New module `lib/web-notifications.ts`

All code in this module is web-only (guarded by `Platform.OS === "web"`; native callers are
unaffected). Single responsibility: web notification permission, display, and polling.

- `isWebNotificationsSupported()` — `typeof Notification !== "undefined"` and a secure context
  (`window.isSecureContext`). Returns `false` on non-web.
- `requestWebNotificationPermission()` — `Notification.requestPermission()`, returns
  `"granted" | "denied" | "default"`. No-op (returns `"denied"`) if unsupported.
- `displayWebNotification(title: string, body: string)` — if permission is `"granted"`, creates
  `new Notification(title, { body })` with `onclick` that focuses the window; swallows and logs
  any constructor error. No-op otherwise.
- `setupWebNotifications()` — reads settings via `getSettings()` (`lib/storage.ts`); if
  `webNotificationsEnabled` is set and permission granted, starts a 60s `setInterval` that calls
  `syncServerNotifications()`, plus a `window` `focus` listener that polls once. Returns a cleanup
  function that clears the timer and removes the listener.
- `setWebNotificationsEnabled(enabled: boolean)` — persists `webNotificationsEnabled` via
  `saveSettings()` (`lib/storage.ts`); on enable, requests permission first, then starts/stops
  polling accordingly. Returns the resulting permission state.

### 2. `lib/notifications.ts` — `scheduleServerEventNotification`

Replace the web early-return (line ~193) with a delegation to `displayWebNotification(title, body)`.
Native path unchanged. Events still get recorded to `notification_history` and deduped via
`displayed_notification_event_ids` as today.

### 3. `lib/types.ts` — `AppSettings`

Add `webNotificationsEnabled?: boolean` (defaults to `false`) to the `AppSettings` interface
(`lib/types.ts:112`). It syncs through the existing settings sync (LWW) like every other
`AppSettings` field; no schema change. `getSettings()`/`saveSettings()` in `lib/storage.ts`
handle persistence unchanged.

### 4. `app/(tabs)/settings.tsx` — Web notifications toggle

A web-only row (hidden on native) that renders a Switch bound to `webNotificationsEnabled`.
On toggle-on: calls `setWebNotificationsEnabled(true)` (requests permission). If permission is
`"denied"`, the setting is NOT persisted as enabled, the toggle stays off, and a hint text is
shown ("Notifications are blocked in your browser settings"). On toggle-off: calls
`setWebNotificationsEnabled(false)`.

### 5. `app/_layout.tsx` — launch wiring

In the web branch, call `setupWebNotifications()` on launch (mirrors the native bootstrap at
lines 88-111). The returned cleanup is invoked on unmount.

## Data Flow

1. Server detects `price_drop` / `restock` / `reminder` events (`evaluateNotifications`, every
   5 min warmer tick) and queues them.
2. Web tab polls `notifications.pull` every 60s (when enabled + granted) via
   `syncServerNotifications()`.
3. Each event is displayed via `displayWebNotification` and recorded to the in-app
   NotificationCenter history (existing behavior).
4. `reconcileEvent` deactivates the alert / removes the stock watch / reminder as today.

No local scraping on web in v1 — pull-only, per the chosen approach. Without a running backend,
web notifications simply don't fire (consistent with the existing local-only degradation).

## Error Handling

- Permission denied → toggle shows a hint; polling never starts.
- `new Notification(...)` throws → caught, logged via `console.warn`, no crash.
- Poll failures → swallowed; `syncServerNotifications` already has a single-flight guard.
- Timer throttling in background tabs is acceptable (60s poll; browsers throttle to ~1/min).

## Testing

New `tests/web-notifications.test.ts` (jsdom, mirroring existing web test setup):

- `isWebNotificationsSupported` returns `false` when `Notification` is undefined / insecure context.
- `requestWebNotificationPermission` returns the permission result.
- `displayWebNotification` no-ops when permission is not granted; constructs a `Notification` when
  granted (mock `window.Notification`).
- `setWebNotificationsEnabled(true)` requests permission and starts polling; `false` stops it.
- `scheduleServerEventNotification` delegates to `displayWebNotification` on web (mock the module).

Existing tests must remain green (native paths unchanged). `pnpm check`, `pnpm lint`, `pnpm test`
all pass.