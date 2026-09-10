# Desktop Polish Bundle — Design Spec (2026-09-10)

Four mirror-mobile polish items on desktop, rendered with the desktop stack (recharts, lucide, Modal, tailwind). Locked decisions: per-distributor CSV is a file download (mobile-web parity); absolute timestamps retained as secondary text. Open choices (icon picks, util home, CSV import cleanliness) resolve in planning.

## §A — Per-distributor history modal

New `DistributorHistoryModal` on desktop `Modal` chrome: recharts line of the listing's `priceHistory` (same mapping as the best-listing chart), distributor-name title, **Download CSV** (`{productId}-{distributorId}-history.csv`, via `lib/csv priceHistoryToCsv` if import-clean else a local builder) + **Full comparison** link (existing `/compare/:id?distributor=`). Chart icon on rows with ≥2 points opens it in place (mobile `listing-card.tsx:161-172` parity). Tests: opens with listing data, CSV downloads, link target.

## §B — Notification icons + relative time

Per-type lucide icons + colors at `Alerts.tsx:387-399` mirroring mobile `TYPE_ICONS`/`healthColor`; tested `formatRelativeTime` desktop util ("Just now / 5m / 3h / 3d / date"); absolute time kept as secondary text. Tests: formatter units + per-type icon rows.

## §C — Home manual refresh

Header Refresh button (aria-label) sharing `handleRetry`'s load combination (`loadDashboard` + watchlist/alerts refresh, extracted not duplicated); existing `loadError` banner on failure; disabled/Refreshing state. Test: click re-calls loaders.

## §D — Insight loading state

`insightLoading` flag mirroring mobile `listing-section.tsx`; skeleton pulse in place of the card while in flight; loaded card and no-insight absence unchanged. Test: skeleton → card.

## Non-goals

- Chart library changes; new notification types; auto-refresh; insight content changes; mobile changes.
