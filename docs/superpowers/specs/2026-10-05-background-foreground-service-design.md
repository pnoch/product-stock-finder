# Background Refresh via a Foreground Service — Design Spec

**Date:** 2026-10-05
**Goal:** Let browser-dependent distributors refresh while the app is closed, by keeping the process (and the hidden WebView host) alive with an Android foreground service.

## Problem

The on-device WebView renderer only works in the foreground: `expo-background-task` runs headless with no view tree, so `getWebViewHost()` is null and browser-only distributors fall back to plain HTTP. On real devices ~half the distributors need rendering, so background price checks miss them.

## The hard constraint (why this is a spike-first design)

When the app is backgrounded, Android freezes React Native's JS timers (`lib/background-safe-timers.ts`) and may throttle the WebView renderer. A foreground service keeps the **process** alive but does **not** unpause RN timers. The render path may still work because:
- the hidden WebView's page-side `setTimeout` runs in Chromium, not RN's timer manager;
- `onMessage` delivery and microtasks still run while backgrounded.

This is uncertain per device/version, so **Task 1 is a validation spike**. If a browser-only fetch does not render while backgrounded, the design escalates to an overlay window (`SYSTEM_ALERT_WINDOW`) — explicitly out of scope here.

## Scope

**In scope:** a local Expo module providing an Android foreground service (`dataSync`), a JS controller, an opt-in Settings toggle, and reuse of the existing `expo-background-task` scheduler.

**Out of scope:** overlay-window rendering (needs `SYSTEM_ALERT_WINDOW`); iOS background rendering (iOS cannot keep a WebView alive this way); a service-driven native scheduling loop.

## Architecture

### 1. Local Expo module `modules/psf-foreground-service/`

- `android/src/main/AndroidManifest.xml` — declares `android.permission.FOREGROUND_SERVICE` and `android.permission.FOREGROUND_SERVICE_DATA_SYNC`, and the `<service android:name=".PsfForegroundService" android:foregroundServiceType="dataSync" android:exported="false" />`. Merged into the app manifest at build.
- `PsfForegroundService.kt` — a `Service` that on `onStartCommand` calls `startForeground(id, notification)` with a low-importance channel ("Product Stock Finder — checking prices") and a **Stop** action (a `PendingIntent` back to the service with `ACTION_STOP`). `onDestroy` removes the notification.
- `PsfForegroundServiceModule.kt` — an Expo `Module` exposing `start()`, `stop()`, `isRunning()` (a static flag on the service).
- `src/index.ts` — the JS API:
  ```ts
  export function startForegroundService(): Promise<void>;
  export function stopForegroundService(): Promise<void>;
  export function isForegroundServiceRunning(): Promise<boolean>;
  ```
  No-ops (resolve) on non-Android platforms.
- `expo-module.config.json` — autolinking metadata.

### 2. JS controller — `lib/background-service.ts`

Thin, Android-guarded, idempotent wrapper over the module: `enableBackgroundService()` / `disableBackgroundService()` / `isBackgroundServiceEnabled()`. Never throws (logs on failure). Keeps the native import dynamic so web/server bundles stay clean.

### 3. Settings — opt-in toggle

- `AppSettings.backgroundServiceEnabled: boolean` (persisted via the `settings` collection, so it syncs like other settings).
- A **Background refresh** switch in Settings: turning it on calls `enableBackgroundService()` (and shows the persistent notification), off calls `disableBackgroundService()`. Copy explains the persistent notification and battery cost, and that it only helps while the device is awake.

### 4. Trigger — unchanged

`expo-background-task` (WorkManager, honours the Check Interval setting) keeps running `runPriceCheckCore` / `checkHealthAlerts` as today. The service only keeps the process + hidden WebView host alive so those fetches can render. No new scheduler, no new task.

### 5. Data flow

1. User enables **Background refresh** → `startForegroundService()` → persistent notification.
2. WorkManager fires the price-check task → `runPriceCheckCore` → `resolvePrice` → `getWebViewHost()` is non-null (process alive) → browser fetch renders → price stored.
3. User disables it (or taps **Stop** in the notification) → `stopForegroundService()`.

## Error Handling

- Module unavailable (iOS/web, or autolinking failed) → controller no-ops and the toggle reports "not supported".
- `startForeground` throws (missing permission / type) → caught; the toggle reverts and shows an error.
- The service is idempotent: starting twice does not stack notifications; stopping when not running is a no-op.

## Security & Privacy

- No new data leaves the device; the service only keeps the process alive.
- The notification is required by Android and contains no sensitive data.
- `dataSync` is the correct Play-policy type for periodic price sync.

## Testing

- `tests/background-service.test.ts` — controller: Android-guarded, idempotent, no-throw when the module is missing (mock the native module).
- `tests/settings-background-service.test.ts` — the toggle persists `backgroundServiceEnabled` and calls enable/disable.
- Source guard — the module manifest declares `FOREGROUND_SERVICE_DATA_SYNC` and the service uses `foregroundServiceType="dataSync"`.
- **Device spike (Task 1, gating):** start the service, background the app, trigger a browser-only fetch, confirm a price renders. If it fails, stop and escalate to the overlay design.

## Risks & Mitigations

- **WebView throttled while backgrounded** → the spike decides; fallback is the overlay design (separate spec).
- **Battery** → opt-in, low-importance notification, and the existing Check Interval caps frequency.
- **Play policy** → `dataSync` type is justified; the notification is visible and stoppable.
- **Prebuild fragility** → a local Expo module (autolinked) avoids hand-editing `MainApplication.kt`.

## Success Criteria

- With **Background refresh** on, a browser-only distributor's price updates while the app is closed (verified on the emulator in the spike).
- Turning it off stops the service and the notification.
- `pnpm verify` stays green; no new third-party dependency.
