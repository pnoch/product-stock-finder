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

### 0. Why not a field-ownership merge

A whole-array `merge_alerts` cannot tell a **stale snapshot** (alert was armed; the poller has since triggered it) from a **deliberate re-arm** — both look like `isActive:true` with no `triggeredAt`. So the renderer must send *intent* (only the fields the user actually changed), not the whole item.

### 1. Renderer diff + per-item Rust mutations (`desktop/src/storage.ts`)

The desktop adapter keeps the last array it read/wrote per key. On `setItem("price_alerts", nextJson)` it computes a diff against the last known array and invokes one command:

- `removes`: ids in the last-known array but not in `next`.
- `upserts`: for each item in `next`:
  - id not in the last-known array → `{ id, patch: <full item> }` (an add);
  - otherwise a shallow field diff → `{ id, patch: <changed fields, with JSON null for fields removed> }` (only if something changed).
- No diff and no removes → no invoke (a no-op save cannot clobber the poller).

`getItem("price_alerts")` reads from the file store via `read_value_for_key` (already allowlisted) so the UI sees poller triggers, and updates the last-known array.

### 2. Rust `apply_alert_mutations(app, upserts, removes)`

Under a process-wide lock: read the on-disk alerts array; drop every `removes` id; for each upsert find the item by id and apply the `patch` field-by-field (`null` removes that field), or insert the patch as a new item when the id is absent; write the array with the existing atomic writer; return it as a JSON string. The renderer writes the returned array back to localStorage.

Because patches carry only user edits:
- a trigger the poller recorded survives an unrelated save (no patch for `triggeredAt`);
- a snooze patch touches only `snoozedUntil`;
- a re-arm patch is `{ isActive: true, triggeredAt: null }` and reliably clears the trigger.

### 3. Serialize the two read-modify-write paths

Add a process-wide `std::sync::Mutex<()>` and hold it across the alert-file read-modify-write in **both** `apply_alert_mutations` and the poller's write block (`lib.rs:1132-1145`). The file operations are synchronous, so a `std::sync::Mutex` held only across the sync section is sufficient; it must not be held across an `await`.

Non-Tauri (web preview/tests) keeps the plain localStorage adapter.

## Testing

- **Rust unit tests** (`desktop/src-tauri/src/lib.rs` `#[cfg(test)]`):
  - a patch touching only `targetPrice` leaves a poller `triggeredAt`/`triggeredPrice`/`isActive:false` intact;
  - a re-arm patch `{ isActive: true, triggeredAt: null }` clears `triggeredAt`;
  - a `snoozedUntil` patch applies and preserves other fields;
  - an add inserts the full item; a remove drops the id; an unknown id is ignored without panicking.
- **Renderer tests** (`desktop/tests/storage-mirror-merge.test.ts`, extended):
  - `saveAlerts` on a changed item invokes `apply_alert_mutations` with a field patch (not the whole item), and the whole-array `set_value_for_key` path for `price_alerts` is gone;
  - a removed id becomes a `removes` entry; a no-op save invokes nothing;
  - `getItem("price_alerts")` reads from the file store.
- Run `cargo test`, `cargo clippy --all-targets`, `cargo fmt --check`, and the desktop vitest suite.

## Out of scope

- Reminders/watches/settings/fx merge (single writer).
- Cross-file import atomicity.
- Mobile sync.
