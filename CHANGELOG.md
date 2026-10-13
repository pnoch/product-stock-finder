# Changelog

Notable changes to Product Stock Finder. The version is kept in lockstep across
`package.json`, `app.config.ts`, `desktop/package.json`,
`desktop/src-tauri/tauri.conf.json` and `desktop/src-tauri/Cargo.toml`.

## [5.23.0] - 2026-10-13

### Added

- Connected Marketplaces (Phase 1149): a visible login browser for Facebook,
  Shopee TH, and Lazada TH; evidence-based connection status (ready, sign-in
  required, couldn't verify, unavailable) with timestamps; scoped disconnect
  that clears only the selected site and reports failures; shared Facebook
  search location and radius with observed-vs-requested scope; and search
  recovery that retries the retained query once after a verified reconnect.

### Changed

- Marketplace page extraction now binds each listing to its own card, so
  neighbouring listings cannot exchange titles, prices, or locations. A header
  login link is no longer treated as a login wall, and unreadable results are
  distinct from a verified empty result set.

## [5.22.0] - 2026-10-12

### Added

- Facebook Marketplace support (Phases 1147–1148): import item/share links
  (server resolves via a bounded headed render — identity only), track as
  manual-monitoring THB listings with title-change protection, on-device
  "Check price" when signed into Facebook in the app browser, and an inline
  "Facebook Marketplace (N)" section in Discover search results (session-gated,
  with distinct sign-in/empty/unavailable states). Facebook listings are
  excluded from all automatic pipelines and the global price cache.

## [5.21.0] - 2026-10-12

### Added

- Lazada Thailand marketplace support (Phase 1146), mirroring Shopee TH:
  short-link import with variant confirmation, `lazada-th` parser
  (plain-fetch first), on-device price checks with variant-matched upgrade
  to automatic monitoring, Rust port, and full pipeline exclusion for
  manual products. 32 distributors / 27 parsers.
- Shopee TH automatic price checks (Phase 1145): on-device "Check price
  now" with variant-matched flip to automatic, `shopee-th` parser
  (browser-first), login-wall handling via Site sessions, Rust port.

## [5.20.0] - 2026-10-12

### Changed (app redesign, Phases 1140–1143)

- New tab bar: Home · Discover · Watch · Drops · Alerts. Rates and Settings
  leave the tab bar (still reachable); Drops promoted from hidden route to tab.
- New Discover tab composing catalog search + Trending + Available Now, with
  inline track buttons.
- New You stack screen (profile + Statistics / Rates / Health / Diagnostics /
  Settings links), reached via the Home gear shortcut.
- Concierge onboarding replaces the carousel: hunt (catalog multi-select) →
  ship (country + tax) → notify (alert/stock/digest toggles) → done. Price
  alerts auto-activate on first prices via a pending queue fulfilled by every
  price check (foreground and background).
- Home is now a priority feed: greeting + urgency-ordered cards (alerts fired,
  big drops, restocks, all-quiet) + watchlist preview. Stat cards, recent
  activity, away card, and the old Available/Trending sections removed.
- Watch rows gain swipe actions (alert / acquired / remove); filters collapse
  into one bar with an active-count badge.
- Visual pass: 16px card radius, 56px touch targets, 28px screen titles on key
  screens.

## [5.19.0] - 2026-10-11

### Added

- Push delivery diagnostics: per-device delivery status screen (`/diagnostics`,
  reached from Settings → Notifications) with live "Send test push" and
  user-facing explanations for Expo errors. The server now checks Expo receipts
  ~15s after each send and persists the outcome per device (`pushDeliveryLog`
  table); new `pushStatusAll` query and rate-limited `sendTestPush` mutation.
  Full desktop parity.

## [5.18.0] - 2026-10-11

### Added

- Mark as acquired: flag products you've already bought (`Product.acquiredAt`,
  card + detail toggle, "Show acquired" filter, dimmed rows). Acquired products
  are excluded from price alerts, restock watches, basket stats, digests and
  server notification uploads. Full desktop parity (watchlist, detail, stats,
  home, Rust price-drop checker).
- Price drop leaderboard: biggest drops across tracked products (local) and all
  products (`prices.topDrops` server query over `priceHistory`). Home preview
  (top 5) + full `/drops` screen (top 20, Your/Global tabs, 24h/7d/30d windows,
  %/$ ranking, clipboard sharing). Full desktop parity (page, section, sidebar).

## [5.17.0] - 2026-10-04

### Added

- Desktop auto-update via `tauri-plugin-updater`, with a check/install control in
  Settings → About → Updates.
- GitHub Actions release workflow (`tauri-apps/tauri-action`) that builds, signs
  and publishes the desktop installers plus the `latest.json` updater manifest on
  a `v*` tag.
- DB-backed tests for the shared-watchlist router's authorization paths, and
  branch tests for `lib/csv.ts` and the app error boundary.

### Changed

- Desktop bundle split into vendor chunks with lazy per-route pages: the entry
  chunk dropped from 1,269 KB to 232 KB (gzip 366 KB → 65 KB) and the
  ">500 KB chunk" warning is gone.
- `pnpm build:apk` now runs the standard `./gradlew assembleRelease`; the manual
  rebundle/repack/re-sign workaround was removed.
- Replaced the `recharts` dependency with hand-rolled SVG charts.

### Fixed

- Desktop mirrored-file lost-update race: a single `STORE_FILE_LOCK` now
  serializes every READ-MODIFY-WRITE (watchlist/alerts/reminders/settings).
- Distributor cookie jar is written owner-only (`0600`).
- `parseWatchlistCsv` now actually skips a legacy `shareUrl,` header row.
- Removed dead diagnostic writes from the error boundaries.
- Fixed a flaky webhook-settings test.

### Security

- Share roster emails are returned only to the share owner.
- Updater downgrade hardening: `plugins.updater.requireSignedVersion`.
- `sharedWatchlists.inviteByEmail` no longer reveals whether an email has an
  account.
