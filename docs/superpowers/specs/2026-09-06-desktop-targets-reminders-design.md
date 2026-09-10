# Desktop Targets + Per-Row Reminders — Design

Date: 2026-09-06. Scope: target overview table and scoped
reminder creation on desktop detail (approved; second of
product-detail split).

## Problem

1. No consolidated view of which distributors have targets and
   how far away they are (mobile `TargetTableCard`).
2. Reminders can only target the best listing (mobile scopes per
   row via `ReminderDatePickerModal`).

## Approach

Mirror mobile logic with desktop UI (table card + shared Modal
with native date input). Reminders stay data-only like existing
desktop reminders (no local scheduling). No server changes.

## Target overview

- `desktop/src/pages/ProductDetail.tsx`: table card using
  `scopedAlertFor` / `productWideAlert` / `alertDeltaPct` from
  `lib/alert-scope.ts` (imports verified desktop-safe: types +
  live currency) — one row per listing: distributor, current
  price, target (scoped or product-wide or "—"), delta % vs
  current. Read-only; target setting stays in the per-row alert
  modal.

## Per-row reminders

- Distributor rows gain a Remind action opening the shared
  `Modal` with a native `<input type="date">` (pattern mirrors
  the Alerts reschedule modal) scoped to that listing.
- Save: `storage.addBackOrderReminder({ id:
  \`reminder-{productId}-{distributorId}-{Date.now()}\`,
  productId, productName, distributorId, distributorName,
  reminderDate: picked.toISOString(), createdAt: now,
  reminderType: "date" })` (mobile field shape) + toast; visible
  in Alerts like existing desktop reminders.

## Testing

- Source-guard tests: overview table, modal, add call.
- Verification: `pnpm check` (0 errors), `pnpm lint` (no new
  warnings), `pnpm test` (full suite green), desktop `pnpm build`.

## Non-goals

- Local notification scheduling, reminder editing from detail
  (Alerts owns it), mobile changes.
