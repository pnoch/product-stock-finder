# Push Token Pruning Design

> **Date:** 2026-08-13
> **Phase:** 33 follow-up #2 (target checkpoint v3.14)
> **Status:** Approved

## Problem

`sendPushForDevice` (`server/push-notifications.ts`) sends pushes to Expo but discards the returned send tickets. When a device is uninstalled or its token goes invalid, Expo returns a `DeviceNotRegistered` ticket — but the row stays in `device_push_tokens`. Rows for dead devices accumulate forever. `upsertPushToken` only updates/overwrites a token when a device re-registers; a device that is uninstalled (or whose app data is wiped without re-registering) never triggers cleanup.

## Scope

- Server-only. No schema or migration changes (the table is already correct; only rows need removal).
- No mobile or desktop changes.
- Prune only on the definitive `DeviceNotRegistered` send-ticket signal. No receipt-based pruning, no stale-`updatedAt` sweep.
- Keeps the module's existing "best-effort, never throws" contract.

## Approach

Send-ticket pruning: when a push send to a device returns a `DeviceNotRegistered` ticket, delete that device's token row immediately. Deleting is safe because the mobile app re-registers its token via `upsertPushToken` on every launch, so a healthy device is re-added on its next launch.

## Components

### 1. `server/push-notifications.ts` — `pruneDeviceToken(deviceId: string): Promise<void>`

New exported function:

- `const db = await getDb();`
- If `db` is set: `await db.delete(devicePushTokens).where(eq(devicePushTokens.deviceId, deviceId));`
- Else (memory/local mode): `memoryTokens.delete(deviceId);`
- The whole body is wrapped in try/catch that `console.warn`s and swallows — it must never throw, matching the module's best-effort contract.

### 2. `server/push-notifications.ts` — inspect tickets in `sendPushForDevice`

Inside the existing `try` block, capture the tickets returned by the send and check them after each chunk:

```ts
const tickets = await expo.sendPushNotificationsAsync(chunk);
if (
  tickets?.some(
    (t) => t.status === "error" && t.details?.error === "DeviceNotRegistered",
  )
) {
  await pruneDeviceToken(deviceId);
}
```

- `tickets` is the array Expo returns from `sendPushNotificationsAsync`; each ticket is `{ status: "ok" }` or `{ status: "error", details: { error: string } }`.
- Only `DeviceNotRegistered` triggers pruning. Other error codes (`MessageTooBig`, `InvalidCredentials`, etc.) are ignored.
- The existing outer `try/catch` (warn + swallow) is unchanged; send failures still never throw.

## Data Flow

```
Engine creates event → sendPushForDevice → Expo returns tickets
  → DeviceNotRegistered detected → pruneDeviceToken deletes the row
  → next engine run sends to a clean device_push_tokens table
```

## Error Handling

- Send path: unchanged (warn + swallow).
- Prune path: internally guarded (warn + swallow), never throws, never aborts the caller's loop.

## Testing

Extend `tests/push-notifications.test.ts`:

- Update the `expo-server-sdk` mock so `sendPushNotificationsAsync` returns a hoisted, configurable ticket array (default `[{ status: "ok" }]`) so the existing 7 tests remain green.
- New tests:
  1. `DeviceNotRegistered` ticket → `db.delete` called with `devicePushTokens` table and the device id.
  2. `DeviceNotRegistered` ticket on the memory path → `memoryTokens` entry removed (subsequent send no-ops).
  3. Ok tickets → no delete.
  4. Other error code (e.g. `MessageTooBig`) → no delete.
  5. `pruneDeviceToken` never throws when the DB delete rejects (warn + swallow).

## Non-Goals

- No receipt-based (`getReceiptsAsync`) pruning.
- No periodic stale-token sweep.
- No schema/migration changes.
- No mobile/desktop changes.
- No `todo.md`-visible feature phase beyond a Phase 35 checkpoint note.
