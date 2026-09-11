# Tray Click Deep-Links — Design Spec (2026-09-10)

OS tray toasts carry no route: the Tauri plugin exposes no click events. Add opaque-route round-tripping (Linux full deep-link; macOS/Windows focus fallback, documented). TS owns the route table, mirroring mobile's `handleNotificationResponse`.

## §A — Rust payload + activation event

Extend `send_notification` with optional `route` (backward-compatible; no-route shows as today). Linux: `spawn_blocking` + `wait_for_action` → emit `notification-activated { route }` + focus main window. Pure `notification_route_for(...)` helper for the poller's price mapping (`/product/{id}`), covered by `cargo test`. No new deps, no plugin changes. Display itself needs a bus (manual QA only).

## §B — Frontend listener + route table

`sendDesktopNotification(title, body, route?)` forwards the route; `onNotificationActivated` (`@tauri-apps/api/event` idiom) subscribed in `App.tsx`; pure `routeForNotification(...)` maps product/digest/health/else → `/product/:id`, `/stats`, `/health`, `/` (unknown → `/`, never dead). Unit-tested.

## §C — Call-site routes

All send sites pass routes: probe (→ `/health`), pulled events (→ product/health per mobile table), test notification (→ `/settings`), Rust poller price drops (→ `/product/{id}`). No-route sends unchanged.

## Non-goals

- macOS/Windows click detection (platform limit, documented); action buttons; mobile changes; Rust notification redesign.
