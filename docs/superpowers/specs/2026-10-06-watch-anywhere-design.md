# Watch Anywhere + New-Source Detection — Design Spec

**Date:** 2026-10-06
**Status:** Draft for review

## Goal

Let a user watch a product **across every distributor** — "tell me when *anyone*
has it" — including a distributor that starts carrying it for the first time.
This is the literal origin story (the CRS804 shortage) and the core differentiator
versus a one-shot ChatGPT search.

## Problem

A restock watch is bound to **one distributor**: `BackOrderReminder.distributorId`
is required, `addStockWatch` keys on `(productId, distributorId)`, and
`runCheckRestocks` only inspects the watched distributor's listing. So:

- A user hunting a scarce part must create N watches for N stores.
- A **new** distributor starting to carry the part is never detected — the app
  only re-checks listings already in the watchlist.
- The product's promise ("find who has it worldwide") is not delivered by the
  watch, only by the one-shot search.

## Scope

**In scope:** a product-level watch scope, the any-distributor scan, new-source
detection, the UI choice, and tests.

**Out of scope:** server-side scheduling changes (the client watch already runs
in the background task); "notify on price drop anywhere" (the existing price
alert is already product-level); discovery of distributors not already in the
product's listings (that is the separate discovery flow).

## Architecture

### 1. Data model — extend `BackOrderReminder` (no new collection)

In `lib/types.ts`:

```ts
export interface BackOrderReminder {
  // …existing fields…
  /** "distributor" (default, legacy) watches one store; "any" watches all. */
  scope?: "distributor" | "any";
  /** Per-distributor last-known status, for "any" watches. */
  lastKnownStatusByDistributor?: Record<string, string>;
}
```

- `scope` absent ⇒ `"distributor"` (backward compatible; existing rows keep
  working unchanged).
- For an `"any"` watch, `distributorId` is the sentinel `"*"` and
  `distributorName` is `"Any distributor"`.

### 2. Creation — `app/product/[id].tsx`

The "Watch for restock" action gains a scope choice (a two-option sheet):
**"Any distributor"** (default) and **"This distributor"**. The chosen scope sets
`scope` and, for `"any"`, `distributorId: "*"`, `distributorName: "Any distributor"`,
and seeds `lastKnownStatusByDistributor` from the product's current listings.

`addStockWatch` (`lib/storage/reminders.ts`) already upserts on
`(productId, distributorId)`, so the `"*"` sentinel de-dupes correctly.

### 3. Detection — `lib/restock.ts` `runCheckRestocks`

Branch on `watch.scope`:

- **`"distributor"`** — unchanged (today's behavior).
- **`"any"`** — scan **every** listing of the product:
  - `prev = watch.lastKnownStatusByDistributor?.[listing.distributorId] ?? "back_order"`.
  - Fire when `prev !== "in_stock" && listing.stockStatus === "in_stock"`.
  - A listing whose `distributorId` is **absent** from the map is treated as
    `"back_order"` — so a newly discovered distributor in stock fires
    ("New source").
  - After the pass, persist the updated `lastKnownStatusByDistributor` (every
    listing's current status) via a new
    `updateStockWatchStatuses(watchId, statuses)` storage helper.
  - Fire **once per check cycle**, naming the store(s):
    `"${productName} is now in stock at ${names}"`, or
    `"…at ${n} distributors"` when several appear at once. Then remove the watch
    (same consume-on-deliver semantics as today: only after the notification
    actually fires).

### 4. Storage — `lib/storage/reminders.ts`

Add:

```ts
async function updateStockWatchStatuses(
  watchId: string,
  statuses: Record<string, string>,
): Promise<void>;
```

(Serialized via the existing `enqueue`; sets
`lastKnownStatusByDistributor` on the matching watch.)

### 4a. Server-side evaluation — `server/notifications/build-events.ts`

The server also evaluates uploaded stock watches (per-distributor) and sends its
own restock events. An `"any"` watch uploaded with `distributorId: "*"` would
otherwise be looked up as a literal distributor and never fire. Extend the
`stockWatches` loop:

- When `watch.scope === "any"` (or `watch.distributorId === "*"`), iterate the
  product's **known distributor ids** (from `getAllParserIds()`), fetch each
  snapshot, and fire if **any** is `in_stock` (and `lastKnownStatus !== "in_stock"`).
- The event names the store(s) that are in stock; `dedupKey` uses the product id
  plus a stable bucket (e.g. `restock:${productId}:any`) so it fires once per
  window, not once per distributor.
- The uploaded config must carry `scope` (extend the `notifications.uploadConfig`
  schema + the client uploader in `lib/server-notifications.ts`).

This keeps the server path (which fires when the app is closed) in parity with
the client path.

### 5. UI — watch list

`app/restock-watches.tsx` (and the Alerts tab's Reminders list) renders
`"Any distributor"` for `scope: "any"` instead of a store name.

## Data Flow

1. User taps "Watch for restock" → chooses "Any distributor".
2. A watch with `scope: "any"`, `distributorId: "*"`, and the current per-store
   statuses is stored.
3. The background task runs `checkRestocks`; the `"any"` branch scans all
   listings, detects a transition to `in_stock` (including a new store), notifies
   once, and removes the watch.
4. The Notification Center records the event (existing path).

## Error Handling

- Notification failure → keep the watch (existing retry semantics), and do **not**
  persist the new statuses (so the transition is re-detected next cycle).
- A product with no listings → skip (existing guard).
- Missing `lastKnownStatusByDistributor` on an `"any"` watch → treat all as
  `"back_order"` (first run fires on anything already in stock — acceptable, and
  the creation path seeds it so this is rare).

## Testing

- `tests/restock-any-scope.test.ts` — an `"any"` watch fires when a **different**
  distributor goes in stock; fires on a **new** distributor id; does not fire when
  nothing transitions; fires once and removes the watch; a `"distributor"` watch
  is unchanged.
- `tests/reminders-storage.test.ts` — `updateStockWatchStatuses` sets the map;
  `addStockWatch` de-dupes on the `"*"` sentinel.
- `tests/server-restock-any.test.ts` — the server `buildEvents` fires an `"any"`
  watch when any distributor is in stock, dedups once per window, and leaves a
  `"distributor"` watch unchanged.
- Existing restock + notification tests stay green (the `"distributor"` path is
  untouched).

## Success Criteria

- A user can watch a product "anywhere"; when any distributor (including a new
  one) has it in stock, they get one notification naming the store.
- Existing per-distributor watches behave exactly as before.
- `pnpm verify` stays green.

## Risks

- **Notification noise** → one notification per cycle, naming the stores; the
  watch is consumed on delivery (same as today).
- **Backward compatibility** → `scope` defaults to `"distributor"`; the
  `"distributor"` branch is byte-for-byte the current behavior.
- **Desktop parity** → the desktop Rust poller does not run restock watches
  (they are client-side + server-scheduled); the desktop uploads the watch
  config, so it must include `scope` in the upload payload. Confirm no Rust
  change is needed beyond the uploader.
