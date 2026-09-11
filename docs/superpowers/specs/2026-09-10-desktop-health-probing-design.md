# Desktop Health Probing — Design Spec (2026-09-10)

The desktop Health Alerts toggle is honored nowhere: no scheduled probes, no evaluation, and `HealthDetail` promises probes that never run. Mirror mobile's foreground task. Server-side probing (closed-app coverage) is a separate future spec; this one covers the open app.

## §A — Probe module

New `desktop/src/lib/health-probe.ts`: `runHealthProbeIfDue()` gates on settings (`notificationsEnabled`, `healthAlerts`, `checkInterval` — `manual` skips), due-check via stored `lastHealthProbeAt` (hourly/daily; key in planning), and `isInQuietHours`. Probes Tauri-first with `health.check` tRPC fallback, saves via the desktop `healthService`, evaluates `detectHealthAlert`/`detectHealthRecovery` per distributor, then `sendDesktopNotification` + history record + pending-event queue + upload trigger. Tests: transition-fires-once, quiet-hours suppression, manual skip, recovery.

## §B — Scheduling

Hook into the existing 60s `App.tsx` foreground poller (best-effort + dev log, never throws). No new timers. `HealthDetail` copy becomes true with no edit. Test: poller calls the module; no unhandled rejections.

## §C — Pending events + upload

Desktop storage gains `getPendingHealthEvents`/`savePendingHealthEvents` (mobile shapes); `uploadConfig` gains `healthEvents` (server already accepts them — exact shape in planning); `syncDesktopNotifications` includes and clears-on-success (failure retention per mobile semantics, confirmed in planning). Tests: accumulate/include/clear/retain.

## Non-goals

- Server-side scheduled probing; Rust changes; new timers; quiet-hours redesign; mobile changes.
