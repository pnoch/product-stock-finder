# Auth-Gate Notification Endpoints

Close audit finding #6: `notifications.uploadConfig`, `notifications.pull`, and
`notifications.registerPushToken` are public procedures that trust a client-supplied
`deviceId` as their only capability. Anyone — fully signed out — can pull another
device's queued events, overwrite its config, or bind push tokens to it by naming its
device id. Signed-in callers can additionally address devices owned by other users.

## Decisions

- **Sign-in required.** All three endpoints become `protectedProcedure`. Signed-out
  users keep local notifications; server-side scheduling/push becomes a signed-in
  feature, matching the sync model. Sign-out already unbinds the device server-side,
  so nothing dangles.
- **Context-derived identity.** The server no longer accepts `deviceId` from input.
  Each handler resolves it as `ctx.deviceId` (session claim → `x-device-id` header
  fallback), which `createContext` already normalizes.
- **Ownership enforcement.** A shared guard applies to reads and writes alike:
  unbound device → allow (first authenticated touch binds it via the existing
  upserts); bound to the caller → allow; bound to another user → `FORBIDDEN`.

## Server changes

### `server/devices.ts`

New guard:

```ts
export async function assertDeviceAccess(userId: number, deviceId: string): Promise<void>
```

Uses `getDeviceBinding(deviceId)`. `{ userId: null }` or `{ userId }` match → return;
otherwise throw `TRPCError` `FORBIDDEN` with message
`"Notification device belongs to another account"`.

### `server/routers.ts` — notifications router

- `uploadConfig`, `pull`, `registerPushToken`: switch to `protectedProcedure`;
  remove `deviceId` from each input schema.
- Handlers call `assertDeviceAccess(ctx.user.id, ctx.deviceId)` first, then pass
  `ctx.user.id` (no `?? null`) to `upsertDeviceConfig` / `pullPendingEvents` /
  `upsertPushToken`.
- If `ctx.deviceId` is null (authenticated session with neither a session device
  claim nor an `x-device-id` header), throw `BAD_REQUEST`.

## Client changes

- `lib/server-notifications.ts`: `uploadNotificationConfig(config, healthEvents?)`
  and `pullNotificationEvents()` drop the `deviceId` parameter.
- `lib/push-token.ts` and `lib/web-push.ts`: stop sending `deviceId` in the
  `registerPushToken` mutation (the tRPC client already sends `x-device-id`).
- `lib/web-notifications.ts`: start the 60-second poll only when authenticated;
  stop it on sign-out, so signed-out tabs don't hit `UNAUTHORIZED` every minute.
- Launch/background call sites (`app/_layout.tsx`,
  `lib/background-tasks/price-check.ts`) keep best-effort semantics: signed out,
  requests fail silently and the app stays local-only.

## Errors and edge cases

- Signed-out callers receive `UNAUTHORIZED`; every client wrapper already swallows
  errors, so degradation is graceful.
- The ownership `FORBIDDEN` message deliberately differs from
  `DEVICE_REVOKED_ERR_MSG`, so the global sign-out interceptor (`lib/trpc.ts`)
  does not misfire on ownership conflicts.
- Revoked devices are already rejected globally in `createContext` before any
  procedure runs — unchanged by this design.
- Legacy `userId = null` config/token rows are inert today (evaluation skips them)
  and become claimable on first authenticated touch. No data migration.
- `devices.current` remains public on purpose (pre-auth binding lookup) and is out
  of scope for this change.

## Testing

- Flip the "works without authentication" router tests to expect `UNAUTHORIZED`.
- Ownership matrix per endpoint (memory backend; DB-backed variants behind
  `RUN_DB_TESTS`): unbound adopts, own passes, foreign rejects.
- Update wrapper tests for the new signatures.
- Add a test that the web poll gates on auth state.
