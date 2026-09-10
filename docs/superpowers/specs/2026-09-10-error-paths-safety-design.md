# Error Paths + Safety — Design Spec (2026-09-10)

Mirror-mobile bundle: six verified gaps where desktop (and one server path) fail silently or delete irreversibly. Every fix reuses a tested mobile pattern. No new infra, no new UX language.

## §A — Silent catches → visible errors

**Files:** `desktop/src/pages/Alerts.tsx:136,211,219`, `desktop/src/pages/Watchlist.tsx:673`, `desktop/src/App.tsx:180`, `server/db.ts:152-157`.

- Desktop catches get `showToast` failure copy + dev `console.error` (local, matching existing desktop convention — NOT a new shared logger; that belongs to the dedup bundle).
- Notification history/unread load failures reuse the page's existing reload function as a Retry affordance. Bulk-tag sheet failure toasts "Couldn't load tags".
- `Cmd+E` shortcut: `void exportWatchlistAsJson().catch(() => showToast("Export failed"))`, mirroring `Settings.tsx:474-490`.
- `deleteUserById`: replace nested silent catch with a server-side log line (existing server logger; exact import resolved in planning) and continue the user delete. Behavior unchanged, now observable.
- Tests: guard asserts toast/log on mocked failure; server test mocks `db.delete` failure and asserts log + continued deletion.

## §B — Delete confirmations

**Files:** `desktop/src/pages/Alerts.tsx:150-154,222-230`, `desktop/src/pages/RestockWatches.tsx:35-42`.

- `window.confirm("…? This cannot be undone.")` before alert / reminder / stock-watch deletes, exactly as desktop `Watchlist.tsx:521-529` does. Copy mirrors mobile (`hooks/use-alerts-data.ts`, `app/restock-watches.tsx`); alert/reminder/watch wordings stay distinct.
- No undo bar: alerts/reminders have no restore path, so confirm-before-delete (mobile parity) instead of building un-restore infra.
- Tests: mock `window.confirm` false → storage remove NOT called; true → called.

## §C — Discovery errors + verification resend

**Files:** `desktop/src/pages/Search.tsx:202-213`, `desktop/src/components/SearchModal.tsx:202-223`, `desktop/src/pages/Settings.tsx` Account (691-872).

- Both `handleDiscover` get `catch` blocks mirroring mobile `app/search.tsx:173-221`: `DiscoveryAuthError` → "Sign-in Required" + sign-in pointer; `DiscoveryError` by kind (timeout/network/server) → message + Retry button re-invoking discovery. Reuse the shared taxonomy mobile imports (exact path resolved in planning); no new error classes.
- Settings Account: Verified badge when `emailVerified`, else hint + Resend button wired to existing `use-auth.ts:180 resendVerification` (endpoint-tested, currently dead from UI). Copy mirrors mobile `account-section.tsx:47-275`, condensed to desktop settings-row styling.
- Tests: per-kind discovery error rendering with mocked throws; resend wiring with mocked hook.

## Non-goals

- Shared `lib/log.ts` logger, recent-searches/PillFilterRow/clipboard dedup → separate dedup bundle.
- Tab-count alignment, deal-sort persistence, tags pointer, notification-tab refresh → small-UX bundle.
- Undo/restore for deletes; new error classes; desktop error boundary.
