# Small Correctness Leftovers — Design Spec (2026-09-10)

Five verified small items. No behavior change on success paths; no new patterns. Pulse animation and the shared-util `usd` field explicitly stay as-is (documented, not divergences to fix).

## §A — Shared search chrome

`PillFilterRow` + recent-search helpers + sort-switch move to one `desktop/src/components/` module; Search + SearchModal import it; aria-labels unified to the better variant. Test: suites green + anti-duplication guard.

## §B — Id + trend guards

Reminder/watch ids gain the alert suffix (shared tiny helper if both files need it); trend converts to display currency before diffing with an `oldest > 0` guard (both files verified). Tests: uniqueness, mixed-currency, zero-price.

## §C — Region row parity

Native price + `≈ converted` per row (verbatim mobile), sort order unchanged. Tests: both values render.

## Non-goals

- Pulse animation on desktop; `usd` removal; mobile changes.
