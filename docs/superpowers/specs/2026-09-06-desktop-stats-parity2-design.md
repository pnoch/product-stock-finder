# Desktop Stats Feature Parity 2 — Design

Date: 2026-09-06. Scope: basket alerts, calendar keyboard,
formatted sparkline values, share chooser (approved).

## Problem

1. No basket-alert threshold on desktop (mobile persists
   `basketAlertThreshold` + sheet UI).
2. Drop-calendar day cells are mouse/tooltip-only divs.
3. Sparkline labels announced raw numbers without currency.
4. Stats share auto-tries PNG with silent text fallback — no user
   choice.

## Approach

Mirror mobile logic with desktop UI; explicit user choice over
silent fallback. No server changes.

## Basket alerts

- `desktop/src/pages/Stats.tsx`: threshold state via
  `basketAlertThreshold` settings key (load on mount, same key
  mobile syncs); modal sheet (input, Enable-validated-`> 0` /
  Disable, same as mobile `BasketAlertSheet`) opened from the
  basket card ("Set alert" button).
- Banner in the basket card when `basket.total` drops below a set
  threshold.

## Calendar keyboard

- Day cells with drops become `<button type="button">` (title
  tooltip kept); grid container `role="grid"`, rows
  `role="row"` (or row-less grouping if markup is flat —
  implementer reads first), cells `role="gridcell"` with
  `aria-label` = tooltip content (date + count + biggest %).
  Empty days stay plain muted divs (not focusable).
- No dialog opens (nothing new to show); focusability +
  announcement is the fix.

## Formatted sparkline values

- `PriceSparkline` (ProductDetail) gains `currency` prop from
  `bestListing.currency` at the call site; label uses
  `formatPrice(first, currency)` / `formatPrice(last, currency)`.
- Rates `Sparkline` gains `currency` prop from the row `code`;
  label uses `formatPrice` similarly.
- Raw-number fallback only when currency is unavailable (should
  not happen — both call sites have it; assert via tsc, not
  runtime branches).

## Share chooser

- Replace auto-PNG-first with two buttons beside the header:
  "Copy text" (clipboard path + toasts, extracted as-is) and
  "Save image" (PNG path + toasts).
- Save-image failure toasts an error (no silent text fallback —
  the chooser makes both paths explicit).

## Testing

- Source-guard tests: sheet + threshold key, grid roles, currency
  props, chooser buttons.
- Verification: `pnpm check` (0 errors), `pnpm lint` (no new
  warnings), `pnpm test` (full suite green), desktop `pnpm build`.

## Non-goals

- Background basket notifications (pipeline-owned), PNG of new
  cards (uses existing summary ref), mobile changes.
