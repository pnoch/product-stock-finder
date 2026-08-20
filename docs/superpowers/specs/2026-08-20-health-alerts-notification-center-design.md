# Health Alerts in the Notification Center (v5.13) Design

**Date:** 2026-08-20

**Status:** Approved design

## Overview

Health outage and recovery notifications (Phases 63–64) currently appear only in the OS notification tray. This phase records them into the in-app notification center (`notification_history`), so users can review past distributor outages/recoveries, tap through to the distributor's health drill-down page, and see them alongside price drops, restocks, and reminders.

## Decisions

1. **Tap navigation: health drill-down.** Tapping a health entry navigates to `/health/[distributorId]` (the distributor's health drill-down page), not a product page — health events are distributor-level.
2. **Single `"health"` type.** The `NotificationHistoryEntry.type` union gains one new member `"health"`; outage vs recovery is distinguished by a `healthStatus` discriminator field.
3. **Differentiate by status.** Outage entries use the warning triangle icon in warning/amber; recovery entries use the checkmark icon in success/emerald.

## Data Model (`lib/types.ts`)

`NotificationHistoryEntry` changes:

```ts
export interface NotificationHistoryEntry {
  id: string;
  type: "price_drop" | "restock" | "reminder" | "health";
  title: string;
  body: string;
  productId?: string;            // now optional — health entries have no product
  distributorId?: string;
  healthStatus?: "blocked" | "error" | "recovered";  // discriminator for icon/color
  triggeredPrice?: number;
  currency?: string;
  createdAt: number;
  // ... existing fields unchanged (read, notificationId?, reminderType?, lastKnownStatus?)
}
```

- `productId` becomes optional (health events are distributor-level, no product).
- New `healthStatus` discriminator: `"blocked"`/`"error"` for outage alerts, `"recovered"` for recovery notifications.
- `type` union gains `"health"`.

## Recording (`lib/notifications.ts`)

Both `scheduleHealthAlert` and `scheduleHealthRecovery` already create the OS notification; they will also record a history entry via the existing `recordNotificationEvent` (imported from `lib/storage.ts`). Recording happens after a successful schedule, inside each function.

`scheduleHealthAlert` records:

```ts
await recordNotificationEvent({
  id: `health-${distributorName}-${Date.now()}`,
  type: "health",
  title: status === "blocked" ? "🟠 Distributor Blocked" : "🔴 Distributor Down",
  body: `${distributorName} has been ${status} for ${HEALTH_ALERT_THRESHOLD} consecutive probes${reason ? ` — ${reason}` : ""}`,
  distributorId: distributorName,
  healthStatus: status,
  createdAt: Date.now(),
});
```

`scheduleHealthRecovery` records the same shape with `healthStatus: "recovered"`, title "🟢 Distributor Recovered", body "<name> is back online after being <status>".

- `recordNotificationEvent` dedups by `id`, caps at 200, newest-first — all existing behavior, unchanged.
- `distributorId` stores the distributor name (what the notification center needs for navigation).
- Recording only happens on non-web (the schedule functions return early on web), so no web history pollution.

## Notification Center (`components/notification-center.tsx`)

**Type map** gains a `health` entry:

```ts
const TYPE_ICONS: Record<HistoryType, TypeIconName> = {
  price_drop: "dollarsign.circle.fill",
  restock: "checkmark.circle.fill",
  reminder: "clock.fill",
  health: "exclamationmark.triangle.fill",
};
```

**Pure helpers** (exported for testability — no `colors` hook closure):

```ts
export function healthIcon(status?: string): TypeIconName {
  return status === "recovered" ? "checkmark.circle.fill" : "exclamationmark.triangle.fill";
}
export function healthColor(status?: string): "warning" | "success" {
  return status === "recovered" ? "success" : "warning";
}
```

The component resolves actual colors: `colors[healthColor(item.healthStatus)]`.

**Per-item icon/color resolution** replaces the fixed `TYPE_ICONS[item.type]` + color rule:

- icon: `item.type === "health" ? healthIcon(item.healthStatus) : TYPE_ICONS[item.type]`
- color: `item.type === "health" ? colors[healthColor(item.healthStatus)] : item.type === "reminder" ? colors.warning : colors.success`

**Navigation** — branch in `handleOpen`:

```ts
if (item.type === "health") {
  router.push(`/health/${item.distributorId}`);
} else {
  router.push(`/product/${item.productId}`);
}
```

## Error Handling

- `recordNotificationEvent` is already try/catch-safe via `enqueue`; recording failures never break notification scheduling.
- `healthIcon`/`healthColor` are pure and never throw; `healthStatus` being undefined falls back to the outage (warning) rendering.

## Testing

### `tests/health-notifications.test.ts` (new)

Mock `expo-notifications`, `react-native` Platform, and `lib/storage` (following the `tests/push-event-tracking.test.ts` pattern):

- `scheduleHealthAlert` records a history entry with `type: "health"`, `healthStatus: "blocked"`/`"error"`, correct title/body, after a successful schedule
- `scheduleHealthRecovery` records with `healthStatus: "recovered"`
- Neither records on web (`Platform.OS === "web"`)

### `tests/notification-center-helpers.test.ts` (new)

Pure function tests:

- `healthIcon("recovered")` → checkmark; `healthIcon("blocked")`/`healthIcon("error")`/`healthIcon(undefined)` → warning triangle
- `healthColor("recovered")` → `"success"`; `healthColor("blocked")`/`healthColor("error")`/`healthColor(undefined)` → `"warning"`

## Out of Scope

- Web push for health notifications (all health notifications are web-guarded no-ops).
- Server-side health alert mirroring / server-pushed health events.
- Health entries in the notification badge count (they use the existing unread-count machinery automatically).
- Changing the OS notification content (title/body) — only history recording is added.