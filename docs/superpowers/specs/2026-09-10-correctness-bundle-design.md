# Correctness Bundle — Design Spec (2026-09-10)

Five verified small items. No new features, no visual redesign, no success-path behavior change. Server health persistence explicitly deferred (schema + retention questions = separate feature).

## §A — Chart null-guard

Filter null/non-finite converted prices in `PriceHistoryChart` before mapping; all-filtered renders the Compare `SeriesChart` "No data" empty state. Tooltip then only sees real numbers. Test: unknown-currency points vanish (no `$0.00`); all-unknown → empty state.

## §B — Direct storage calls

`Alerts.tsx:138-143`: drop `?.` + `undefined` guards, call directly (methods provably exist). Catch path unchanged. Existing error-path tests stay green.

## §C — Shared `withTimeout`

Extract `withTimeout<T>(promise, ms): Promise<T | null>` (`lib/` preferred per relative-time precedent); both insight branches use it at 4000ms; unify log strings. Test: value/timeout units + skeleton suites green.

## §D — Stateless health contract

Document `memoryAdapter` as stateless-by-design (client persists); test pins cross-call independence. No persistence work.

## §E — Settings connection text

Mirror mobile status explanations + last-checked via existing `formatLastRefreshed`; badge/button unchanged. Test per-status copy.

## Non-goals

- Server health persistence; push notifications; health probing (separate specs); chart redesign.
