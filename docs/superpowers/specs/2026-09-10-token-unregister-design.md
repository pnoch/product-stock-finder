# Token Unregister — Design Spec (2026-09-10)

Push opt-out and sign-out orphan server tokens (prune only happens on dead-endpoint send failures). Add an explicit unregister path; desktop calls it on disable + logout. Mobile adoption is a noted follow-up, not this spec.

## §A — `unregisterPushToken` endpoint

`notifications.unregisterPushToken`: protected, no input, `ctx.deviceId` required + `assertDeviceAccess` (same guards as register), calls existing `pruneDeviceToken(ctx.deviceId)`, returns `{ accepted: true }`. Idempotent (delete no-ops when absent). Tests: register→unregister→gone (DB + memory), idempotent empty, missing device rejects, cross-user rejected.

## §B — Desktop calls

`disablePush` calls the mutate best-effort after local unsubscribe (failure leaves the token for dead-endpoint pruning — never throws). `logout` fires it best-effort BEFORE clearing the session (order matters: endpoint needs auth; never blocks logout). Tests: mutate on disable/logout, session intact at call time, failure still completes logout.

## Non-goals

- Mobile unsubscribe/unregister adoption (follow-up); token TTL/expiry; server send-path changes.
