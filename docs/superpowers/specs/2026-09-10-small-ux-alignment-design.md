# Small UX Alignment — Design Spec (2026-09-10)

Four mirror-mobile fixes. No new patterns, no new infra, no UI language beyond mobile copy. Decisions locked in brainstorming: tags pointer retargets to Watchlist (no Settings tag UI); deal sort persists (no session-only variant).

## §A — Alerts tab count (`desktop/src/pages/Alerts.tsx:280`)

Replace `Alerts ({alerts.length})` with mobile's formula (`hooks/use-alerts-data.ts:294`): active + untriggered + unsnoozed. Extract as a shared predicate if the desktop `useAlerts` hook fits (planning decides; fallback: inline filter). In-list content unchanged — only the count. Test with mixed alert states.

## §B — Persist deal sort (`desktop/src/pages/Watchlist.tsx:270`)

Remove the `sortKey === "deal" ? s.watchlistSortKey : sortKey` carve-out; persist like every other sort (mobile `persistViewPrefs`). Verify the loader accepts `"deal"` on restore. Test the round-trip.

## §C — Tags empty-state pointer (`desktop/src/components/SearchModal.tsx:438`)

Copy → "No tags yet. Create tags in Watchlist." + button navigating to `/watchlist` and closing the modal. No Settings changes. Guard asserts copy + link target, no "Settings" pointer.

## §D — Notifications tab refresh (`desktop/src/pages/Alerts.tsx`)

Refresh button (`aria-label`) re-running `loadNotifications`; server-events pull first when signed in only if a desktop equivalent of `syncServerNotifications` already exists — else local reload, no new sync infra. Failures use the existing error box + Retry. Test: Refresh re-calls the loader from stale state.

## Non-goals

- Settings tag UI; new sync infrastructure; undo for deletes (prior bundle); tab-count changes beyond the alerts tab; any visual redesign.
