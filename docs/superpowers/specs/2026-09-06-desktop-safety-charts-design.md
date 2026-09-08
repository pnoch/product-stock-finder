# Desktop Safety + Charts A11y — Design

Date: 2026-09-06. Scope: two-step delete, dialog-wide tour keys,
chart labels (approved).

## Problem

1. Desktop account delete is single-confirm; mobile requires
   DELETE + email match.
2. Onboarding arrow keys work only from dot focus, not from
   Next/Back/Skip.
3. Compare SeriesChart and ProductDetail/Rates sparklines are
   unlabeled `<svg>` — invisible to screen readers.

## Approach

Small targeted additions reusing existing patterns. No visual or
structural changes.

## Two-step delete

- `desktop/src/pages/Settings.tsx` Danger Zone: after "Yes, delete
  everything", a second step requires typing to match: the account
  email (`user.email` from `useAuth`) when known, else the literal
  `DELETE` (covers OAuth accounts with null email — mirrors
  mobile's first gate).
- Final Delete button disabled until the input matches exactly
  (case-sensitive for DELETE; case-insensitive trimmed compare for
  email); hint text explains what to type. Existing order
  (server → logout → wipe) and abort behavior unchanged.

## Tour keyboard

- `desktop/src/components/OnboardingModal.tsx`: move the arrow-key
  handler from the dots group div to the dialog content container
  so Left/Right navigate from any focused control (guards: no-op
  at first/last). Dots group keeps its label; buttons unchanged.

## Charts labels

- `SeriesChart` (`desktop/src/pages/Compare.tsx`): svg gains
  `role="img"` + `aria-label` summarizing distributor count and
  overall direction computed from series endpoints (e.g. "Price
  history, 3 distributors, trending down"; flat/mixed wording when
  appropriate — read data shape first).
- ProductDetail + Rates sparklines: `role="img"` + labels with
  trend + first/last values from in-scope data.
- No table fallback: equivalent data tables already sit beside
  each chart.

## Testing

- Source-guard tests: email-match gate, dialog-level key handler,
  chart labels.
- Verification: `pnpm check` (0 errors), `pnpm lint` (no new
  warnings), `pnpm test` (full suite green), desktop `pnpm build`.

## Non-goals

- Visual changes, keyboard chart exploration, email delivery.
- Mobile changes.
