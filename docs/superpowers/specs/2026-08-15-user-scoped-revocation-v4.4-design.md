# User-Scoped Device Revocation v4.4

## Problem

`revoked_devices` is keyed by `deviceId` alone, and both `isDeviceRevoked(deviceId)` and `unrevokeDevice(deviceId)` are global. On a shared device, account B logging in clears account A's revocation marker — the documented residual risk from v4.3 ("a login from account B on a shared device can clear account A's revocation for that deviceId"). The design intent of v4.3's "login is the un-revoke" is that the account credential proves ownership of that account's session — not ownership of the physical device for all accounts.

## Goal

Scope device revocation to `(userId, deviceId)`. A user's login un-revokes only their own marker. Signing out one account no longer blocks other accounts on the same device, and another account's login can no longer clear someone else's revocation.

## Decisions (from brainstorming)

1. **Per-user scoping.** Revocation is scoped to the numeric `userId` (consistent with the other device tables, all `int` FK to `users.id`). Account A signing out revokes only A's sessions on that device; account B's login clears only B's marker. A's revocation persists.
2. **Legacy rows → NULL = global legacy block.** Existing `revoked_devices` rows (keyed by `deviceId` only, no `userId`) are migrated with `userId = NULL`. A NULL row blocks **every** user on that device until the owning user re-logs-in (which clears it via the `userId = U OR userId IS NULL` delete). New rows always carry a real `userId`.
3. **Numeric `userId` is the key.** Matches `deviceNotificationConfigs` / `devicePushTokens` (`int` FK), and both `context.ts` (`user.id`) and `routers.ts` (`ctx.user.id`) already expose it.

## Architecture

### Schema — `revoked_devices`

```ts
export const revokedDevices = mysqlTable(
  "revoked_devices",
  {
    id: int("id").autoincrement().primaryKey(),
    deviceId: varchar("deviceId", { length: 128 }).notNull(),
    userId: int("userId"),
    revokedAt: bigint("revokedAt", { mode: "number" }).notNull(),
  },
  (t) => ({
    uniqUserDevice: uniqueIndex("revoked_devices_user_device").on(
      t.userId,
      t.deviceId,
    ),
  }),
);
```

Why a surrogate `id` PK: MySQL composite primary keys cannot contain NULL, but `userId` must be nullable to express the global legacy block. The surrogate PK plus a unique index on `(userId, deviceId)` keeps `ON DUPLICATE KEY UPDATE` working for user-scoped rows. (NULLs are treated as distinct by MySQL unique indexes, which is fine — new rows always have a real `userId`, so the index only deduplicates real rows.)

Migration: `drizzle-kit generate` produces `drizzle/0012_*.sql` — `ALTER TABLE revoked_devices` add `id` (auto-increment PK), add `userId`, drop the old `deviceId` PK, add the composite unique index. Existing rows keep `userId = NULL` → global legacy blocks.

### Server functions — `server/devices.ts`

| Function | Change |
|---|---|
| `signOutDevice(userId, deviceId)` | Signature unchanged. Insert now includes `userId`; `ON DUPLICATE KEY UPDATE` (set `revokedAt`) still works via the unique index. |
| `isDeviceRevoked(userId, deviceId)` | DB: `WHERE deviceId = ? AND (userId = ? OR userId IS NULL)`. Memory: composite-key `Set` entry `${userId}:${deviceId}`, plus `*:${deviceId}` for a global block (mirrors the NULL row). |
| `unrevokeDevice(userId, deviceId)` | DB: `DELETE WHERE deviceId = ? AND (userId = ? OR userId IS NULL)` — clears the caller's marker and any legacy global block for that device. Memory: delete `${userId}:${deviceId}` and `*:${deviceId}`. |

Memory backend: `memoryRevokedDevices` becomes a `Set<string>` of composite keys (`${userId}:${deviceId}` and `*:${deviceId}` for a global block). `clearDevicesForTests` clears it as before.

### Call sites

- **`server/_core/context.ts`** (line ~32): `isDeviceRevoked(user.id, effectiveDeviceId)`. The existing `if (effectiveDeviceId && user)` guard already ensures `user` is non-null. The check stays scoped to the authenticated user, so a legacy header-fallback session (no claim) is still scoped to its own user.
- **`server/_core/oauth.ts`** (both `/api/oauth/callback` and `/api/oauth/mobile`): capture `const user = await syncUser(userInfo)` (the web callback currently discards the return), then `unrevokeDevice(user.id, deviceId)`. In DB mode `syncUser` returns the saved row with `id`. In the dev-only no-DB fallback where `id` is missing, skip the un-revoke with a warning (`console.warn`) — device management is unreachable without a DB anyway, so there is no production lockout risk.
- **`server/routers.ts`** (line ~247): `signOutDevice(ctx.user.id, input.deviceId)` — unchanged.

## Semantics

- A legacy NULL row blocks every user on that device until the owning user's login clears it.
- New revocations are strictly per-user: A signing out never blocks B; B logging in never clears A's marker.
- The claim-authoritative check from v4.3 is unchanged — this phase only scopes the revocation *decision* to the user.

## Testing

- **`tests/devices.test.ts`**: update all `isDeviceRevoked("dev-1")` → `isDeviceRevoked(userId, "dev-1")` and `unrevokeDevice("dev-1")` → `unrevokeDevice(userId, "dev-1")` calls. Add cross-user tests:
  - A (`userId` 7) signs out a device → A is revoked, B (userId 8) is **not**.
  - B logs in (un-revoke) → B's marker cleared, A's marker persists.
  - Un-revoking with `userId` also clears a legacy global block (`*:deviceId` in memory; NULL row in DB).
- **`tests/device-revoked.test.ts`**: mocks already return bare values; add assertions that `isDeviceRevoked` is called with `(user.id, effectiveDeviceId)`.
- **`tests/oauth-handlers.test.ts`**: `unrevokeDevice` assertions gain the numeric id (the mocked `getUserByOpenId` returns `{ id: 1 }`), i.e. `toHaveBeenCalledWith(1, "dev-1")`.
- **`tests/devices-router.test.ts`**: unchanged (`signOut` signature stable; `cleanupStale` untouched).

## Out of scope

- No UI changes, no new endpoints.
- `cleanupStaleDevices` untouched.
- Cron users unaffected (never get a device session).
- No backfill of `userId` onto legacy rows (they remain global blocks by design).
