# Desktop `price_alerts` Write-Race Fix — Design Spec

**Date:** 2026-10-02
**Goal:** Stop the desktop renderer and the Rust poller from clobbering each other's `price_alerts` writes, and let the UI see the poller's trigger updates.

## Problem

Inside Tauri, two writers touch `price_alerts`:
- the **renderer** mirrors its whole alert array to the file via `set_value_for_key` (`desktop/src/storage.ts`), built from React state that can predate a poller update;
- the **Rust poller** re-reads and deactivates triggered alerts, then writes the file (`desktop/src-tauri/src/lib.rs:1132-1145`).

The poller re-reads immediately before writing, but the renderer's whole-array write and the poller's write can still interleave, and the renderer's snapshot can revert a trigger (`triggeredAt`/`isActive`) recorded meanwhile. The renderer also reads alerts from **localStorage**, so it never sees a poller trigger at all. Only the watchlist has a merge (`merge_watchlist`).

**Scope:** `price_alerts` only. `back_order_reminders`, `back_in_stock_watches`, `app_settings`, and `fx_rates` have a single writer (the renderer), so there is no cross-writer race. The watchlist is already handled. Cross-file import atomicity and mobile are out of scope.

## Design

### 1. Rust `merge_alerts(app, value)` — mirror `merge_watchlist`

Merge the renderer's incoming array into the on-disk array, by `id`:

- **Unmatched incoming id** → append (a new alert).
- **Disk id absent from incoming** → dropped (a deliberate removal; the poller never adds alerts, so absence means the user deleted it).
- **Matched id** — field ownership:
  - Renderer owns `targetPrice`, `currency`, `isActive`, `snoozedUntil`, `direction`, `distributorId`, `createdAt`.
  - Poller owns `triggeredAt`/`triggeredPrice` and the `isActive:false` a trigger implies.
  - Merge rule: if the disk item has `triggeredAt` and the incoming item does not, the poller fired after the snapshot — keep `disk.triggeredAt`/`disk.triggeredPrice` and force `isActive:false` — **unless** `incoming.isActive === true` (a deliberate re-arm), in which case the incoming item wins outright and the trigger fields are dropped. Otherwise the incoming item wins.

Write the merged array with the existing atomic writer and return it as a JSON string.

### 2. Serialize the two read-modify-write paths

Add a process-wide `std::sync::Mutex<()>` and hold it across the alert-file read-modify-write in **both** `merge_alerts` and the poller's write block (`lib.rs:1132-1145`). The file operations are synchronous, so a `std::sync::Mutex` held only across the sync section is sufficient; it must not be held across an `await`.

### 3. Renderer (`desktop/src/storage.ts`)

- `getItem("price_alerts")` reads from the file store (via `read_value_for_key`, the same command the allowlist already permits) so the UI sees poller trigger updates — matching how the watchlist reads `read_watchlist`.
- `setItem("price_alerts", …)` calls `merge_alerts` and writes the merged array back to localStorage, exactly like the `watchlist_products` branch of `mirrorToFile`. The whole-array `set_value_for_key` path is removed for `price_alerts`.
- Non-Tauri (web preview/tests) keeps the plain localStorage adapter.

## Testing

- **Rust unit tests** (`desktop/src-tauri/src/lib.rs` `#[cfg(test)]`):
  - a poller trigger (`triggeredAt`/`triggeredPrice`, `isActive:false`) survives a renderer save whose snapshot lacks it;
  - a deliberate re-arm (`incoming.isActive === true`, no `triggeredAt`) clears the trigger;
  - a user snooze (`snoozedUntil`) is preserved and wins over disk;
  - a new incoming alert is appended; a disk-only alert is removed;
  - an unmatched/invalid item does not panic.
- **Desktop source guard** (`desktop/tests/…` or `tests/desktop-*`): `desktop/src/storage.ts` routes `price_alerts` through `merge_alerts` and reads it from the file, and no longer uses `set_value_for_key` for `price_alerts`.
- Run `cargo test`, `cargo clippy --all-targets`, `cargo fmt --check`, and the desktop vitest suite.

## Out of scope

- Reminders/watches/settings/fx merge (single writer).
- Cross-file import atomicity.
- Mobile sync.
