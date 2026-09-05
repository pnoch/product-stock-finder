# Silent Failures + Auth Log Leak — Design

Date: 2026-09-06. Scope: gate prod logging, make catch blocks visible
in dev, no user-facing behavior change (approved).

## Tier 1 — `lib/_core/auth.ts`: gated logging, no secrets

- Add the `__DEV__`-gated two-liner copied from `lib/_core/api.ts:5-6`:
  `const LOG = __DEV__ ? console.log.bind(console) : () => {};` and
  `LOG_ERROR` for `console.error`.
- Replace all ~15 `console.log` / `console.error` calls with `LOG` /
  `LOG_ERROR`.
- Stop logging secrets: token prefix (`token.substring(0, 20)`) becomes
  `present` / `missing`; full `user` object becomes `user.id`.
- Nothing else in the file changes; auth flow, SecureStore usage, and
  web/localStorage branches are untouched.

## Tier 2 — `lib/notifications.ts`: explicit fail-open quiet-hours

- In `scheduleHealthAlert`, the settings-read `catch {}` becomes a
  gated error log (same two-liner pattern, added locally if the file
  has none): proceed to send the alert, log the failure in dev.
- Rationale (approved): distributor-down/blocked alerts are rare and
  high-value; a broken storage read must not silently swallow them.
  Quiet hours remains a soft preference enforced on the happy path.
- No change to scheduling, web/native branches, or thresholds.

## Tier 3 — UI catches: dev-logging only

Add gated `LOG_ERROR` calls (per-file two-liner where absent; no shared
helper — two lines per file matches the `api.ts` precedent) to:

- `app/(tabs)/watchlist.tsx`: queued-badge refresh (`getSyncMeta` /
  `countQueuedEdits`), settings persist, `handleShareWatchlist`.
- `app/compare/[id].tsx`: image-capture fallback catch (flow stays:
  fall back to text share).
- `app/product/[id].tsx`: image-capture fallback catch (same).

Flows, toasts, haptics, and fallback order are unchanged. The
image→text share fallback is correct behavior; only its invisibility
in dev is fixed.

## Testing

- Source-guard tests: no bare `console.log(`/`console.error(` remains
  in `lib/_core/auth.ts` outside the gated definitions; each listed
  catch site references the gated logger. Out of scope and intentionally
  left silent: user-cancellation catches around `Share.share`
  (`app/compare/[id].tsx`, `app/product/[id].tsx` dismissal path) —
  cancellation is not an error.
- Verification: `pnpm check` (0 errors), `pnpm lint` (no new warnings),
  `pnpm test` (full suite green).
- No behavior tests: nothing user-visible changes by design.

## Non-goals

- No new user-facing error toasts or dialogs.
- No notification send/suppress behavior change.
- No shared logging helper; no changes to `lib/_core/api.ts`.
