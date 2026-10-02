# Email Alerts — Design Spec

**Date:** 2026-10-02
**Goal:** Deliver an email when a user's alert fires (price drop/rise, restock watch, or back-order reminder), server-side and immediately, so alerts reach users who do not keep the app open. Email is an **additive** delivery channel alongside local + push notifications.

## Decisions (from brainstorming)

- Delivery: **immediate, server-evaluated** (not a daily digest).
- Coverage: **all alert types** (price alerts, restock watches, back-order reminders).
- Opt-in: **`emailAlerts` toggle, default OFF**, recipient = the account email; one-click unsubscribe.

## Preference

`lib/types.ts` gains `AppSettings.emailAlerts?: boolean` (absent/false = disabled). Surfaced as an "Email alerts" switch in the Notifications section of the mobile Settings screen (`app/(tabs)/settings.tsx`) and desktop Settings (`desktop/src/pages/Settings.tsx`), persisted via the existing `updateSettings` → `settings` sync collection → server `app_settings.data`. No new sync plumbing; the server reads `app_settings.data.emailAlerts` directly.

## Trigger point

The server already evaluates every bound user's uploaded config each warmer tick (`server/prices.ts:256` → `evaluateNotifications`). In the **user-scoped** persistence path (`server/notifications/evaluate.ts`, `evaluateUserDb`), after a new user-scoped `notificationEvents` row is inserted, enqueue an email delivery.

- Delivery is **best-effort and off the critical path**: `void deliverEmail(...).catch(log)`; a slow or failed email must never slow or fail the tick.
- Anonymous (userId-null) events never email (no account).

## Idempotency

The user-event path can delete and reinsert a stale row (fresh id, cooldown re-armed), so the row id is not a safe key. New table:

```
notification_email_log(
  userId  int   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dedupKey varchar(191) NOT NULL,
  sentAt  bigint NOT NULL,
  PRIMARY KEY (userId, dedupKey)
)
```

Delivery does an insert-or-ignore on `(userId, dedupKey)`; **send only when the insert created the row**. Exactly one email per condition, regardless of reinserts.

## Unsubscribe

- Signed token: `HMAC-SHA256(String(userId), sessionSecret)` truncated; secret is the existing session secret.
- Public `GET /api/email/unsubscribe?u=<userId>&t=<sig>` verifies the signature, merges `emailAlerts: false` into `app_settings.data` with a fresh LWW stamp, and renders a minimal confirmation HTML. Registered in `server/_core/index.ts` after the security/CORS middleware and rate-limited by IP.
- Every email includes this one-click link.

## Email content

- Subject/body derived from the event (`title`/`body`), product name, and any target/triggered price (formatted via the shared currency helper).
- HTML + plain-text parts. Includes a link to the product/detail page on the web origin and the unsubscribe link.
- Never log message bodies or tokens (existing `server/email.ts` rule).

## Limits & failure handling

- Resend not configured (`isEmailConfigured()` false) → log + skip (existing behavior).
- Per-user **daily cap** (20/day) enforced against `notification_email_log`; over cap → skip (the event is still recorded for in-app/push).
- Send failure → logged, and the claim row is **kept** so the failure counts toward the daily cap and the condition is not retried (the in-app/push channels already cover the alert). Bounded by the daily cap.
- Recipient lookup: `users.email`; skip when absent.

## Testing

- Unit (no DB): `emailAlerts` off → no send; on → send once; reinsert with the same `dedupKey` → still once; daily cap enforced; unconfigured Resend skips; unsubscribe flips the flag; content contains the unsubscribe link and product link.
- DB-gated: bound user + active alert + cached price → exactly one email (Resend mocked); a second tick sends no duplicate.
- Existing evaluation/notification suites stay green.

## Out of scope (v1)

- Bulk-import discovery (separate next cycle).
- Email for anonymous/unbound devices.
- Digest/batched email; per-event-type email toggles.
- The client may still deliver its own local/push notification for the same trigger; email is additive.

## File Summary

| File | New/Modify |
|------|-----------|
| `lib/types.ts` | +`AppSettings.emailAlerts` |
| `app/(tabs)/settings.tsx`, `desktop/src/pages/Settings.tsx` | +toggle |
| `drizzle/schema.ts` | +`notification_email_log` |
| `server/notifications/email-alerts.ts` | new: deliverEmail + cap + unsubscribe token |
| `server/notifications/evaluate.ts` | hook after user-event insert |
| `server/_core/index.ts` | register unsubscribe route |
| `server/email.ts` | unchanged (reused) |
| `tests/*` | unit + DB-gated |
| `todo.md` | append phase entry |
