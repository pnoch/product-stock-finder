# Device Session Hardening & Un-Revoke v4.3 Design

**Date:** 2026-08-15
**Status:** Approved design — pending implementation plan

## Problem

v4.2 shipped device labels, remote sign-out, and 30-day idle cleanup. Its spec documented three known limitations:

1. **Revoked device cannot re-authenticate in-app.** The revocation marker is never cleared and `deviceId` is stable across re-login, so a revoked device is permanently blocked from authenticated features until app data is wiped (regenerating the deviceId). There is no un-revoke path.
2. **Revocation is a UX mechanism, not a security boundary.** `x-device-id` is client-controlled and unauthenticated; a modified client can omit or spoof the header and continue using a still-valid session token.
3. **Cleanup can race the current device on first launch after 30+ days idle.** `cleanupStaleDevices()` can read a stale `lastSeenAt` before the launch sync refreshes it and unbind the actively-used device.

## Goal

Resolve all three:

1. **Un-revoke via re-login** — a successful OAuth login clears the device's revocation marker, so re-authenticating (which proves account ownership) restores access. No new UI.
2. **Device-bound sessions** — embed `deviceId` into the issued session JWT; the server enforces revocation against the token's `deviceId` claim (tamper-proof) rather than the spoofable header. Legacy tokens (no claim) keep working via the header fallback.
3. **Cleanup race fix** — `cleanupStaleDevices` excludes the caller's own deviceId.

## Decisions (from brainstorming)

| Question | Decision |
| -------- | -------- |
| Scope | All three limitations addressed in one phase |
| Un-revoke verification | **Login is the un-revoke**: successful OAuth exchange clears the marker for the authenticating deviceId (account credential = proof of ownership). No explicit "restore" action or endpoint. |
| Hardening approach | **Device-bound sessions** (JWT claim) — not a server-side session registry (larger; rejected in brainstorming) |
| DeviceId source for revocation | Token claim preferred (`user.sessionDeviceId`); header used only as fallback for legacy tokens / anonymous context |
| Cleanup race | `cleanupStaleDevices(userId, cutoffMs, excludeDeviceId?)` skips the caller's device; router passes `ctx.deviceId` |
| Legacy token handling | Grace: tokens without a `deviceId` claim keep working via header check; no forced logout |

## Architecture

- **Server (token claim):** `server/_core/sdk.ts` — `SessionPayload`/`signSession`/`verifySession`/`createSessionToken` carry an optional `deviceId`; `authenticateRequest` attaches `sessionDeviceId` to the returned user.
- **Server (issuance):** `server/_core/oauth.ts` — web callback + mobile exchange decode `deviceId` (web: from new JSON `state`; native: from the same `state`), pass it into `createSessionToken`, and call the new `unrevokeDevice(deviceId)` after a successful login.
- **Server (enforcement):** `server/_core/context.ts` — revocation check uses `user.sessionDeviceId ?? headerDeviceId`; `ctx.deviceId` reflects the claim when present.
- **Server (devices):** `server/devices.ts` — add `unrevokeDevice(deviceId)`; add `excludeDeviceId` param to `cleanupStaleDevices`; `server/routers.ts` passes `ctx.deviceId` to `cleanupStale`.
- **Shared:** `shared/oauth-state.ts` (new) — `encodeOAuthState`/`decodeOAuthState` used by the client to build `state` and by the server to read `redirectUri` + `deviceId`.
- **Client:** `constants/oauth.ts` — `getLoginUrl()` becomes async and embeds `deviceId` in the OAuth `state` via `encodeOAuthState`. No change to `lib/_core/api.ts` (the `state` round-trips through the portal/deep link and carries the deviceId). No change to revocation detection (`lib/trpc.ts`, `lib/device-revoked.ts` unchanged).

## Session token

### `server/_core/sdk.ts`

- `SessionPayload` gains `deviceId?: string | null`.
- `createSessionToken(openId, options)` — `options` gains `deviceId?: string`. It is embedded as a JWT claim (`SignJWT({ openId, appId, name, ...(deviceId ? { deviceId } : {}) })`).
- `verifySession(cookieValue)` — returns `deviceId` from the payload when present, else `null`. Legacy tokens (no claim) are unaffected.
- `authenticateRequest(req)` — after a successful session verify, attach `sessionDeviceId` to the returned user object (`AuthenticatedUser` gains `sessionDeviceId?: string | null`). Cron users get `null`.

No server-side session registry. Revocation stays a per-request check (`isDeviceRevoked` in `createContext`), just sourced from the token claim.

## OAuth state encoding

### Shared helpers (`shared/oauth-state.ts`, new)

- `encodeOAuthState(redirectUri: string, deviceId?: string): string` — `base64(JSON.stringify({ redirectUri, deviceId }))`.
- `decodeOAuthState(state: string): { redirectUri: string; deviceId: string | undefined }` — JSON-parse; on failure fall back to the legacy plain-base64-redirectUri form (`{ redirectUri: state-as-decoded, deviceId: undefined }`), tolerating in-flight/older logins.
- Both helpers use a `btoa`/`atob` + `Buffer` fallback guard matching `constants/oauth.ts` (works in node, web, and RN).

### `constants/oauth.ts` (client)

- `getLoginUrl()` becomes `async` and awaits `getDeviceId()`.
- `state` = `encodeOAuthState(redirectUri, deviceId)` (replaces the inline `encodeState`).
- `startOAuthLogin()` (already async) awaits `getLoginUrl()`. Only caller is `app/(tabs)/settings.tsx:302`.

### `server/_core/sdk.ts` + `server/_core/oauth.ts` (decode)

- `sdk.decodeState(state)` is replaced by `decodeOAuthState(state).redirectUri` (sdk.ts:58 keeps deriving the redirectUri for the token exchange from the JSON form).
- Web `/api/oauth/callback` and mobile `/api/oauth/mobile` in `oauth.ts` call `decodeOAuthState(state)` to read `deviceId`; then:
  - After `syncUser` succeeds, call `unrevokeDevice(deviceId)` (when a deviceId is present).
  - Call `sdk.createSessionToken(userInfo.openId, { name, expiresInMs, deviceId })` so the token carries the claim.

## Revocation check (`server/_core/context.ts`)

- Compute `const claimDeviceId = user?.sessionDeviceId ?? null;` and `const effectiveDeviceId = claimDeviceId ?? headerDeviceId;`.
- Revocation check fires when `effectiveDeviceId && user && isDeviceRevoked(effectiveDeviceId)` → throw `TRPCError({ code: "FORBIDDEN", message: DEVICE_REVOKED_ERR_MSG })`.
- `ctx.deviceId = effectiveDeviceId`.
- Behavior matrix:
  - New token + revoked claim → FORBIDDEN (spoofing the header can't help; the claim is signed).
  - Legacy token + revoked header → FORBIDDEN (unchanged from v4.2).
  - New token + non-revoked claim → pass; `ctx.deviceId` = claim.
  - Anonymous → pass; `ctx.deviceId` = header (public procedures unchanged).

## Devices module (`server/devices.ts`)

- **`unrevokeDevice(deviceId: string): Promise<void>`**
  - DB: `delete from revoked_devices where deviceId = ?`.
  - Memory: `memoryRevokedDevices.delete(deviceId)`.
  - Idempotent; no binding check (a marker may exist for a device with no config/token rows).
- **`cleanupStaleDevices(userId: number, cutoffMs: number, excludeDeviceId?: string | null): Promise<number>`**
  - Skips the device whose `deviceId === excludeDeviceId`.
  - Otherwise unchanged.

### `server/routers.ts`

- `devices.cleanupStale` passes `ctx.deviceId` as the third arg: `cleanupStaleDevices(ctx.user.id, Date.now() - STALE_DEVICE_MS, ctx.deviceId)`.
- No new procedures (un-revoke happens server-side during login; no client-facing endpoint).

## Error handling

- `unrevokeDevice` is best-effort and idempotent — a missing marker is a no-op; DB/memory failures are caught at the login-handler boundary (login still succeeds with the marker intact).
- Token creation still succeeds if `deviceId` is absent/legacy (grace path).
- Cleanup exclusion is a pure filter — no new failure modes.

## Testing (vitest)

- `tests/devices.test.ts` (extend):
  - `unrevokeDevice`: after `signOutDevice`, calling `unrevokeDevice` makes `isDeviceRevoked` return false (memory + DB paths); idempotent when no marker exists.
  - `cleanupStaleDevices`: excludes `excludeDeviceId` (memory + DB paths); fresh devices kept; `lastSeenAt === 0` skipped (memory mode).
- `tests/devices-router.test.ts` (extend):
  - `cleanupStale` forwards `(userId, cutoff, ctx.deviceId)`; update existing assertion (now 3 args).
  - `cleanupStale` with a context `deviceId` excludes the current device.
- New `tests/session-binding.test.ts`:
  - `signSession`/`verifySession` round-trips the `deviceId` claim; legacy payload (no `deviceId`) verifies with `deviceId: null`.
  - `createSessionToken(openId, { deviceId })` → `verifySession` returns it.
- New `tests/oauth-state.test.ts`:
  - `encodeOAuthState`/`decodeOAuthState` round-trip `{ redirectUri, deviceId }`.
  - Legacy plain-base64 state decodes with `deviceId: undefined`.
- `tests/device-revoked.test.ts` (extend):
  - `createContext` throws FORBIDDEN when the **token claim** deviceId is revoked even if the header is absent/different (mock `authenticateRequest` to return `sessionDeviceId`).
  - `createContext` falls back to the header when `sessionDeviceId` is null.
- Gates: `pnpm check` 0 errors, `pnpm lint` clean (only pre-existing `MODULE_TYPELESS_PACKAGE_JSON` warning), full `pnpm test` green. No client component tests (repo convention — UI verified via check + lint).

## Out of scope (YAGNI)

- Server-side session registry / per-session revocation.
- Device-secret rotation or per-device credentials beyond the JWT claim.
- Explicit "restore device" UI or endpoint (login is the un-revoke).
- Web session binding to a second factor (the JWT claim is bound to the deviceId at issuance).
- Backfilling deviceId claims onto already-issued tokens (legacy grace path is sufficient).

## Remaining known limitations

- A determined attacker who can complete OAuth on the target device (knows the account password) can re-login and clear the marker — inherent to password-based auth; remote sign-out remains a UX/revocation tool, not a defense against a fully-compromised account.
- Legacy tokens issued before this change carry no `deviceId` claim and are only revoked via the header path until the user next logs in.
- The cleanup race is eliminated for the calling device (its own `deviceId` is excluded), but a *second* device that is genuinely stale can still be cleaned up concurrently — correct behavior.

## Files touched

**Server:** `server/_core/sdk.ts` (SessionPayload + deviceId claim), `server/_core/oauth.ts` (state decode + unrevoke on login + deviceId in token), `server/_core/context.ts` (claim-authoritative revocation check), `server/devices.ts` (+`unrevokeDevice`, cleanup exclude param), `server/routers.ts` (cleanup passes ctx.deviceId).
**Shared:** `shared/oauth-state.ts` (new).
**Client:** `constants/oauth.ts` (async getLoginUrl + JSON state).
**Tests:** `tests/devices.test.ts`, `tests/devices-router.test.ts`, `tests/device-revoked.test.ts` (extend), `tests/session-binding.test.ts` (new), `tests/oauth-state.test.ts` (new).
**Docs:** `todo.md` (Phase 43).
