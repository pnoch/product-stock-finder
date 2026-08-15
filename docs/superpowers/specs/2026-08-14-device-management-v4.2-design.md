# Device Management v4.2 Design

**Date:** 2026-08-14
**Status:** Approved design — pending implementation plan

## Problem

v4.1 shipped Device Management: a Settings section where a signed-in user can see their current device's binding status, bind it explicitly, list every device bound to their account (platform + last seen), and unbind a sold/lost device (full removal).

Three gaps remain (all explicitly deferred from the v4.1 spec):

1. **No friendly names** — devices appear as raw truncated `deviceId`s, which are unreadable.
2. **No remedy for a stolen/compromised device** — unbind stops notifications, but the device keeps its local session token and stays signed in; there is no way to force it to sign out.
3. **No idle cleanup** — a device bound once and never seen again stays in the list forever.

## Goal

Extend Device Management so a signed-in user can:

1. **Rename** any bound device (including the current one) with a friendly label shown in the Settings list.
2. **Sign out** a bound device remotely — full removal (as v4.1 unbind) **plus** a revocation marker that forces the device to clear its local session on its next authenticated contact.
3. **Auto-clean** devices not seen in 30 days (client-triggered).

Anonymous users see nothing (section stays gated on `isAuthenticated`).

## Decisions (from brainstorming)

| Question | Decision |
| -------- | -------- |
| Scope | All three: rename + remote logout + idle cleanup |
| Label storage | Server-side, memory/DB parallel (survives across devices, syncs) |
| Label display | Settings list only — NOT interpolated into notification bodies (user-scoped events are shared across devices, so per-device labels can't appear there) |
| Rename UX | Modal text input (RN `Modal` + `TextInput`, matching existing reschedule/price-alert modals) |
| Remote logout meaning | Unbind + sign-out-on-next-contact |
| Cleanup trigger | Client-triggered: `devices.cleanupStale` procedure called on launch + after Settings loads |
| Revocation detection | `x-device-id` header on every tRPC call + `createContext` check |
| Unbind vs logout | One action: **Sign out** (replaces v4.1's Unbind button/procedure) |
| Architecture | Approach A: extend the v4.1 `devices` module/router in place |

## Architecture

- **Server:** extend `server/devices.ts` (rename/sign-out/cleanup/revocation helpers, memory/DB parallel), extend the `devices` router in `server/routers.ts` (rename/signOut/cleanupStale), add a revocation check to `createContext` (`server/_core/context.ts`).
- **Schema:** two new tables — `device_labels` and `revoked_devices` (memory-mirrored).
- **Client:** `lib/trpc.ts` sends `x-device-id` on every call + detects the revoked error; new `lib/device-revoked.ts` clears the local session; `lib/devices.ts` gains rename/signOut/cleanup helpers; Settings section gets Rename + Sign out actions; `_layout.tsx` registers the revoked handler + triggers cleanup.

## Schema

### New table: `device_labels`

| Column | Type | Notes |
| ------ | ---- | ----- |
| `deviceId` | varchar(128) | PK |
| `label` | varchar(64) | not null |
| `updatedAt` | bigint (number) | not null |

Keyed by `deviceId` so a label survives regardless of whether the device has a config row, token row, or both. Memory mirror: `memoryLabels: Map<string, string>` in `server/devices.ts`.

### New table: `revoked_devices`

| Column | Type | Notes |
| ------ | ---- | ----- |
| `deviceId` | varchar(128) | PK |
| `revokedAt` | bigint (number) | not null |

Memory mirror: `revokedDevices: Set<string>` in `server/devices.ts`.

## Server

### `server/devices.ts` (extend)

All functions follow the established memory/DB parallel pattern (`getDb()` null → memory maps; else Drizzle).

- **`DeviceInfo`** gains `label: string | null` — read from `device_labels`/`memoryLabels` in `listDevicesForUser`.
- **`renameDevice(userId: number, deviceId: string, label: string): Promise<boolean>`**
  - Verify the device is bound to `userId` (same config-then-token check as `unbindDevice`). Return `false` if not bound.
  - DB: upsert `device_labels` row (`onDuplicateKeyUpdate`). Memory: set `memoryLabels`.
  - Return `true`.
- **`signOutDevice(userId: number, deviceId: string): Promise<boolean>`**
  - Call the existing `unbindDevice(userId, deviceId)` for the full removal (config row, token row, delivery rows, anon-scoped events) — it already verifies binding and returns `false` when not bound.
  - On `true`, record revocation: insert `revoked_devices` row / add to `revokedDevices` set.
  - Return the unbind result.
- **`cleanupStaleDevices(userId: number, cutoffMs: number): Promise<number>`**
  - List devices for the user; for each with `lastSeenAt > 0 && lastSeenAt < cutoffMs`, unbind it (full removal, **no** revocation — a stale device that never returns doesn't need a sign-out signal).
  - Return count removed.
- **`isDeviceRevoked(deviceId: string): Promise<boolean>`** — DB: select from `revoked_devices`; memory: `revokedDevices.has(deviceId)`.
- **`clearDevicesForTests()`** — resets `memoryLabels` and `revokedDevices` (used by tests; mirrors `clearNotificationsForTests`/`clearPushTokensForTests`).

### `server/routers.ts` (extend)

| Procedure | Type | Auth | Input | Output |
| --------- | ---- | ---- | ----- | ------ |
| `devices.rename` | mutation | `protectedProcedure` | `{ deviceId: string(1-128), label: string(1-64) }` | `{ renamed: boolean }` |
| `devices.signOut` | mutation | `protectedProcedure` | `{ deviceId: string(1-128) }` | `{ signedOut: boolean }` |
| `devices.cleanupStale` | mutation | `protectedProcedure` | — | `{ removed: number }` |

- `devices.unbind` is **removed** from the router (superseded by `signOut`). The `unbindDevice` server function stays as an internal helper used by `signOutDevice` and `cleanupStaleDevices`.
- `devices.list`/`devices.current` unchanged.

### Revocation check (`server/_core/context.ts` + `shared/const.ts`)

- `createContext` reads the `x-device-id` header → `ctx.deviceId`.
- If `ctx.deviceId` is revoked **and** `ctx.user` is present → throw `TRPCError({ code: "FORBIDDEN", message: DEVICE_REVOKED_ERR_MSG })`.
- `DEVICE_REVOKED_ERR_MSG` added to `shared/const.ts` (alongside `UNAUTHED_ERR_MSG`/`NOT_ADMIN_ERR_MSG`).
- Public/anonymous calls from a revoked device still work (it can re-bind fresh); only authenticated calls fail — that's what triggers the client sign-out.

## Client

### `lib/trpc.ts` (extend)

- `createTRPCClient()` headers add `x-device-id` (from `getDeviceId()`) on every call.
- Add a custom error-detection link: on error, if the message matches `DEVICE_REVOKED_ERR_MSG`, call `handleDeviceRevoked()`.

### `lib/device-revoked.ts` (new)

- `handleDeviceRevoked()` — clears the local session (`Auth.removeSessionToken()` + `Auth.clearUserInfo()`) and invokes a registered UI callback (idempotent — only fires once per revocation).
- `registerDeviceRevokedHandler(cb)` — lets `_layout.tsx` register the UI callback.

### `lib/devices.ts` (extend)

- `renameDevice(deviceId: string, label: string): Promise<boolean>` — calls `devices.rename`; false on error.
- `signOutDevice(deviceId: string): Promise<boolean>` — calls `devices.signOut`; **replaces** `unbindDevice` (removed).
- `cleanupStaleDevices(): Promise<number>` — calls `devices.cleanupStale`; 0 on error.
- `fetchDevices`/`fetchCurrentDeviceBinding`/`bindCurrentDevice` unchanged (DeviceInfo now carries `label`).

### `app/(tabs)/settings.tsx` (extend)

- Device rows show `device.label` when set, else the truncated `deviceId` (existing fallback).
- Each row gets a **Rename** action (all rows, including the current device) → opens a modal (RN `Modal` + `TextInput`, matching the existing reschedule/price-alert modals) with a label field; Save → `renameDevice` → reload.
- "Unbind" button becomes **"Sign out"** (destructive `Alert.alert` confirm + haptics, same pattern) → `signOutDevice` → reload. Still hidden for the current device.
- On mount (and after load), call `cleanupStaleDevices()` best-effort.

### `app/_layout.tsx` (extend)

- Register the device-revoked handler once (Alert "You were signed out on another device" + `refresh()` from `useAuth`).
- Trigger `cleanupStaleDevices()` best-effort once when `isAuthenticated` becomes true (alongside the existing launch sync flow). Safe when not authenticated — the client helper returns 0 on the UNAUTHORIZED error.

## Error handling

- Client helpers stay best-effort: failures return safe fallbacks (false / 0 / null), never crash.
- Server `rename`/`signOut` never throw for the not-bound case — they return `{ renamed: false }` / `{ signedOut: false }`.
- Revocation detection is idempotent client-side (fires once, clears session, shows one alert).

## Testing (vitest)

- `tests/devices.test.ts` (extend):
  - `renameDevice`: bound → true + label appears in `listDevicesForUser`; not-bound → false. Memory + DB paths.
  - `signOutDevice`: removes config/token/deliveries/anon-events **and** `isDeviceRevoked` becomes true; not-bound → false. Memory + DB paths.
  - `cleanupStaleDevices`: removes stale devices, keeps fresh ones, skips `lastSeenAt === 0` (memory mode).
  - `listDevicesForUser` includes `label` from `device_labels`/`memoryLabels`.
- `tests/devices-router.test.ts` (extend):
  - `rename`/`signOut`/`cleanupStale` throw UNAUTHORIZED without a user.
  - Input validation: oversized `label` (65 chars) and `deviceId` (129 chars) rejected.
  - Arg forwarding: `rename` passes `(userId, deviceId, label)`; `signOut` passes `(userId, deviceId)`.
- New `tests/device-revoked.test.ts`:
  - `createContext` throws DEVICE_REVOKED for a revoked device with a user; passes for anon or non-revoked device.
  - `lib/device-revoked.ts`: `handleDeviceRevoked` clears session + fires registered callback once.
- Gates: `pnpm check` 0 errors, `pnpm lint` clean (only pre-existing `MODULE_TYPELESS_PACKAGE_JSON` warning), full `pnpm test` green. No client component tests (repo convention — UI verified via check + lint).

## Out of scope (YAGNI)

- Label interpolation into notification bodies.
- Admin device management (other users' devices).
- Desktop (Tauri) app changes — new procedures are reachable from it via the same tRPC API, but no desktop UI work.
- Server-side scheduled cleanup (client-triggered only).
- Revocation-marker cleanup / expiry.

## Known limitations

- **Revoked device cannot re-authenticate in-app.** The revocation marker is never cleared (cleanup/expiry is out of scope), and `deviceId` is stable across re-login, so a revoked device is blocked from authenticated features until app data is wiped (regenerating the deviceId). Re-signing in on that device → first authenticated tRPC call → FORBIDDEN → session cleared → repeat. A user-verified un-revoke path is a possible future enhancement.
- **Revocation is a UX mechanism, not a security boundary.** `x-device-id` is client-controlled and unauthenticated; a modified client can omit or spoof the header and continue using a still-valid session token. It reliably forces the stock app to sign out but does not stop a determined attacker.
- **Cleanup can race the current device on first launch after 30+ days idle.** `cleanupStaleDevices()` (fire-and-forget in `_layout.tsx`/Settings) can read a stale `lastSeenAt` before the launch sync refreshes it and unbind the actively-used device. Self-healing (re-upload recreates the row), but can drop notifications and briefly remove the device from the list. Excluding the caller's own deviceId from cleanup is a possible improvement.

## Files touched

**Schema:** `drizzle/schema.ts` (+2 tables), `drizzle/meta/*` (migration).
**Server:** `server/devices.ts`, `server/routers.ts`, `server/_core/context.ts`, `shared/const.ts`.
**Client:** `lib/trpc.ts`, `lib/devices.ts`, `lib/device-revoked.ts` (new), `app/(tabs)/settings.tsx`, `app/_layout.tsx`.
**Tests:** `tests/devices.test.ts`, `tests/devices-router.test.ts`, `tests/device-revoked.test.ts` (new).
**Docs:** `todo.md` (Phase 42).