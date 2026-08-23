# Server Notifications Refactor — Design Spec

**Date:** 2026-08-23
**Goal:** Break `server/notifications.ts` (670 lines) into a `server/notifications/` directory of focused modules while preserving the public API and behavior byte-for-byte.

## Current State

`server/notifications.ts` handles server-side notification scheduling: device config upsert, event evaluation (price drops / restocks / date reminders), health-event mirroring, dedup, delivery tracking, and pull. It mixes four concerns in one file:

- Domain types (`NotificationConfig`, `NotificationEvent`) + internal shapes (`MemoryEvent`, `EventDraft`)
- In-memory fallback store (3 module-level Maps: configs, events, deliveries)
- Event-building rules (`buildEvents`: price-drop/restock/reminder drafts from a config + timestamp)
- Evaluation engine (memory + DB paths, anon + user aggregation) and public entry points (`upsertDeviceConfig`, `evaluateNotifications`, `pullPendingEvents`)
- Row mappers between Drizzle rows and domain objects

## Target Architecture

```
server/notifications/
  index.ts          Public API: upsertDeviceConfig, processHealthEvents,
                    pullPendingEvents (~160 lines)
  types.ts          NotificationConfig, NotificationEvent, MemoryEvent, EventDraft
  memory-store.ts   memoryConfigs/memoryEvents/memoryDeliveries Maps +
                    deliveryCount, stripScope, clearNotificationsForTests,
                    listMemoryConfigDevices, removeMemoryDevice
  build-events.ts   newEventId, dedupKeyFor, dedupKeyForHealth, buildEvents
  evaluate.ts       evaluateNotifications, evaluateMemory, evaluateAnonMemory,
                    evaluateUserMemory, evaluateConfigDb, evaluateUserDb,
                    aggregateConfigs
  mappers.ts        rowToConfig, draftToEvent, rowToEvent
```

**Dependency flow (no cycles):**

```
types ← mappers ─┐
types ← memory-store ─┤
types ← build-events ─┼→ evaluate → index
                      │
        (index also uses memory-store + mappers + push-notifications)
```

## Placement Decisions

- `processHealthEvents` stays in `index.ts`: it is only called from `upsertDeviceConfig`, uses the health dedup key from `build-events`, writes via db/memory-store, and pushes via `sendPushForUser`.
- `aggregateConfigs` lives in `evaluate.ts` — it is only used by the two user-aggregation paths.
- `stripScope` lives in `memory-store.ts` — it strips scope fields from `MemoryEvent`; used by `pullPendingEvents`.
- `newEventId`, `dedupKeyFor`, `dedupKeyForHealth` live in `build-events.ts` alongside their sole producer `buildEvents` (health dedup key also used by `processHealthEvents` in index).

## Public API Invariants

1. `./notifications` exports exactly: `upsertDeviceConfig`, `evaluateNotifications`, `pullPendingEvents`, `clearNotificationsForTests`, `listMemoryConfigDevices`, `removeMemoryDevice`, plus types `NotificationConfig` and `NotificationEvent`.
2. Consumers unchanged: `server/routers.ts`, `server/prices.ts`, `server/devices.ts` (and tests importing `clearNotificationsForTests`).
3. All function signatures and behavior identical — pure structural extraction.

## Testing

Existing server-notification tests must pass unchanged (they exercise upsert → evaluate → pull flows against both memory and DB backends). Full suite run per task; DB-gated tests remain gated.

## Extraction Order (one commit each)

1. Scaffold directory: types.ts, memory-store.ts, mappers.ts; index.ts keeps everything else
2. Extract build-events.ts
3. Extract evaluate.ts
4. Finalize index.ts (upsertDeviceConfig/processHealthEvents/pullPendingEvents), todo.md, push

**Key metrics:**
- 670-line single file → 6 focused files (largest ~160 lines)
- Public API: unchanged
