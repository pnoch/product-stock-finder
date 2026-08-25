# Alert Editing — Design Spec

**Date:** 2026-09-17
**Goal:** Let users edit an existing price alert's target price, currency, direction, and distributor scope from the alerts tab — without deleting and recreating.

## Storage

`lib/storage/alerts.ts` + composition + named export:

```typescript
async function updateAlert(
  alertId: string,
  patch: {
    targetPrice?: number;
    currency?: string;
    direction?: "drop" | "rise";
    distributorId?: string | null;
  },
): Promise<void>
```

- enqueue(KEYS.ALERTS) pattern; patches only provided fields; `distributorId: null` clears scoping; clears `triggeredAt`/`triggeredPrice` when target/currency/direction change (re-arms the alert); notifies.

## Modal

`components/product/price-alert-modal.tsx`: new optional prop `editingAlertId?: string`. When set:
- Title: "Edit Alert" (instead of default)
- Primary button label: "Save Changes"

Host decides create-vs-update via its own state; the modal only adjusts copy.

## Alerts Tab Wiring

- State in the tab: `editingAlert: PriceAlert | null`.
- Pencil button on `AlertCard` (new optional prop `onEdit?`) → sets `editingAlert`, prefills `alertPrice/alertCurrency/alertDirection/alertDistributorId` from the alert, opens modal.
- The tab renders its own `<PriceAlertModal>` instance (visible when editing) with `onSetAlert` branching to `updateAlert(editingAlert.id, {...})` then reload.
- Server config picks up edits on next upload (whole-alert serialization).

## Testing

No new pure logic (storage patch follows existing patterns); suite green.

## File Summary

| File | Modify |
|------|--------|
| `lib/storage/alerts.ts` + `index.ts` | +updateAlert |
| `components/product/price-alert-modal.tsx` | editingAlertId copy |
| `components/alerts/alert-card.tsx` | pencil + onEdit |
| `app/(tabs)/alerts.tsx`, `hooks/use-alerts-data.ts` | edit state/handler |
| `todo.md` | append Phase 101 |
