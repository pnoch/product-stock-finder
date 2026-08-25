# Alert Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Edit an existing price alert's target/currency/direction/scope from the alerts tab via the existing modal, preserving triggered history.

**Architecture:** `updateAlert(alertId, patch)` storage method (patch semantics, re-arms on field change); `PriceAlertModal` gains `editingAlertId` copy switch; the alerts tab hosts its own modal instance prefilled from the selected alert.

**Tech Stack:** React Native, TypeScript strict.

---

## File Structure

| File | Change |
|------|--------|
| `lib/storage/alerts.ts` + `index.ts` | +updateAlert |
| `components/product/price-alert-modal.tsx` | +editingAlertId copy |
| `components/alerts/alert-card.tsx` | pencil + onEdit |
| `app/(tabs)/alerts.tsx`, `hooks/use-alerts-data.ts` | edit state/handler/modal |
| `todo.md` | append Phase 101 |

---

## Task 1: updateAlert + modal + wiring

**Files:** all of the above + todo.md

- [ ] **Step 1: Storage — `lib/storage/alerts.ts`**

Add inside the factory (after snoozeAlert):

```typescript
  async function updateAlert(
    alertId: string,
    patch: {
      targetPrice?: number;
      currency?: string;
      direction?: "drop" | "rise";
      distributorId?: string | null;
    },
  ): Promise<void> {
    await enqueue(KEYS.ALERTS, async () => {
      const alerts = await getAlerts();
      const updated = alerts.map((a) => {
        if (a.id !== alertId) return a;
        const next: PriceAlert = { ...a };
        if (patch.targetPrice !== undefined) next.targetPrice = patch.targetPrice;
        if (patch.currency !== undefined) next.currency = patch.currency;
        if (patch.direction !== undefined) next.direction = patch.direction;
        if (patch.distributorId !== undefined)
          next.distributorId = patch.distributorId ?? undefined;
        // Field changes re-arm the alert and clear stale trigger info
        next.triggeredAt = undefined;
        next.triggeredPrice = undefined;
        return next;
      });
      await saveAlerts(updated);
      notify("alerts", alertId);
    });
  }
```

Add `import type { PriceAlert } from "../types";` if absent. Add `updateAlert` to the returned object; add to `lib/storage/index.ts` named exports (composition already spreads alertsStorage).

- [ ] **Step 2: Modal copy switch**

In `components/product/price-alert-modal.tsx`: add optional prop `editingAlertId?: string`; title becomes:

```tsx
            <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "700", flex: 1 }}>
              {editingAlertId ? "Edit Alert" : "Set Price Alert"}
            </Text>
```

and the primary button label:

```tsx
                    {editingAlertId ? "Save Changes" : "Set Alert"}
```

(Locate the existing button text — likely "Set Alert" — and adapt.)

- [ ] **Step 3: Pencil on AlertCard**

New optional prop `onEdit?: (id: string) => void`. Next to the moon button:

```tsx
          {onEdit && (
            <TouchableOpacity
              onPress={() => onEdit(alert.id)}
              style={{ padding: 4 }}
            >
              <IconSymbol name="pencil" size={16} color={colors.primary} />
            </TouchableOpacity>
          )}
```

- [ ] **Step 4: Tab wiring**

1. `hooks/use-alerts-data.ts`: import `updateAlert` from `@/lib/storage`; add handler:

```typescript
  const handleUpdateAlert = useCallback(
    async (
      alertId: string,
      patch: {
        targetPrice: number;
        currency: string;
        direction: "drop" | "rise";
        distributorId: string | null;
      },
    ) => {
      await updateAlert(alertId, patch);
      await loadData();
    },
    [loadData],
  );
```

Return it alongside the others.

2. `app/(tabs)/alerts.tsx`:
   - State:
   ```typescript
     const [editingAlert, setEditingAlert] = useState<PriceAlert | null>(null);
     const [editPrice, setEditPrice] = useState("");
     const [editCurrency, setEditCurrency] = useState("USD");
     const [editDirection, setEditDirection] = useState<"drop" | "rise">("drop");
     const [editDistributorId, setEditDistributorId] = useState<string | null>(null);
   ```
   - Pass `onEdit={handleEditAlert}` to `<AlertCard>` with handler:
   ```typescript
     const handleEditAlert = useCallback(
       (alertId: string) => {
         const alert = alerts.find((a) => a.id === alertId);
         if (!alert) return;
         setEditingAlert(alert);
         setEditPrice(String(alert.targetPrice));
         setEditCurrency(alert.currency);
         setEditDirection(alert.direction ?? "drop");
         setEditDistributorId(alert.distributorId ?? null);
       },
       [alerts],
     );
   ```
   - Render below the existing modals:
   ```tsx
         <PriceAlertModal
           visible={!!editingAlert}
           editingAlertId={editingAlert?.id}
           onClose={() => setEditingAlert(null)}
           onSetAlert={async () => {
             if (!editingAlert) return;
             const price = parseFloat(editPrice);
             if (isNaN(price) || price <= 0) {
               showAlert("Invalid Price", "Please enter a valid target price.");
               return;
             }
             await updateAlert(editingAlert.id, {
               targetPrice: price,
               currency: editCurrency,
               direction: editDirection,
               distributorId: editDistributorId,
             });
             setEditingAlert(null);
             showAlert("Alert Updated", "Your changes have been saved.");
           }}
           alertPrice={editPrice}
           setAlertPrice={setEditPrice}
           alertCurrency={editCurrency}
           setAlertCurrency={setEditCurrency}
           productName={
             editingAlert ? getProductName(editingAlert.productId) : ""
           }
           direction={editDirection}
           onDirectionChange={setEditDirection}
           distributors={[]}
           selectedDistributorId={editDistributorId}
           onSelectDistributor={setEditDistributorId}
         />
   ```
   (`distributors={[]}` hides the chip row here since the scope is edited via the dedicated selector; import PriceAlertModal + updateAlert + showAlert as needed; `getProductName` comes from the hook.)

- [ ] **Step 5: Verify**

Run: `pnpm check` — 0 errors. Run: `pnpm lint` — no new errors. Run: `pnpm test` — all pass.

- [ ] **Step 6: Update `todo.md` + commit + push**

Append Phase 101 section:

```markdown
## Phase 101: Alert Editing (v6.1)

- [x] Add updateAlert storage method (patch semantics, auto re-arm)
- [x] Edit-mode copy in PriceAlertModal
- [x] Pencil entry on alert cards opens prefilled modal on alerts tab
```

Then:

```bash
git add lib/storage components/product/price-alert-modal.tsx components/alerts/alert-card.tsx app/\(tabs\)/alerts.tsx hooks/use-alerts-data.ts todo.md && git commit -m "feat: add alert editing"
git push origin main
```

---

## Summary

| Metric | Value |
|--------|-------|
| New storage method | `updateAlert` (patch + re-arm) |
| UI | pencil → prefilled modal on alerts tab |
