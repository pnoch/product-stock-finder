# Snooze Alerts — Design Spec

**Date:** 2026-09-15
**Goal:** Let users pause a price alert for 1/7/30 days; both evaluators skip snoozed alerts. Includes fixing the discovered `direction` passthrough bug in the notification config upload.

## Bug Fix (direction passthrough)

The client's `uploadConfig` mapping (`lib/server-notifications.ts` ~line 97) strips fields to `{ id, productId, targetPrice, currency, distributorId }` — `direction` never reaches the server, so Phase 91 rise alerts evaluate as drops server-side. Fix: add `direction: a.direction` to the client mapping, extend the Zod schema in `server/routers.ts`, and add `direction?: "drop" | "rise"` to `NotificationConfig.alerts` entries.

## Type

`PriceAlert.snoozedUntil?: string` (ISO timestamp). Snoozed = `snoozedUntil` set and > now.

## Storage

`lib/storage/alerts.ts` + composition:
```typescript
async function snoozeAlert(alertId: string, days: number): Promise<void>
// days <= 0 → clears snoozedUntil; else sets ISO(now + days*86400000)
```
Follows the existing enqueue+notify pattern of toggleAlert.

## Evaluators

- Client (`lib/background-tasks/price-check.ts`): activeAlerts filter adds `&& (!a.snoozedUntil || new Date(a.snoozedUntil) <= now)` (use Date.now()).
- Server (`server/notifications/build-events.ts`): skip when `alert.snoozedUntil && new Date(alert.snoozedUntil) > now`.

## UI

`components/alerts/alert-card.tsx`:
- New prop `onSnooze?: (id: string) => void`; moon icon button next to the delete control.
- Host (alerts tab) implements the choice sheet: **1 day / 7 days / 30 days / Wake now** → `snoozeAlert(id, n)` / `snoozeAlert(id, 0)` + reload.
- Snoozed cards render "😴 until {date}" under the target row and dim (opacity 0.6).

## Testing

Extend storage-level alert tests if present; otherwise add pure coverage via `tests/alert-scope.test.ts`? No — snooze is storage+filter logic; keep suite green and rely on evaluator filter simplicity. Manual verification path documented.

## File Summary

| File | Modify |
|------|--------|
| `lib/types.ts` | +snoozedUntil |
| `lib/storage/alerts.ts` + `index.ts` | +snoozeAlert |
| `lib/background-tasks/price-check.ts` | skip snoozed |
| `lib/server-notifications.ts` | direction passthrough |
| `server/routers.ts` + `server/notifications/types.ts` + `build-events.ts` | schema/type/skip |
| `components/alerts/alert-card.tsx` + alerts tab host | snooze UI |
| `todo.md` | append Phase 99 |
