# Desktop P3b-1: Connection, Sync-Now, Test Notification — Design

Date: 2026-09-06. Scope: first settings-parity slice — connectivity
and sync health (approved). LLM/scraper/About follow in P3b-2.

## Problem

Desktop Settings shows a `syncStatus` line with no way to act on it,
has no connection visibility (mobile has a Connection section), and no
way to verify notifications work (mobile has test-notification).
`sendTestNotification` cannot be reused — it returns false on web
unconditionally.

## Approach

Port the three sections using existing desktop pieces (`useConnection`,
`ConnectionBadge`, shared `getSyncSetup`, `lib/web-notifications`),
in desktop Tailwind styling. No new data layers, no new server API.

## Connection section

- New first section in `desktop/src/pages/Settings.tsx`: existing
  `ConnectionBadge` + status text + "Check now" button wired to
  `useConnection().refetch()` (`desktop/src/hooks/use-connection.ts`),
  spinner/disable while the query refreshes.
- No new hooks or endpoints; same query the App shell already runs.

## Sync-Now

- Button in the Account section beside the `syncStatus` text, visible
  when signed in: calls shared `getSyncSetup()?.syncNow()`
  (`lib/sync.ts:628`; `setupSync` runs in `App.tsx`, same engine
  mobile uses), then re-reads `storage.getSyncMeta()` to refresh
  `lastSyncedAt`.
- Disabled while syncing (`syncing` state, same pattern as mobile
  `handleSyncNow`); toast on completion; no-op with explanatory toast
  when signed out (button hidden in that state anyway).

## Test notification

- Button at the bottom of the existing Notifications section using
  the Web Notification API via `lib/web-notifications.ts`
  (`isWebNotificationsSupported`, `requestWebNotificationPermission`,
  `displayWebNotification`) — the same path desktop price alerts
  already use.
- Flow: unsupported → toast explaining unavailability (never a dead
  button); permission request → denied → toast; granted → display test
  notification + success toast.

## Testing

- Source-guard tests: Connection section with refetch, Sync-Now
  button wired to `getSyncSetup`, test-notification via web
  notifications API.
- Verification: `pnpm check` (0 errors), `pnpm lint` (no new
  warnings), `pnpm test` (full suite green), desktop `pnpm build`.

## Non-goals

- LLM/scraper-status/About sections (P3b-2).
- Notification preference logic, sync engine, or server changes.
- Mobile code untouched.
