# Basket Alert Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Notify when total watchlist value drops below a user-set threshold; auto-disables after firing.

**Architecture:** `basketAlertThreshold` on AppSettings (syncs); client evaluation in `runPriceCheckCore`; bell + sheet on the Stats screen's BasketValueCard.

**Tech Stack:** React Native, TypeScript strict, expo-notifications.

---

## File Structure

| File | Change |
|------|--------|
| `lib/types.ts` | `AppSettings.basketAlertThreshold?: number \| null` |
| `lib/background-tasks/price-check.ts` | evaluation |
| `components/stats/basket-alert-sheet.tsx` | new sheet |
| `components/stats/basket-value-card.tsx` | +bell button/active state |
| `app/stats.tsx` | sheet state + wiring |
| `todo.md` | append Phase 104 |

---

## Task 1: Type + evaluation + UI

**Files:** all of the above + todo.md

- [ ] **Step 1: Type**

`lib/types.ts` — AppSettings gains:
```typescript
  basketAlertThreshold?: number | null;
```
(DEFAULT_SETTINGS in settings storage stays without it — undefined = off.)

- [ ] **Step 2: Evaluation**

In `lib/background-tasks/price-check.ts`, inside `runPriceCheckCore`, after the digest section and BEFORE the price-alerts early return (`if (!settings.notificationsEnabled || !settings.priceAlerts) return;`) — note this check must run even when priceAlerts is off, so place it before that line but after notificationsEnabled is known:

```typescript
  // Basket value alert (fires once per set threshold)
  if (settings.notificationsEnabled && settings.basketAlertThreshold) {
    const fresh = await getWatchlist();
    const total = fresh.reduce(
      (sum, p) =>
        sum +
        (getBestPrice(p.listings ?? [], "USD")?.price ?? 0),
      0,
    );
    const threshold = settings.basketAlertThreshold;
    if (
      total > 0 &&
      total <= threshold &&
      (!settings.basketAlertLastFired ||
        Date.now() - new Date(settings.basketAlertLastFired).getTime() >
          86400000)
    ) {
      const granted = await requestNotificationPermissions();
      if (granted) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "🧺 Basket Alert",
            body: `Watchlist value ${formatPrice(total, "USD")} dropped below your ${formatPrice(threshold, "USD")} threshold.`,
            data: { type: "digest" },
            sound: true,
          },
          trigger: null,
        });
      }
      // Auto-disable so it fires once per set
      await saveSettings({
        ...settings,
        basketAlertThreshold: null,
      });
    }
  }
```

Simplification decision: drop `basketAlertLastFired` — auto-disable already prevents repeats; remove that condition. Final guard: `if (total > 0 && total <= threshold)`.

Imports: `getBestPrice` from "../currency", `saveSettings` added to the existing storage import, `formatPrice` already imported.

- [ ] **Step 3: Sheet component**

Create `components/stats/basket-alert-sheet.tsx` — modal sheet (ManualAddSheet shell): TextInput numeric keyboard prefilled with current threshold; buttons Enable / Disable; save via props:

```typescript
interface BasketAlertSheetProps {
  visible: boolean;
  onClose: () => void;
  currentThreshold: number | null;
  onSave: (threshold: number | null) => void;
}
```

Enable validates numeric > 0 and calls `onSave(value)`; Disable calls `onSave(null)`; both close.

- [ ] **Step 4: BasketValueCard + stats wiring**

1. `BasketValueCard`: new optional props `{ alertThreshold?: number | null; onOpenAlert?: () => void }`; when `onOpenAlert` set, render a small bell TouchableOpacity next to the title:
```tsx
          <TouchableOpacity onPress={onOpenAlert} hitSlop={8}>
            <IconSymbol
              name={alertThreshold ? "bell.fill" : "bell"}
              size={14}
              color={alertThreshold ? colors.primary : colors.muted}
            />
          </TouchableOpacity>
```
and when active show under caption: `🔔 Alert below {formatPrice(threshold, "USD")}`.
ICON CHECK: verify `bell`/`bell.fill` mapped (bell.fill exists).

2. `app/stats.tsx`: state `basketSheetVisible`; load/save threshold via settings (extend existing mount Promise.all? settings already loaded into `settings` state — add `setBasketThreshold(settings.basketAlertThreshold ?? null)` local state); onSave handler:

```typescript
  const handleSaveBasketAlert = useCallback(
    async (threshold: number | null) => {
      setBasketThreshold(threshold);
      const s = await getSettings();
      await saveSettings({ ...s, basketAlertThreshold: threshold });
    },
    [],
  );
```

(import getSettings/saveSettings — getSettings already imported; add saveSettings.) Pass `alertThreshold={basketThreshold}` + `onOpenAlert` to `<BasketValueCard>`; render `<BasketAlertSheet>` with currentThreshold + onSave.

- [ ] **Step 5: Verify**

Run: `pnpm check` — 0 errors. Run: `pnpm lint` — no new errors. Run: `pnpm test` — all pass.

- [ ] **Step 6: Update `todo.md` + commit + push**

Append Phase 104 section:

```markdown
## Phase 104: Basket Alert (v6.4)

- [x] Add basketAlertThreshold setting (synced)
- [x] Evaluate in background price check; fires once then auto-disables
- [x] Bell + threshold sheet on Stats basket card
```

Then:

```bash
git add lib/types.ts lib/background-tasks/price-check.ts components/stats/basket-alert-sheet.tsx components/stats/basket-value-card.tsx app/stats.tsx todo.md && git commit -m "feat: add basket value alert"
git push origin main
```

---

## Summary

| Metric | Value |
|--------|-------|
| Setting | `basketAlertThreshold?: number \| null` |
| Eval | client-side, once per set |
| UI | bell + sheet on Stats basket card |
