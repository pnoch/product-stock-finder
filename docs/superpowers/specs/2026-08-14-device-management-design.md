# Device Management UI Design (v4.1)

**Date:** 2026-08-14
**Status:** Approved design — pending implementation plan

## Problem

v4.0 introduced device↔user binding for user-scoped notifications: devices bind to a user on the first authenticated `uploadConfig`/`registerPushToken`, and the preserve-on-null fix guarantees binding persists across logout/login. This means a device stays permanently bound to a user with no remedy — a sold or lost device keeps receiving that user's notifications, and no UI exists to see which user a device is bound to or to unbind devices.

## Goal

A "Device Management" section in Settings where a signed-in user can:
1. See the current device's binding status (bound to you / bound to another account / not bound).
2. Bind the current device to their account explicitly.
3. See every device bound to their account (platform + last seen).
4. Unbind a sold/lost device (full removal).

Anonymous users see nothing (the section is gated on `isAuthenticated`).

## Architecture

- **Server:** new `server/devices.ts` module with memory/DB parallel helpers (mirroring `server/notifications.ts` and `server/push-notifications.ts`), surfaced through a new `devices` router in `server/routers.ts`.
- **Client:** new `lib/devices.ts` best-effort tRPC helper, and a new "Device Management" section in `app/(tabs)/settings.tsx` after the Account section.
- **No schema changes** — the existing device tables already carry everything needed.
- **No client changes beyond Settings + lib helper.**

## Server

### New module: `server/devices.ts`

All three functions follow the established memory/DB parallel pattern: when `getDb()` returns null, operate on the module-level memory maps (`memoryConfigs`, `memoryTokens`, `memoryDeliveries`, `memoryEvents` from `server/notifications.ts` and `server/push-notifications.ts`); otherwise use Drizzle queries against the device tables.

**`listDevicesForUser(userId: number): Promise<DeviceInfo[]>`**

`DeviceInfo = { deviceId: string; platform: string | null; lastSeenAt: number }`

- DB path: union of `deviceNotificationConfigs` rows and `devicePushTokens` rows where `userId = ?`, deduped by `deviceId`. `lastSeenAt` = max of the two rows' `updatedAt` for that device. `platform` = the token row's `platform` when present, else null (config-only device).
- Memory path: scan `memoryConfigs` and `memoryTokens` for entries whose `userId` matches, apply the same dedup/lastSeen/platform logic.
- Sort by `lastSeenAt` descending.

**Memory-map access (implementation note):** the maps `memoryConfigs`/`memoryEvents`/`memoryDeliveries` (in `server/notifications.ts`) and `memoryTokens` (in `server/push-notifications.ts`) are module-private. `server/devices.ts` must NOT reach into them directly. Instead, the owning modules export two small helpers each:
- `server/notifications.ts`: `export function listMemoryConfigDevices(): Array<{ deviceId: string; userId: number | null }>` and `export function removeMemoryDevice(deviceId: string): void` (deletes the config entry, the device's delivery set, and any `memoryEvents` entries with that `deviceId`).
- `server/push-notifications.ts`: `export function listMemoryTokenDevices(): Array<{ deviceId: string; userId: number | null; platform: string | null }>` and `export function removeMemoryToken(deviceId: string): void`.

`server/devices.ts` orchestrates: DB path issues the SQL deletes itself; memory path calls these helpers. Both memory helpers must also be exercised by the existing `clearXForTests` in each module so tests stay isolated.

**`lastSeenAt` in memory mode:** the memory entries do not track `updatedAt`. In memory mode `listDevicesForUser` returns `lastSeenAt: 0` (unknown); the UI treats 0 as "last seen unknown". DB mode returns the real max `updatedAt`.

**`getDeviceBinding(deviceId: string): Promise<{ userId: number | null }>`**

- DB path: read `userId` from the `deviceNotificationConfigs` row; if no config row exists, fall back to the `devicePushTokens` row. Return `{ userId: null }` when the device is unknown.
- Memory path: check `memoryConfigs` entry, else `memoryTokens` entry.

**`unbindDevice(userId: number, deviceId: string): Promise<boolean>`**

- **Verifies the device is bound to `userId`** before deleting — a caller cannot unbind another user's device. Returns `false` if the device is not bound to that user.
- Full removal when bound:
  - DB path: delete the `deviceNotificationConfigs` row, `devicePushTokens` row, `notificationEventDeliveries` rows (by deviceId), and any `notificationEvents` rows with that `deviceId` (anon-scoped events). Returns `true`.
  - Memory path: delete the corresponding entries from `memoryConfigs`, `memoryTokens`, `memoryDeliveries` (by deviceId), and any `memoryEvents` entries with that `deviceId`. Returns `true`.

### New router: `devices` in `server/routers.ts`

| Procedure | Type | Auth | Input | Output |
|---|---|---|---|---|
| `devices.list` | query | `protectedProcedure` | — | `{ devices: DeviceInfo[] }` for `ctx.user.id` |
| `devices.current` | query | `publicProcedure` | `{ deviceId: string(1-128) }` | `{ deviceId: string; userId: number \| null }` |
| `devices.unbind` | mutation | `protectedProcedure` | `{ deviceId: string(1-128) }` | `{ unbound: boolean }` |

- `list` and `unbind` use `protectedProcedure` (from `server/_core/trpc.ts`) — UNAUTHORIZED when not authenticated.
- `current` stays `publicProcedure` with a self-declared `deviceId` (same trust model as the existing `notifications` procedures — a device querying its own binding).
- `unbind` passes `ctx.user.id` as `userId`; the module verifies the device belongs to that user.

### Unbind semantics (decided)

Unbind = **full removal**: config row, push-token row, delivery rows, and anon-scoped events for that device are deleted. The device disappears from the list and stops receiving notifications; it would need to re-register fresh. This is the "sold/lost device" case. No soft-delete, no revert-to-anonymous.

## Client

### New helper: `lib/devices.ts`

Best-effort, following `lib/server-notifications.ts` shape (4s timeout, try/catch, safe fallbacks, `createTRPCClient()`):

- `fetchDevices(): Promise<DeviceInfo[]>` — calls `devices.list`; returns `[]` when not authenticated or on error.
- `fetchCurrentDeviceBinding(): Promise<{ userId: number | null }>` — calls `devices.current` with the local `deviceId` (from `lib/device-id.ts`); returns `{ userId: null }` on error.
- `unbindDevice(deviceId: string): Promise<boolean>` — calls `devices.unbind`; returns `false` on error.
- `bindCurrentDevice(): Promise<void>` — re-runs the existing authenticated `registerPushToken()` and `syncServerNotifications()` (the v4.0 launch flow) to force a rebind of the current device to the signed-in user. Best-effort.

### Settings section: "Device Management"

Inserted in `app/(tabs)/settings.tsx` **after the Account section**, gated on `isAuthenticated && user`. Uses the existing `SectionHeader` + card + `SettingRow` pattern, and the Scraper-Status-style `.map()` list.

1. **This device** — current device binding status from `fetchCurrentDeviceBinding()`:
   - `userId === user.id` → "Bound to you" (green success badge).
   - `userId` set but ≠ `user.id` → "Bound to another account" (warning badge) + **"Bind to my account"** button → `bindCurrentDevice()`.
   - `userId === null` → "Not bound" (muted badge) + **"Bind to my account"** button → `bindCurrentDevice()`.
2. **Bound devices** — from `fetchDevices()`. Each row: truncated `deviceId`, platform label (iOS / Android / Unknown), relative last-seen time, and an **Unbind** action (destructive `Alert.alert` confirm + haptics, matching `alerts.tsx`). The current device (matching the local `deviceId`) gets a "This device" badge and no Unbind action (you can't unbind the device you're using).
3. **States:** loading spinner while fetching; error → muted "Couldn't load devices" row with Retry; empty list → "No other devices bound to your account".
4. Data loads on mount and refreshes after bind/unbind actions; a manual refresh is available via the Retry state (pull-to-refresh is not available in this tab).

## Error handling

- Client helpers are best-effort: failures return safe fallbacks and the UI shows the muted error state, never a crash.
- Server `unbind` never throws for the not-bound case — it returns `{ unbound: false }`.
- Unbind confirm uses the destructive `Alert.alert` pattern with haptics (`Haptics.notificationAsync` warning on confirm, `Haptics.impactAsync` on tap, guarded for web).

## Testing (vitest)

- `tests/devices.test.ts` — memory-path tests (mock `getDb` → null):
  - `listDevicesForUser`: union + dedup across config/token maps, lastSeenAt = max, platform from token (null for config-only), sorting.
  - `getDeviceBinding`: config row wins, token row fallback, unknown device → null.
  - `unbindDevice`: removes config/token/deliveries/anon-events for the bound device; returns `false` when the device is bound to a different user or unknown; returns `true` and cleans up on success.
- `tests/devices-router.test.ts` — `appRouter.createCaller(createAuthedContext(...))` + `createPublicContext` (patterns from `tests/notifications-router.test.ts`):
  - `list` and `unbind` throw UNAUTHORIZED without a user (protectedProcedure).
  - `list` returns devices for `ctx.user.id`; `current` works anonymously; `unbind` passes `ctx.user.id` and returns `{ unbound }`.
- Verify no cross-test leakage: `unbindDevice` may need `clearDevicesForTests()` or reuse of existing `clearNotificationsForTests`/`clearPushTokensForTests` — ensure memory maps are reset between tests.
- Gates: `pnpm check` 0 errors, `pnpm lint` clean (only pre-existing `MODULE_TYPELESS_PACKAGE_JSON` warning), full `pnpm test` green. No client component tests (repo convention — UI verified via check + lint).

## Out of scope (YAGNI)

- Device rename/labels.
- Multi-user admin device management.
- Desktop (Tauri) app changes — new procedures are reachable from it via the same tRPC API, but no desktop UI work.
- Revoking push on the device itself / "sign out of device" remote logout.
- Notification-history cleanup on unbind.

## Files touched

**Server:** `server/devices.ts` (new), `server/routers.ts` (add `devices` router).
**Client:** `lib/devices.ts` (new), `app/(tabs)/settings.tsx` (new section).
**Tests:** `tests/devices.test.ts` (new), `tests/devices-router.test.ts` (new), possibly `tests/notifications.test.ts` / `tests/push-notifications.test.ts` (clear helpers if unbind touches shared maps).
**Docs:** `todo.md` (Phase 41).
