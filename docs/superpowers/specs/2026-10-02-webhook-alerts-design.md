# Webhook Alerts (Discord/Slack) — Design Spec

**Date:** 2026-10-02
**Goal:** POST a message to a user's Discord or Slack incoming webhook when one of their alerts fires (price drop/rise, restock watch, or back-order reminder). Server-evaluated and immediate, so it reaches users who do not keep the app open. Webhook is an **additive** delivery channel alongside local + push + email.

## Decisions (from brainstorming)

- Providers: **Discord and Slack**, distinguished automatically from the webhook URL host.
- UX: **one "Webhook URL" field** plus an **enable toggle** and a **"Send test" button**.
- Delivery: **immediate, server-evaluated**, mirroring the email channel.
- Opt-in: **`webhookAlerts` toggle, default OFF**. The URL alone does not enable delivery.
- Backups: the URL is a **bearer credential** (anyone holding it can post to the channel), so it is excluded from user-shareable backup files. Settings **sync still uploads it** to the server (delivery is server-side); only the plaintext backup path strips it.

## Preference

`lib/types.ts` `AppSettings` gains:

```ts
  /** Webhook delivery for alerts (opt-in; default off). */
  webhookAlerts?: boolean;
  /** Discord/Slack incoming webhook URL. */
  alertWebhookUrl?: string;
```

`lib/storage/settings.ts` `DEFAULT_SETTINGS` gains `webhookAlerts: false` and `alertWebhookUrl: ""`. Persisted through the existing `updateSettings` → `settings` sync collection → server `app_settings.data`. The server reads `data.webhookAlerts === true` and `data.alertWebhookUrl` directly; no new sync plumbing. Because delivery is server-side and per user, the Settings UI shows a "Sign in to use webhooks" note when signed out.

## Trigger point

The server already evaluates every bound user's uploaded config each warmer tick (`server/prices.ts` → `evaluateNotifications`). In `server/notifications/evaluate.ts`, `evaluateUserDb`, immediately after the existing email loop (~L511), enqueue a webhook per inserted event:

```ts
    for (const event of toInsert) {
      // ... same productId extraction as the email hook
      void deliverWebhookForEvent(userId, {
        dedupKey: event.dedupKey,
        title: event.title,
        body: event.body,
        productId,
      }).catch(() => {});
    }
```

- Delivery is **best-effort and off the critical path**; a slow or failed POST must never slow or fail the tick.
- Anonymous (userId-null) events never send (no account/config).

## URL validation & provider adaptation

`classifyWebhookUrl(raw: string): "discord" | "slack" | null`:

- Must parse as a URL with `https:` protocol.
- Slack: `host === "hooks.slack.com"`.
- Discord: `host === "discord.com" || host === "discordapp.com"` or a subdomain ending in `.discord.com` / `.discordapp.com`.
- Anything else → `null`. This allowlist is the entire SSRF surface (the URL is user-supplied and fetched by the server); it is applied to **both** real delivery and the test endpoint.

Payloads:

- Slack: `{ text }`.
- Discord: `{ content, allowed_mentions: { parse: [] } }` so the message cannot ping `@everyone`/roles.
- Mention syntax in the text (`@everyone`, `@here`, `<@id>`, `<!channel>`) is neutralized before sending (Slack parses `text` as mrkdwn by default).

Transport: direct `fetch` POST, `AbortController` **5s timeout**, no retries, success = HTTP 2xx.

## Idempotency & limits

The user-event path can delete and reinsert a stale row (fresh id, cooldown re-armed), so the row id is not a safe key. New table:

```
notification_webhook_log(
  userId  int   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dedupKey varchar(191) NOT NULL,
  sentAt  bigint NOT NULL,
  PRIMARY KEY (userId, dedupKey)
)
```

- Insert-or-ignore on `(userId, dedupKey)`; **send only when the insert created the row** (`.insert().ignore()` affectedRows === 1). Exactly one webhook per condition regardless of reinserts.
- Per-user **daily cap** 20, counted from `notification_webhook_log.sentAt` over the last 24h; over cap → skip (the event is still recorded for in-app/push/email).
- Send failure (non-2xx, timeout, exception) → logged, and the claim row is **kept** so it counts toward the daily cap and the condition is not retried (the other channels already cover it).

## Content

One text message per event built from the event `title` + `body`, plus a product link `${origin}/product/${productId}` when a product id is present, plus a trailing line "Manage alerts in Product Stock Finder settings." `origin` = trimmed `EXPO_PUBLIC_WEB_URL` (fallback `EXPO_PUBLIC_API_BASE_URL`). No unsubscribe link (a webhook is not an inbox).

## "Send test" endpoint

Authenticated tRPC mutation `notifications.testWebhook`:

- Input `{ url: string }` → output `{ ok: boolean; error?: string }`.
- Validates via `classifyWebhookUrl`; rejects with a friendly error when invalid.
- POSTs a fixed sample message ("Test alert from Product Stock Finder — your webhook is configured correctly.").
- **Does not** write `notification_webhook_log` and **does not** count toward the daily cap.
- Rate-limited per user (5/min). Sign-in required (protected procedure), matching the server-side delivery model.
- Client wrapper `testWebhook(url)` added to `lib/server-notifications.ts`; called by both mobile and desktop Settings.

## Settings UI

- Mobile `components/settings/notifications-section.tsx`: after the Health Alerts row, a webhook block — URL `TextInput` (local state, committed on blur), "Enable webhooks" `Switch` bound to `webhookAlerts`, and a "Send test" button with inline success/failure. Hidden/disabled with a "Sign in to use webhooks" note when signed out.
- Desktop `desktop/src/pages/Settings.tsx`: equivalent URL input + checkbox + "Send test" button in the Notifications section.
- iOS/web icon needs no new mapping (reuse `link`/`paperplane`).

## Testing

- Unit (no DB): `classifyWebhookUrl` accepts valid Discord/Slack and rejects `http:`, `evil.com`, and subdomain-spoof hosts (`discord.com.evil.com`); payload shape per provider; mention neutralization; content builder includes the product link and omits it when null.
- DB-gated: sends once per condition and ignores reinserts with the same `dedupKey`; no send when `webhookAlerts` is off; daily cap enforced (20); invalid/unallowlisted URL skipped; non-2xx keeps the claim and does not retry.
- Pipeline DB: bound user + active alert + cached price + opted-in setting → exactly one POST (fetch mocked); a second tick sends no duplicate.
- Endpoint: protected; rejects an unallowlisted URL; returns `ok` on 204.
- UI source guards: mobile + desktop files contain the URL field, toggle, and test affordance.
- Existing evaluation/notification suites stay green.

## Out of scope (v1)

- Multiple webhooks per user; providers beyond Discord/Slack (Teams, ntfy, generic).
- Digest/batched webhooks; custom message templates.
- Retries/backoff; signed webhooks.
- Webhooks for anonymous/unbound devices.

## File Summary

| File | New/Modify |
|------|-----------|
| `lib/types.ts`, `lib/storage/settings.ts` | +`webhookAlerts`, `alertWebhookUrl` |
| `drizzle/schema.ts` | +`notification_webhook_log` (migration) |
| `server/notifications/webhook-alerts.ts` | new: classify, payload builder, content, gated delivery, test send |
| `server/notifications/evaluate.ts` | hook after the email loop |
| `server/routers.ts` | +`notifications.testWebhook` |
| `lib/server-notifications.ts` | +`testWebhook` wrapper |
| `components/settings/notifications-section.tsx` | mobile config UI |
| `desktop/src/pages/Settings.tsx` | desktop config UI |
| `tests/*` | unit + DB-gated + pipeline + endpoint + UI guards |
| `todo.md` | append phase entry |
