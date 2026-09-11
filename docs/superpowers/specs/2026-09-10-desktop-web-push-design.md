# Desktop Web Push — Design Spec (2026-09-10)

Closed-app delivery for desktop web/PWA. The server pipeline (token storage → VAPID send on events) and sw.js push/click handler logic already exist — desktop only lacks the worker, the subscription module, and opt-in UI. Explicit Settings toggle (no auto-prompt). Signed-in users only (endpoint is protected); local-only users keep foreground polling.

## §A — Desktop service worker

New `desktop/public/sw.js`: `push` → `showNotification` + `notificationclick` → focus/open (handler logic copied from `public/sw.js:61-100`, no Expo precache block). Served at `/sw.js` (vite `public/` serving verified in planning). Test: push/click listeners present (string-guard; SWs don't run in jsdom).

## §B — Subscribe + upload module

New `desktop/src/lib/web-push.ts` (cannot reuse `lib/web-push.ts`: RN Platform + mobile tRPC): `isPushSupported()`, `ensurePushSubscription()` (register `/sw.js`, subscribe with `VITE_VAPID_PUBLIC_KEY`, upload `{token, platform: "web"}` via desktop tRPC client), `disablePush()` (local unsubscribe; server prune resolved in planning). Missing key/unsupported/signed-out → skip with status reason. Tests: mocked SW/PushManager/tRPC units.

## §C — Settings toggle

Push row in the Notification section: status (On/Off + reason) + Enable/Disable with toast feedback; disabled with "Sign in to enable push" when signed out. Test: mocked-module toggle flows.

## Non-goals

- Server send-path changes (verified in planning); auto-prompt; precaching; Bearer/cookie changes; Tauri changes.
