# Desktop Notification History + Badges — Design

Date: 2026-09-06. Scope: record Rust trigger events to history,
badge the sidebar (approved).

## Problem

Desktop price-drop checks run in Rust and fire system
notifications, but TypeScript never sees trigger events — the
Notifications tab is permanently empty and nothing counts
unread. Restock watches aren't evaluated in Rust at all
(price-alerts only).

## Approach

Rust returns structured trigger JSON; TS records via the
existing `recordNotificationEvent` (single history schema,
dedupes by id, caps 200). System-notification + deactivation
flow untouched.

## Structured trigger event

- `desktop/src-tauri/src/lib.rs`
  `check_price_drops_inner` (which already holds the `app`
  handle and builds per-trigger data in its loop): after sending
  the system notifications, `app.emit("price-drops-triggered",
  events_json)` with `[{ productId, productName, bestPrice,
  currency, targetPrice }]` (all in scope in the loop). The
  `String` return (summary toast path) stays untouched.
- Rust unit test for the events payload shape (existing
  `#[cfg(test)]` module).

## TS recording

- `desktop/src/background.ts`: `onPriceDropsTriggered(callback)`
  listener for the new event (mirroring `onPricesChecked`);
  subscribed once in `App.tsx` beside the existing listener.
  Handler records each event via `recordNotificationEvent`
  (`{ id: \`price-drop-{productId}-{Date.now()}\`, type:
  "price-drop", title, body, productId, createdAt }` — match
  `NotificationHistoryEntry` fields; read them first), each in
  its own try/catch so recording never breaks the check.
- Browser path unchanged (no Rust trigger detection on web;
  refreshViaServer counts only).

## Badges

- Sidebar Alerts item: unread bubble from
  `getNotificationHistory` (`!read` count), loaded on mount +
  window focus (mirror Watchlist queued-count pattern). Alerts
  tab headers already show unread — untouched.

## Testing

- Rust `cargo test` for the JSON shape; TS tests for
  parse + record (mock invoke); guards (recording call,
  badge).
- Verification: `pnpm check`, `pnpm lint`, `pnpm test`,
  desktop `pnpm build`, `cargo check` + `cargo test`
  (workdir `desktop/src-tauri`).

## Non-goals

- Restock-watch triggers in Rust, server push, mobile changes.
