# Basket Alert — Design Spec

**Date:** 2026-09-20
**Goal:** Notify when total watchlist value drops below a user-set threshold; fires once per set, then auto-disables.

## Setting

`AppSettings.basketAlertThreshold?: number | null` — USD (matches existing total-value metrics); null/absent = disabled. Syncs inside settings.

## Evaluation

In `runPriceCheckCore` after prices refresh and before the price-alerts section:
- Skip unless `settings.notificationsEnabled`.
- Compute total best in-stock value across the fresh watchlist (same reduce as digest summary).
- If threshold set and `total <= threshold`: fire "🧺 Basket Alert" notification ("Watchlist value $X dropped below your $Y threshold"), then clear the threshold via `saveSettings({...settings, basketAlertThreshold: null})`.

## UI

- `components/stats/basket-alert-sheet.tsx` — modal sheet: TextInput (numeric), Enable / Disable buttons.
- `BasketValueCard` gains bell toggle showing active state ("🔔 below $Y"); opens the sheet.
- Sheet lives on Stats screen; saves via `getSettings`/`saveSettings`.

## Testing

Suite green; manual verification documented.

## File Summary

| File | New/Modify |
|------|-----------|
| `lib/types.ts` | +basketAlertThreshold |
| `lib/background-tasks/price-check.ts` | evaluation |
| `components/stats/basket-alert-sheet.tsx` | new |
| `components/stats/basket-value-card.tsx` | +bell |
| `app/stats.tsx` | wiring |
| `todo.md` | append Phase 104 |
