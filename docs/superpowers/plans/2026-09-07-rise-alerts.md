# Price-Increase Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support `"rise"` direction on price alerts — fire when the best in-stock price rises to/above target — across modal creation, client evaluation, server evaluation, and alerts list UI.

**Architecture:** New optional `direction?: "drop" | "rise"` on PriceAlert (absent = drop). Evaluation metric unchanged (best cheapest in-stock price, distributor-scoped); comparison and copy branch per direction. Server events gain a `"price_rise"` type so clients deactivate their local copies.

**Tech Stack:** TypeScript strict, vitest, tRPC/Drizzle backend.

---

## File Structure

| File | Change |
|------|--------|
| `lib/types.ts` | `PriceAlert.direction?`; `NotificationEvent.type` + `"price_rise"` |
| `server/notifications/types.ts` | config alert entries + event type + `"price_rise"` |
| `server/notifications/build-events.ts` | rise branch (eval/dedup/copy) |
| `lib/background-tasks/price-check.ts` | rise branch (eval/copy) |
| `lib/server-notifications.ts` | stale-check + reconcile for `price_rise` |
| `components/product/price-alert-modal.tsx` | Drops/Rises segmented control |
| `app/product/[id].tsx` | direction state + wiring |
| `components/alerts/alert-card.tsx`, `triggered-alert-card.tsx` | ▲/▼ badge |
| `todo.md` | append Phase 91 |

---

## Task 1: Types + both evaluators

**Files:**
- Modify: `lib/types.ts`, `server/notifications/types.ts`, `server/notifications/build-events.ts`, `lib/background-tasks/price-check.ts`, `lib/server-notifications.ts`

- [ ] **Step 1: Extend types**

`lib/types.ts`:
```typescript
export interface PriceAlert {
  // ...existing fields...
  direction?: "drop" | "rise"; // absent = drop
}
```
And in BOTH event-type unions (lines ~27 and ~118 — inspect each context first): add `"price_rise"` alongside `"price_drop"`.

`server/notifications/types.ts`: in `NotificationConfig.alerts` entry add `direction?: "drop" | "rise";`; in `NotificationEvent.type` union add `"price_rise"`.

- [ ] **Step 2: Server rise branch (`server/notifications/build-events.ts`)**

In the `config.alerts` loop of `buildEvents`, replace:

```typescript
    if (bestPrice === null || bestPrice > alert.targetPrice) continue;
    events.push({
      id: newEventId(),
      type: "price_drop",
      dedupKey: `price_drop:${alert.id}`,
      title: "💸 Price Drop Alert!",
      body: `${product.name} is now ${formatPrice(bestPrice, alert.currency)} — below your target of ${formatPrice(alert.targetPrice, alert.currency)}!`,
```

with:

```typescript
    const isRise = alert.direction === "rise";
    if (isRise) {
      if (bestPrice === null || bestPrice < alert.targetPrice) continue;
    } else {
      if (bestPrice === null || bestPrice > alert.targetPrice) continue;
    }
    events.push({
      id: newEventId(),
      type: isRise ? "price_rise" : "price_drop",
      dedupKey: `${isRise ? "price_rise" : "price_drop"}:${alert.id}`,
      title: isRise ? "📈 Price Increase Alert!" : "💸 Price Drop Alert!",
      body: `${product.name} is now ${formatPrice(bestPrice, alert.currency)} — ${
        isRise ? "above" : "below"
      } your target of ${formatPrice(alert.targetPrice, alert.currency)}!`,
```

(payload and rest unchanged.)

- [ ] **Step 3: Client rise branch (`lib/background-tasks/price-check.ts`)**

In the active-alerts loop, replace:

```typescript
    if (bestPrice <= alert.targetPrice) {
```

with:

```typescript
    const isRise = alert.direction === "rise";
    const triggered = isRise
      ? bestPrice >= alert.targetPrice
      : bestPrice <= alert.targetPrice;
    if (triggered) {
```

and the notification content:

```typescript
          title: isRise ? "📈 Price Increase Alert!" : "💸 Price Drop Alert!",
          body: `${product.name} is now ${formatPrice(bestPrice, alert.currency)} — ${
            isRise ? "above" : "below"
          } your target of ${formatPrice(alert.targetPrice, alert.currency)}!`,
```

- [ ] **Step 4: Client reconciliation (`lib/server-notifications.ts`)**

Two spots treat only `price_drop` as an alert-firing event — extend both to also handle `price_rise`:

1. Stale check (~line 150):
```typescript
      const staleFired =
        (event.type === "price_drop" || event.type === "price_rise") &&
        event.alertId &&
        !activeAlertIds.has(event.alertId);
      if (!staleFired && !displayedIds.has(event.id)) {
```
(replacing the old `stalePriceDrop` condition)

2. `reconcileEvent` (~line 175):
```typescript
  if (
    (event.type === "price_drop" || event.type === "price_rise") &&
    event.alertId
  ) {
    await deactivateAlert(event.alertId, event.triggeredPrice ?? 0);
  }
```

- [ ] **Step 5: Verify + commit**

Run: `pnpm check` — 0 errors. Run: `pnpm test` — all pass.

```bash
git add lib/types.ts server/notifications/types.ts server/notifications/build-events.ts lib/background-tasks/price-check.ts lib/server-notifications.ts && git commit -m "feat: support rise direction in alert evaluation"
```

---

## Task 2: Modal control + screen wiring + badges + push

**Files:**
- Modify: `components/product/price-alert-modal.tsx`, `app/product/[id].tsx`, `components/alerts/alert-card.tsx`, `components/alerts/triggered-alert-card.tsx`, `todo.md`

- [ ] **Step 1: Segmented control in the modal**

New props: `direction?: "drop" | "rise"` + `onDirectionChange?: (d: "drop" | "rise") => void`. Render above the target-price input (after distributor chips):

```tsx
          {onDirectionChange && (
            <View
              style={{
                flexDirection: "row",
                backgroundColor: colors.background,
                borderRadius: 12,
                padding: 3,
                marginBottom: 16,
              }}
            >
              {(
                [
                  { key: "drop", label: "▼ Drops below" },
                  { key: "rise", label: "▲ Rises above" },
                ] as const
              ).map((opt) => {
                const active = (direction ?? "drop") === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => {
                      if (Platform.OS !== "web")
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onDirectionChange(opt.key);
                    }}
                    style={{
                      flex: 1,
                      paddingVertical: 8,
                      borderRadius: 10,
                      alignItems: "center",
                      backgroundColor: active ? colors.primary : "transparent",
                    }}
                  >
                    <Text
                      style={{
                        color: active ? "#fff" : colors.muted,
                        fontSize: 13,
                        fontWeight: "600",
                      }}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
```

(`TouchableOpacity` already imported.)

- [ ] **Step 2: Screen wiring**

In `app/product/[id].tsx`:
1. State: `const [alertDirection, setAlertDirection] = useState<"drop" | "rise">("drop");`
2. Reset on open (same place `alertDistributorId` resets): `setAlertDirection("drop");`
3. Modal props: `direction={alertDirection}` + `onDirectionChange={setAlertDirection}`.
4. `handleSetAlert`: add `direction: alertDirection,` to `newAlert`; deps += `alertDirection`; success message verb:

```typescript
      `You'll be notified when ${scopeStr}${alertDirection === "rise" ? "rises above" : "drops below"} ${formatPrice(price, alertCurrency)}.`,
```

(merge with the existing scoped-distributor phrasing from Phase 86).

- [ ] **Step 3: Direction badge on cards**

In both `alert-card.tsx` and `triggered-alert-card.tsx`, change the Target row icon from the static `tag.fill` to a direction arrow:

```tsx
            <IconSymbol
              name={alert.direction === "rise" ? "arrow.up" : "arrow.down"}
              size={13}
              color={alert.direction === "rise" ? colors.error : colors.success}
            />
```

ICON CHECK: verify `arrow.up`/`arrow.down` mappings exist; fall back to already-mapped equivalents if not.

- [ ] **Step 4: Verify**

Run: `pnpm check` — 0 errors. Run: `pnpm lint` — no new errors. Run: `pnpm test` — all pass.

- [ ] **Step 5: Update `todo.md` + commit + push**

Append Phase 91 section:

```markdown
## Phase 91: Price-Increase Alerts (v5.39)

- [x] Add direction field to PriceAlert (backward-compatible)
- [x] Branch client + server evaluation and notification copy per direction
- [x] Handle price_rise events in client reconciliation
- [x] Add Drops/Rises segmented control to alert modal
- [x] Show direction arrows on alert cards
```

Then:

```bash
git add components/product/price-alert-modal.tsx app/product/\[id\].tsx components/alerts/alert-card.tsx components/alerts/triggered-alert-card.tsx todo.md && git commit -m "feat: add price-increase alerts"
git push origin main
```

---

## Summary

| Metric | Value |
|--------|-------|
| Type change | `direction?: "drop" \| "rise"` (backward-compatible) |
| Evaluators updated | client + server (+ reconciliation) |
| UI | segmented control + card arrows |
