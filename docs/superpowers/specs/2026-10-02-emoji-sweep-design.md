# Emoji Sweep (notification titles + flags) — Design Spec

**Date:** 2026-10-02
**Goal:** Remove the remaining user-visible emoji. The decorative-JSX sweep (category B) is already complete; what remains is (A) emoji in notification titles/bodies and (B) the `countryFlag` flag emoji shown across screens.

## Decisions (from brainstorming)

- **Notification titles:** strip the leading emoji (and the following space) from every title on mobile, desktop, and server; keep the words/punctuation. Bodies carry no emoji, so they are unchanged.
- **Flags:** replace the emoji values with ISO 3166-1 alpha-2 codes and rename the `countryFlag` field to `countryCode` across the type and every render site. Rendered as compact text.
- **Guards:** extend the existing emoji-sweep source guard to ban notification-title emoji on both platforms and the server, and ban regional-indicator emoji in `shared/`.
- **Out of scope:** flag assets/redesign, localization, notification body copy, the `↔` character in a comment.

## Part A — Notification titles

Remove the leading emoji + space from these title strings (keep the remainder verbatim):

| File | Titles (after) |
|------|----------------|
| `lib/notifications.ts` | `Back In Stock!`, `Distributor Blocked`/`Distributor Down`, `Distributor Recovered`, `Price Alert Set`, `Notifications Working!`, `Back-Order Reminder` |
| `lib/background-tasks/health-alerts.ts` | `Distributor Blocked`/`Distributor Down`, `Distributor Recovered` |
| `lib/background-tasks/price-check.ts` | `Basket Alert`, `Price Increase Alert!`/`Price Drop Alert!` |
| `lib/price-digest.ts` | `Price Digest` |
| `lib/restock.ts` | `Back In Stock!` |
| `desktop/src/lib/basket-alert.ts` | `Basket Alert` |
| `desktop/src/lib/health-probe.ts` | `Distributor Blocked`/`Distributor Down`, `Distributor Recovered` |
| `server/notifications/build-events.ts` | `Price Increase Alert!`/`Price Drop Alert!`, `Back In Stock!`, `Back-Order Reminder` |
| `server/notifications/digest.ts` | `Price Digest` |

Both platforms and the server must render identical title text (desktop mirrors mobile; server push/email use the same wording).

### Tests to update (they pin the old titles)

`tests/email-alerts-content.test.ts`, `tests/notifications.test.ts`, `tests/notifications-router.test.ts`, `tests/price-check.test.ts`, `tests/push-notifications.test.ts`, `tests/send-digest-notification.test.ts`, `tests/server-notifications.test.ts`, `tests/web-push-server.test.ts`.

### Guard

`tests/desktop-chart-guard.test.ts` already asserts a list of decorative emoji are absent across the sources. Extend that sweep to include the notification-title emoji (`🟢 🔴 🟠 📈 💸 📦 📊 💰 ✅ 🧺`), asserting they are absent from the mobile, desktop, **and server** source trees, so a future title cannot re-introduce one.

## Part B — `countryFlag` → `countryCode`

- **Type:** `lib/types.ts` `Distributor.countryFlag: string` → `countryCode: string` (and any other local declaration, e.g. `lib/watchlist-stats.ts`).
- **Data:** `shared/src/distributors.ts` — replace each flag emoji with its code:

| Country | Code | | Country | Code |
|---|---|---|---|---|
| Malaysia | `MY` | | United States | `US` |
| United Kingdom | `GB` | | Australia | `AU` |
| Poland | `PL` | | New Zealand | `NZ` |
| European Union | `EU` | | Czech Republic | `CZ` |
| Greece | `GR` | | Canada | `CA` |
| Germany | `DE` | | UAE | `AE` |
| South Africa | `ZA` | | | |

  `EU` is used for the "European Union" region entry (not an ISO country, but its standard two-letter code).

- **Render sites (82 references):** rename `countryFlag` → `countryCode` in `app/` (9), `components/` (13), `desktop/src/` (23), helper types in `lib/` (5), the server shim `server/routers/discovery.ts` (1), and the `shared/src/distributors.ts` data (30). Mobile app sites: `product/[id]`, `health`, `health/[id]`, `w/[token]`, `restock-watches`, `stats`, `distributor-analysis`, `(tabs)/alerts`; components: `product/*`, `best-distributor-card`, `alerts/*`, `stats/movers-card`, `settings/scraper-status-section`, `compare/*`; desktop: `pages/Compare`, `pages/DistributorAnalysis`, `pages/Settings`, `pages/Health`, `pages/RestockWatches`. TypeScript enforces completeness.
- **Fixture:** `tests/discovery-storage.test.ts` `countryFlag: "🇺🇸"` → `countryCode: "US"`.
- **Guard:** assert `countryFlag` no longer appears in `lib/`, `app/`, `components/`, `desktop/src/`, `shared/`, `server/`, and that no regional-indicator emoji remain in `shared/`.

## File Summary

| Area | Files |
|------|-------|
| Titles | `lib/notifications.ts`, `lib/background-tasks/health-alerts.ts`, `lib/background-tasks/price-check.ts`, `lib/price-digest.ts`, `lib/restock.ts`, `desktop/src/lib/basket-alert.ts`, `desktop/src/lib/health-probe.ts`, `server/notifications/build-events.ts`, `server/notifications/digest.ts` |
| Flags | `shared/src/distributors.ts`, `lib/types.ts`, `lib/watchlist-stats.ts`, `lib/price-share.ts`, `lib/watchlist-share.ts`, and the ~30 mobile/desktop render sites |
| Tests/guards | the eight title test files, `tests/discovery-storage.test.ts`, `tests/desktop-chart-guard.test.ts` |
