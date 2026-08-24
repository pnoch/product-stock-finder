# Notification Deep Links — Design Spec

**Date:** 2026-09-16
**Goal:** Tapping any notification routes to its target: product notifications → `/product/{id}`, digest → `/stats`, health → `/health`.

## Current State

Notification payloads carry only `productName`/`distributorName` — no `productId`. The response listener in `setupNotifications` records dedup IDs but never navigates. Server-pulled events lose `productId` when re-scheduled locally (`scheduleServerEventNotification(title, body)`).

## Payload Plumbing (lib/notifications.ts)

Add trailing optional `productId?: string` to:
- `scheduleStockAlert(productName, distributorName, price, currency, productId?)`
- `schedulePriceAlert(productName, targetPrice, currency, productId?)`
- `scheduleBackOrderReminder(productName, distributorName, reminderDate, productId?)`
  → each includes `productId` in `content.data`.

- `sendPriceDigestNotification(title, body)` → adds `data: { type: "digest" }`.
- `scheduleServerEventNotification(title, body, data?: Record<string, unknown>)` → merges into data.

Health notifications already carry type; they route to `/health` by type alone.

## Tap Routing (app/_layout.tsx)

Inside the existing notifications setup effect:

```typescript
const handleResponse = (response: Notifications.NotificationResponse) => {
  const data = response.notification.request.content.data as {
    productId?: string;
    type?: string;
  };
  if (data.productId) router.push(`/product/${data.productId}`);
  else if (data.type === "digest") router.push("/stats");
  else if (data.type?.startsWith("health")) router.push("/health");
};
```

- Use expo-router's standalone `import { router } from "expo-router"` (valid outside React).
- Subscribe via `addNotificationResponseReceivedListener(handleResponse)` alongside the existing dedup listener.
- Cold start: `getLastNotificationResponseAsync()` handled once with a module-level flag to avoid double-push (listener + initial both firing); store last-handled response id.

## Caller Updates

Pass the productId each site already has:
- `lib/restock.ts:51` + `app/product/[id].tsx:155,416` (stock alerts)
- `app/product/[id].tsx:250,485` + `app/compare/[id].tsx:136` (price alerts / confirmations)
- `app/product/[id].tsx:443` (back-order reminder)
- `lib/server-notifications.ts:158` → `scheduleServerEventNotification(event.title, event.body, { productId: event.productId })`

## Testing

No new pure logic (routing is IO). Suite green; manual verification: tap price-alert notification → product detail opens.

## File Summary

| File | Modify |
|------|--------|
| `lib/notifications.ts` | payload plumbing |
| `app/_layout.tsx` | tap routing |
| `lib/restock.ts`, `app/product/[id].tsx`, `app/compare/[id].tsx`, `lib/server-notifications.ts` | pass productId |
| `todo.md` | append Phase 100 |
