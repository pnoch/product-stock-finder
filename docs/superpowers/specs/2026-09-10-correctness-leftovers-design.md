# Correctness Leftovers — Design Spec (2026-09-10)

Six verified leftovers. Three get code fixes, one gets a retry mechanism, two are honestly documented limits (analysis recorded, no half-measures).

## §A — Shared seed logic

Extract `seedWatchlistProducts(deps)` to `lib/launch-seed.ts` (same DI shape as `runLaunchSequence`); mobile `_layout` + desktop `launch.ts` call it. Byte-identical. Test: root unit (seed/skip/backfill).

## §B — Stable preview tail

`sortPreviewByStock`: scored (>0) first by score desc, unscored in original order (no fake scores; `0`-for-unknown test stays). Call sites unchanged. Test: order preservation.

## §C — Timeout contract + unregister retry

`withTimeout` contract comment (never race nullable-typed promises; audit existing callers qualify). Logout/disable bound attempts with 5s timeout; failure sets `pending_push_unregister` flag retried first by `syncDesktopNotifications`, cleared on success. Tests: bounded attempt, flag lifecycle.

## §D — Documented platform limits

macOS/Windows tray clicks stay focus-only (no click-callback API in those notify-rust backends — comment at fallback); Linux `spawn_blocking` waiter acceptable (512-thread pool vs rare bursts — comment at call site). No code change, recorded here.

## Non-goals

- macOS/Windows click detection; thread-pool rework; push TTL; mobile unregister adoption.
