# Polish Follow-Ups — Design Spec (2026-09-10)

Five verified follow-ups from the polish bundle (mostly our own drift) plus one medium product gap. Extract, share, harden — no new patterns, no visual redesign. Leftovers explicitly deferred: white-box wiring test, Home connection badge, responsive Compare width (all low).

## §A — Shared `PriceHistoryChart`

Extract `desktop/src/components/PriceHistoryChart.tsx` (`{data, displayCurrency}` — exact props in planning) from the identical modal/detail blocks; both pages use it. No visual change. Test: fixture render + no-inline-`LineChart` guard (cheaper form in planning).

## §B — Shared time util with edge guards

Move `formatRelativeTime` to `lib/` (vs `shared/` resolved in planning for clean desktop import); mobile deletes its copy. Harden: negative → "Just now", non-finite → "—". No valid-input change. Tests: future/NaN cases both suites.

## §C — Insight failure hardening

Mirror the web 4s `Promise.race` timeout on the Tauri invoke path (null-on-timeout → renders nothing); three silent catches gain dev `console.error` (UI stays silent by design). Test: deferred-invoke timeout + log assertion.

## §D — Converted row prices

`≈ {formatPrice(converted, displayCurrency)}` under native price when currencies differ — verbatim mobile. `displayCurrency` in scope. Test: mixed shows, same hides.

## Non-goals

- White-box test rewrite; Home badge; Compare responsive width; insight content; chart redesign.
