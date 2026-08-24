# Price-Increase Alerts — Design Spec

**Date:** 2026-09-07
**Goal:** Support alerts that fire when the price rises above a target, alongside existing drop alerts.

## Type

`PriceAlert.direction?: "drop" | "rise"` — absent/undefined means `"drop"` (backward-compatible with all stored alerts).

Evaluation metric stays identical for both directions: the **best (cheapest) in-stock price** converted to the alert currency, distributor-scoped via `listingsForAlert`. Rise semantics: even the cheapest offer is at/above target → fire.

## Client Evaluation (lib/background-tasks/price-check.ts)

In the active-alerts loop:
- drop: fire when `bestPrice <= alert.targetPrice`
- rise: fire when `bestPrice >= alert.targetPrice`
- Notification copy branches:
  - drop: "💸 Price Drop Alert!" / "…is now X — below your target of Y!"
  - rise: "📈 Price Increase Alert!" / "…is now X — above your target of Y!"
- Both auto-deactivate after firing (existing `deactivateAlert` path).

## Server Evaluation (server/notifications/build-events.ts)

- Same comparison branch per direction.
- Dedup key: `price_drop:{alertId}` vs `price_rise:{alertId}`.
- Push title/body copy branches mirroring client.
- Config upload already serializes whole alerts → `direction` flows automatically; no schema change.

## Modal (components/product/price-alert-modal.tsx)

Segmented control above the price input: **"Drops below"** / **"Rises above"** (default Drops). New props `direction?: "drop" | "rise"` + `onDirectionChange?`. Hidden when props absent.

## Screen Wiring (app/product/[id].tsx)

- State `alertDirection` ("drop" default), reset to "drop" on modal open.
- Pass props to modal; include `direction: alertDirection` in `handleSetAlert`'s PriceAlert.
- Success message verb adapts ("drops below"/"rises above").

## Alerts List

`components/alerts/alert-card.tsx`: direction arrow before the Target row — ▲ (error color) for rise, ▼ (success color) for drop; same in `triggered-alert-card.tsx`.

## Testing

Pure comparison logic is trivial; covered indirectly by existing suites. Focus tests: none new required beyond suite green (UI wiring). Optional: extend if a pure helper emerges.

## File Summary

| File | Modify |
|------|--------|
| `lib/types.ts` | +direction field |
| `lib/background-tasks/price-check.ts` | branch eval + copy |
| `server/notifications/build-events.ts` | branch eval + dedup + copy |
| `components/product/price-alert-modal.tsx` | segmented control |
| `app/product/[id].tsx` | state + wiring |
| `components/alerts/alert-card.tsx`, `triggered-alert-card.tsx` | arrow badge |
| `todo.md` | append Phase 91 |
