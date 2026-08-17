# Design: Web Push Background Delivery — v5.0

Date: 2026-08-17
Status: Proposed

## Problem

v4.9 delivered web notifications via foreground pull: the tab polls
`notifications.pull` every 60s while open. When the tab is closed (browser still
running), events are never delivered on web. Native targets (iOS/Android) get
server-pushed notifications via Expo push, and desktop (Tauri) via its own native
notification path — web is the only target without background delivery.

## Approach

Add background delivery via the standard Web Push API: a service worker
(`public/sw.js`) registered at module scope, a `PushManager` subscription created
when the existing "Web Notifications" toggle is enabled, and server-side
`web-push` (VAPID) sending. Foreground pull (v4.9) is unchanged and remains the
open-tab delivery path; the service worker covers the closed-tab case. Requires a
secure context (HTTPS or localhost) — confirmed available.

## Changes

### 1. Server — `web-push` dependency + VAPID config

- Add `web-push` to the root `package.json` (server deps live in the root
  `package.json`; the server is bundled with esbuild).
- New `server/web-push.ts`: reads `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY` from env and calls `webPush.setVapidDetails(...)`. Export a
  `sendWebPush(deviceId, subscription, event)` helper that:
  - `trySend` → `webPush.sendNotification(subscription, JSON.stringify({ title, body, eventId }))`
  - on 404/410 → prunes the device token
  - on other error → `console.warn`, no crash
  - no-ops (returns) if VAPID env vars are missing (degrades gracefully, same as
    missing `DATABASE_URL`)
- New `scripts/generate-vapid-keys.js`: prints a VAPID keypair
  (`webPush.generateVAPIDKeys()`) for the operator to paste into env.
- Document the three VAPID env vars in `server/README.md` and the AGENTS.md
  Environment section.

### 2. Server — subscription storage

- `drizzle/schema.ts` `device_push_tokens`: change `token` column from
  `varchar(255)` to `text` (a Web PushSubscription JSON is ~500 bytes).
- `server/push-notifications.ts` `upsertPushToken`: widen `platform` union to
  `"ios" | "android" | "web"`. For `"web"`, `token` holds
  `JSON.stringify(pushSubscription)` (endpoint, expirationTime, keys).
- `server/routers.ts` `notifications.registerPushToken`: platform enum gains
  `"web"`; `token` max length raised from 255 to 2048.

### 3. Server — delivery

- `sendPushForDevice`: also select `platform`. If `platform === "web"`, parse the
  stored subscription JSON and call the `sendWebPush` helper instead of the Expo
  path. Native (Expo) path unchanged.
- `sendWebPush` does NOT record a delivery row. Rationale: the server records
  deliveries per-device and counts them for multi-device fan-out; recording on
  push-send would suppress the open-tab pull for events the SW decided not to
  show (focused tab). Dedup is handled client-side via
  `displayed_notification_event_ids` (see §7).
- Anonymous/no-DB mode: `sendPushForDevice` already falls back to memory tokens;
  keep that behavior for web (memory store gains a `platform` field).

### 4. Client — service worker

- New `public/sw.js` (Expo web serves `public/` at `/sw.js` on static export):
  - `push` event: parse `event.data.json()` → `{ title, body, eventId }`. If any
    window client is **focused**, skip showing (the foreground pull handles it);
    otherwise `self.registration.showNotification(title, { body, data: { eventId } })`.
    After showing, `postMessage` `{ type: "web-push-shown", eventId }` to all
    window clients so the page can record the event as displayed (see §7).
  - `notificationclick`: close the notification, focus the window client if one
    exists, else `clients.openWindow("/")`.
- No Workbox / offline precache — push-only SW.

### 5. Client — subscription lifecycle

- New module `lib/web-push.ts` (web-only, mirrors `lib/web-notifications.ts`):
  - `registerWebPushServiceWorker()` — `navigator.serviceWorker.register("/sw.js")`,
    returns the registration. Called at module scope on web.
  - `subscribeWebPush()` — requires `isWebNotificationsSupported()` (secure
    context + `Notification`); `pushManager.subscribe({ userVisibleOnly: true,
applicationServerKey: urlBase64ToUint8Array(EXPO_PUBLIC_VAPID_PUBLIC_KEY) })`;
    then `client.notifications.registerPushToken.mutate({ deviceId,
platform: "web", token: JSON.stringify(subscription) })` via tRPC. Returns
    `boolean` (true = subscribed).
  - `unsubscribeWebPush()` — `pushManager.getSubscription()` → `unsubscribe()`;
    best-effort.
  - `urlBase64ToUint8Array(base64)` — standard base64url→Uint8Array helper.
  - `isPushSupported()` — `"serviceWorker" in navigator && "PushManager" in
window && "Notification" in window` (secure-context implied).
- `EXPO_PUBLIC_VAPID_PUBLIC_KEY` env var is the client-side application server
  key (same keypair as the server's `VAPID_PUBLIC_KEY`).
- Page-side listener for the SW `web-push-shown` postMessage: calls
  `recordDisplayedEventId(eventId)` (`lib/storage.ts`) so the foreground pull
  skips re-popping an event the SW already showed. Registered by
  `setupWebNotifications()` (v4.9 module) and cleaned up on stop.

### 6. Client — toggle wiring (reuses v4.9 toggle)

- `lib/web-notifications.ts` `setWebNotificationsEnabled(enabled)`:
  - `true` → request permission first; if granted, `await
subscribeWebPush()` (best-effort, non-fatal on failure), then start the 60s
    foreground pull.
  - `false` → `unsubscribeWebPush()` (best-effort), stop the pull.
- `app/_layout.tsx` web launch branch: call
  `registerWebPushServiceWorker()` at module scope (import side-effect or explicit
  call) alongside `setupWebNotifications()`.
- No new settings UI — the existing "Web Notifications" toggle covers both.

## Data Flow

1. Server detects `price_drop` / `restock` / `reminder` events
   (`evaluateNotifications`, every 5 min warmer tick) and queues them.
2. For each subscribed device: `sendPushForUser` → `sendPushForDevice` → platform
   `"web"` → `sendWebPush` → VAPID-signed web push to the browser's push endpoint.
3. Closed/backgrounded tab → service worker receives the `push` event → shows a
   system notification (and postMessages the eventId to any page). Open focused
   tab → SW skips; the 60s foreground pull displays it instead.
4. The pull path (v4.9) is unchanged: it records every event to the in-app
   NotificationCenter history and pops only events not already in
   `displayed_notification_event_ids`.

## Dedup Behavior

| State at push time      | SW shows?           | Result                                                                                                                                          |
| ----------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Tab open + focused      | No (focused client) | Foreground pull pops within 60s — single notification                                                                                           |
| Tab open + backgrounded | Yes                 | SW pops; postMessage records eventId → pull skips — single notification                                                                         |
| Tab closed              | Yes                 | SW pops; no page to record. On next open the pull re-pops the event — rare, accepted double (documented limitation; IndexedDB sharing deferred) |

## Error Handling

- VAPID env missing → `sendWebPush` no-ops; no crash (server keeps serving).
- Subscription expired (404/410) → token pruned; device is dropped from push
  targets.
- `EXPO_PUBLIC_VAPID_PUBLIC_KEY` missing on client → `subscribeWebPush` fails
  gracefully; toggle still enables foreground pull.
- `PushManager.subscribe` rejects (permission lost, quota) → caught, logged,
  toggle remains on for foreground pull.
- SW registration failure → logged; background delivery absent but foreground pull
  still works.

## Testing

- Server: new `tests/web-push-server.test.ts` — mock `web-push`; verify platform
  `"web"` routes to `sendWebPush`, 404/410 prunes the token, other errors are
  non-fatal, and no delivery row is written.
- Server: `registerPushToken` accepts platform `"web"` and token length > 255
  (`tests/notifications-router.test.ts`).
- Client: new `tests/web-push.test.ts` (jsdom) — `urlBase64ToUint8Array`
  roundtrip, `isPushSupported` feature detection, `subscribeWebPush` /
  `unsubscribeWebPush` with mocked `navigator.serviceWorker` / `pushManager` /
  tRPC client, and the `web-push-shown` postMessage listener recording a
  displayed event id.
- Existing tests must remain green (native/Expo path unchanged). `pnpm check`,
  `pnpm lint`, `pnpm test` all pass.

## Out of Scope

- `pushsubscriptionchange` re-subscribe handling (browser-initiated
  re-subscription; next phase).
- Multi-browser-per-account UI (device list already covers this).
- Offline caching / Workbox precache — push-only SW.
- Manual browser smoke test (covered by a follow-up web build verification if
  requested).
