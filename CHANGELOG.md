# Changelog

Notable changes to Product Stock Finder. The version is kept in lockstep across
`package.json`, `app.config.ts`, `desktop/package.json`,
`desktop/src-tauri/tauri.conf.json` and `desktop/src-tauri/Cargo.toml`.

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
