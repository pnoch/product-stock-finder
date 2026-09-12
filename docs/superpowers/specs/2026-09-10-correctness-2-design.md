# Correctness Bundle 2 — Design Spec (2026-09-10)

Four verified items: one real auth race, one observability gap, one shared-table extraction, one timer leak. No success-path behavior change.

## §A — Authenticated logout unregister

`logout` awaits the bounded unregister BEFORE clearing the session (callers already fire-and-forget; 5s cap bounds it). Failure sets the retry flag while a session still exists to retry with. Test: Authorization present at mutate time; offline sets flag + completes.

## §B — Audible unregister failures

Dev `console.error` on false paths (cause-distinguishable), boolean contract kept. Test: failing mutate logs once.

## §C — Shared route mapping

`notificationRouteFor(data): string | null` in `lib/` (three arms verbatim, null unknown); mobile falls back `/(tabs)`, desktop `/`. Tests: shared units + per-platform fallbacks.

## §D — Reject-timer hygiene

`withTimeoutReject` gains the shared `finally`-clear idiom; reject semantics untouched. Test: timer-count leak test.

## Non-goals

- Push TTL; token UX; mobile unregister adoption; reconcile logging (separate item, untouched).
