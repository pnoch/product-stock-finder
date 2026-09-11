# Sync Correctness — Design Spec (2026-09-10)

Six verified items around desktop sync/probe timeouts, races, and contract drift. No behavior change on success paths; overlap and leak classes eliminated. Token-unregister endpoint explicitly deferred (needs server API — separate spec).

## §A — Timeout unification + leak fix

`withTimeout` clears its timer on settle; desktop `server-notifications.ts` adopts it (2 races); `manual-add-sheet.tsx`'s reject-variant renames to `withTimeoutReject` with a comment (semantics kept). Tests: timer-cleanliness + suites green.

## §B — Probe handler + single write

Extract `emitHealthEvent(kind, ...)` (notify + history + in-memory append); one `savePendingHealthEvents` after the loop. Copy byte-identical. Tests: existing 7 unmodified + batching test (two distributors → one save).

## §C — Sync guard + master switch

Mirror `syncInFlight` (overlap shares in-flight promise); port mobile's `!notificationsEnabled` early-return verbatim (empty config + clear buffer + skip pull). Tests: shared-promise overlap + retract.

## Non-goals

- Token unregister endpoint; server changes; Rust changes; mobile changes.
