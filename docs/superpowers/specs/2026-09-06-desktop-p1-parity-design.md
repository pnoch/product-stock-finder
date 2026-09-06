# Desktop P1 Parity: Shared-Link Route + Alerts Error Path — Design

Date: 2026-09-06. Scope: sub-project P1 of desktop parity gaps —
fix two user-facing breakages (approved).

## Problem

1. Shared watchlist links (`/w/:token`, created on either platform)
   404 on desktop: `desktop/src/App.tsx` has no `/w/:token` route, so
   they fall through to `NotFound`.
2. `desktop/src/pages/Alerts.tsx` loads reminders via a bare
   `Promise.all(...)` with no catch: any storage failure leaves
   `remindersLoading` true forever (infinite spinner). Mobile
   `app/(tabs)/alerts.tsx` shows a `loadError` banner with Retry.

## Approach

List + bulk-add shared page (approved over full mobile parity; CSV
export and per-product add defer to P2 share/export work). Alerts fix
mirrors the mobile banner pattern.

## Shared route

- `desktop/src/App.tsx`: add `<Route path="/w/:token"
  element={<SharedWatchlist />} />` before the `*` NotFound route.
- New `desktop/src/pages/SharedWatchlist.tsx`: read `token` via
  `useParams` (same as `Compare.tsx`); fetch via the desktop `trpc`
  object's `sharedWatchlists.get.useQuery` (`desktop/src/lib/trpc.ts`;
  `trpc.Provider` + `QueryClientProvider` already wired in `App.tsx`).
  The endpoint is a `publicProcedure` (`server/routers.ts:421`) — no
  auth required, works for signed-out recipients.
- Render: share title/meta, product rows (name, best price via
  `@shared/currency`, `StockBadge` — reuse existing desktop
  components), one "Add all to watchlist" button via desktop storage
  (skip invalid entries, toast counts like mobile's added/failed).
- States: loading spinner (`LoadingSpinner`), error/expired token →
  "Share not found" + Back link (mirror mobile copy).

## Alerts reminders error path

- `desktop/src/pages/Alerts.tsx`: extract the reminders load into a
  `loadReminders` callback; wrap in try/catch with a `remindersError`
  state; render an error banner with a Retry button re-running the
  loader (desktop styling of the mobile `loadError` pattern).
- `remindersLoading` resolves in all paths (no more infinite spinner).

## Testing

- Source-guard tests: `/w/:token` route registered in `App.tsx`;
  SharedWatchlist page queries `sharedWatchlists.get`; Alerts page has
  reminders error state + retry path.
- Verification: `pnpm check` (0 errors), `pnpm lint` (no new
  warnings), `pnpm test` (full suite green), desktop `pnpm build`.

## Non-goals

- No CSV export or per-product add on the shared page (P2).
- No changes to mobile `w/[token]`, no server changes.
- Remaining P2/P3 gaps (Watchlist actions/filters, CrossAlertCTA, AI
  insight, settings sections, stats share, password reset,
  onboarding) untouched.
