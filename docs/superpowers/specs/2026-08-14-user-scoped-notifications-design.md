# User-Scoped Notifications — Design Spec (v4.0)

## Overview

Today server notifications are **device-scoped**: `notifications.uploadConfig` / `pull` /
`registerPushToken` are public procedures keyed by a `deviceId`, and events only land on the
device that uploaded its config. A user's alerts fire once per device, there is no per-user
notification state, and a newly-signed-in device never catches up on events that fired while it
was offline.

This phase makes notifications **user-scoped** while keeping anonymous devices working:

- A device becomes **bound** to a user on the first authenticated `uploadConfig` /
  `registerPushToken` call, and stays bound (persists across logout/login).
- For an authenticated user, configs across all their bound devices are **aggregated and
  deduped**, events are **evaluated once per user**, and each event is **delivered to every
  bound device** (including devices that sign in later — catch-up).
- Anonymous devices keep the existing device-scoped flow unchanged (hybrid).

## Current State (verified)

- `drizzle/schema.ts`: `deviceNotificationConfigs` (PK `deviceId`, JSON alerts/stockWatches/
  dateReminders, `updatedAt`), `notificationEvents` (PK `id`, `deviceId` NOT NULL, `type`,
  `dedupKey`, `title`, `body`, `payload`, `createdAt`, `deliveredAt`), `devicePushTokens`
  (PK `deviceId`, `token`, `platform`, `updatedAt`). No `userId` anywhere; no delivery junction.
- `server/notifications.ts`: `evaluateNotifications(now)` iterates every device config, skips
  drafts whose `dedupKey` is already in that device's **undelivered** set (`deviceId` +
  `deliveredAt IS NULL`), inserts new `notificationEvents`, then best-effort pushes.
  `pullPendingEvents(deviceId)` selects `deviceId` + `deliveredAt IS NULL` rows, marks them
  delivered, returns them. DedupKeys: `price_drop:<alertId>`, `restock:<productId>:<distributorId>`,
  `reminder:<reminderId>` (no DB unique constraint on `dedupKey`).
- `server/push-notifications.ts`: `sendPushForDevice(deviceId, events)` reads the device's token,
  sends via Expo, prunes on `DeviceNotRegistered`.
- `server/routers.ts`: `notifications.uploadConfig` / `pull` / `registerPushToken` are
  `publicProcedure`; `createContext` already populates `ctx.user` (null when unauthenticated).
- `lib/server-notifications.ts`: client uploads local active alerts/stockWatches/dateReminders,
  pulls events, reconciles (deactivates fired alerts, removes watches/reminders), schedules local
  notifications. `createTRPCClient()` already sends the Bearer token when authenticated.
- No production data exists (no `DATABASE_URL` committed; app runs local-only). Migrations are
  cheap and backward-compat with existing tests is not a hard constraint.

## Schema Changes (Drizzle migration 0008)

1. `deviceNotificationConfigs`: add `userId` `varchar(128)` nullable (FK → `users.id`).
   `null` = anonymous device.
2. `devicePushTokens`: add `userId` `varchar(128)` nullable.
3. `notificationEvents`:
   - add `userId` `varchar(128)` nullable;
   - make `deviceId` nullable;
   - **drop `deliveredAt`** — per-device delivery moves to the junction table.
   - Exactly one of `userId` / `deviceId` is set per row: user events have `deviceId = null`,
     anonymous events have `userId = null`.
4. **New** `notificationEventDeliveries`:
   - `deviceId` `varchar(128)` NOT NULL, `eventId` `varchar(128)` NOT NULL,
     `deliveredAt` `bigint` NOT NULL; PK `(deviceId, eventId)`.
   - Used for **both** user and anonymous events (unified delivery model).

`dedupKey` format is unchanged — scope is carried by the row's `userId`/`deviceId`; there is no
DB unique constraint on `dedupKey`, and alert/watch/reminder ids are UUIDs so cross-user
collisions are not a concern.

## Device Binding

- `upsertDeviceConfig(deviceId, config, userId: string | null)` and
  `upsertPushToken(deviceId, token, platform, userId: string | null)` write `userId` onto the
  row when provided. First authenticated call binds; a different user signing in on the same
  device re-binds (last-write-wins). Logout does **not** unbind.
- Routers pass `ctx.user?.id ?? null`.

## Server: Evaluation & Delivery (`server/notifications.ts`)

`evaluateNotifications(now)` groups device configs by `userId`:

- **Anonymous** (`userId = null`): existing per-device evaluation, but the "undelivered" check
  becomes _no delivery row for this device_ (junction) instead of `deliveredAt IS NULL`.
- **User** (`userId` set): aggregate configs across the user's bound devices, deduping each
  collection by item id (first-seen wins — configs are LWW-synced so duplicates are identical).
  Evaluate **once per user** with `buildEvents`, producing user-level events
  (`deviceId = null`, `userId` set).

**Pending-event dedup rule** (prevents duplicate firing while an event is undelivered, while
still allowing re-fire after full delivery, e.g. re-armed alerts):

- _User scope:_ skip a draft if a user event with the same `dedupKey` exists whose delivery-row
  count is **less than** the user's current bound-device count.
- _Anonymous scope:_ skip a draft if an event with the same `dedupKey` exists with **no**
  delivery row for that device.

When a new device binds after an event was fully delivered, the event becomes pending again for
that scope — evaluation skips re-creating it, and the new device gets it via catch-up pull.

After inserting events, push best-effort:

- Anonymous: `sendPushForDevice(deviceId, events)` (unchanged).
- User: new `sendPushForUser(userId, events)` — looks up the user's bound devices and calls
  `sendPushForDevice` for each (never rejects; devices without a push token are skipped).

## Server: Pull (hybrid)

`pullPendingEvents(deviceId, userId?: string)`:

- **User path** (`userId` provided): select user events (`userId = X`) that have **no delivery
  row for this device** (includes catch-up for devices that sign in later); insert delivery rows
  for this device; return them.
- **Anonymous path** (`userId` absent): select events (`deviceId = Y`) with no delivery row for
  this device; insert delivery row; return.

## Routers (hybrid)

`uploadConfig`, `pull`, `registerPushToken` stay `publicProcedure` (so anonymous devices keep
working) but branch on `ctx.user`:

- `uploadConfig` / `registerPushToken`: pass `ctx.user?.id ?? null` to the upsert (binding).
- `pull`: if `ctx.user` → `pullPendingEvents(deviceId, ctx.user.id)`; else
  `pullPendingEvents(deviceId)`.

No input-schema changes; the client already sends the Bearer token when authenticated.

## Client (`lib/server-notifications.ts`)

**No code changes.** The existing upload → pull → reconcile flow works as-is: authenticated calls
become user-scoped automatically (Bearer header already sent). Cross-device reconciliation works
because a pulled user event on any device deactivates the alert / removes the watch or reminder
locally, and the LWW sync propagates that state to the user's other devices.

## Memory Fallback (no DB)

`server/notifications.ts` memory maps must mirror the new model:

- `memoryConfigs: Map<deviceId, { config: NotificationConfig; userId: string | null }>`
- `memoryEvents: Map<eventId, NotificationEvent & { userId: string | null; deviceId: string | null }>`
- `memoryDeliveries: Map<deviceId, Set<eventId>>`

Evaluation groups by `userId`; pending-dedup and pull use `memoryDeliveries` per device.
`clearNotificationsForTests()` clears all three.

## Tests

- `tests/notifications.test.ts` (service-level, memory path):
  - user-level dedup across devices (two devices with the same alert → one event);
  - cross-device delivery (event delivered to both bound devices);
  - catch-up pull (device signs in later → pulls the user's undelivered events);
  - per-device delivery marking (device A's pull doesn't mark device B's delivery);
  - anonymous path unchanged;
  - device binding on `upsertDeviceConfig` / `upsertPushToken` with `userId`, and re-binding to a
    different user.
- `tests/notifications-router.test.ts` (router, mocked module):
  - authenticated context → `pullPendingEvents(deviceId, userId)` and `userId` passed to
    `upsertDeviceConfig` / `upsertPushToken`;
  - anonymous context → `pullPendingEvents(deviceId)` and `userId = null`.
- Existing client tests (`tests/sync-server-notifications.test.ts`) must stay green — no client
  code changes.

## Migration Note

`drizzle.config.ts` requires `DATABASE_URL` to load. `pnpm db:push` needs a real DB; if
`drizzle-kit generate` cannot run without a live `DATABASE_URL`, hand-write migration 0008 SQL
matching drizzle-kit's format (columns/order per `drizzle/schema.ts`). The migration file is
committed; it does not need to run in CI.

## Gates & Checkpoint

- `pnpm check` — 0 TypeScript errors.
- `pnpm lint` — clean (only pre-existing `MODULE_TYPELESS_PACKAGE_JSON` warning).
- `pnpm test` — full suite green (v4.0 baseline is 480 tests / 71 files; expect +N).
- `pnpm exec prettier` — format all touched files.
- `todo.md` Phase 40 appended.
- Checkpoint commit:
  `Checkpoint: v4.0: user-scoped notifications — device binding, per-user event evaluation, cross-device delivery via delivery junction, hybrid auth. TypeScript: 0 errors.`
  - push.

## Out of Scope

- Device-management UI (list/remove bound devices).
- Anonymous/guest server persistence for sync collections (still requires sign-in).
- A dedicated `stock_watches` table (still rides the reminders collection).
- Protecting `prices.uploadHistory` behind auth.
- DB integration tests against a real MySQL instance.
