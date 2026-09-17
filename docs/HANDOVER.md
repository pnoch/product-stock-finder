# Handover — Product Stock Finder

**Date:** 2026-09-13 (continued — Phases 202-205, see §7)
**Branch:** `main` @ `c1e0478` (`v5.16.0` tagged) in sync with `origin/main`
**Version:** `5.16.0` (root `package.json`, `app.config.ts`, `desktop/package.json`, `tauri.conf.json`/`Cargo.toml` in lockstep)
**Repo state:** clean working tree

Read `AGENTS.md` first — it is the canonical project guide. This file is a session-to-session
continuation note, not a replacement.

---

## 1. Current health

| Check | Result |
| --- | --- |
| `pnpm check` (root tsc) | 0 errors |
| `pnpm check:desktop` | 0 errors |
| `pnpm lint` | clean |
| `pnpm test` (root) | 262 passed / 1 skipped files, 1702 passed / 10 skipped tests |
| `pnpm test` (desktop) | 43 passed files, 218 passed tests (flake fixed) |
| `pnpm --dir desktop build` | ok (454k gzip) |
| `cargo check` (tauri) | ok |
| `pnpm db:push` | "No schema changes, nothing to migrate" |
| Prod API | `GET https://app-production-263c.up.railway.app/api/health` → 200 (live on Phases 206-207) |

`todo.md` through **Phase 207**, all `[x]`. `v5.16.0` tagged (was stalled at `v5.5.2`).

---

## 2. What this session did (Phases 197–201)

- **197 — v5.16 hygiene:** renamed root package `app-template` → `product-stock-finder`,
  bumped all three manifests to `5.16.0`, fixed `AGENTS.md` drift (`lib/storage/` dir,
  `desktop/` + `server/notifications/` + `server/routers/` sections, 20 drizzle tables,
  test counts, `product/[id].tsx` size).
- **198 — Desktop check green:** removed unused `TRPCError` import in `server/sync-db.ts`;
  added missing `digest: BarChart3` to `desktop/src/pages/Alerts.tsx` `TYPE_ICONS`.
- **199 — Desktop Settings test harness:** `a494438` added `SharedLinksList`
  (`trpc.sharedWatchlists.list.useQuery`) to `desktop/src/pages/Settings.tsx` without a
  test mock. Stubbed `../src/lib/trpc` in `settings-webtoggle`, `settings-push`, and
  `error-paths-safety` desktop tests (10 failures, not the 2 originally flagged).
- **200 — Railway provision:** new Railway project `product-stock-finder` + `MySQL-NtCC`
  + `app`; `0023_quiet_hours` applied.
- **201 — Prod env + TCP proxy + drizzle repair:** rotated `JWT_SECRET`, set `VAPID_*`
  and `EXPO_PUBLIC_*`; created MySQL TCP proxy; fixed a broken drizzle snapshot chain
  (see §4).

---

## 3. Railway production (project `product-stock-finder`)

Project ID `4bea2d05-d118-4b7c-8fe6-945465e3224d`, environment `production`
`6914cd0e-1454-4796-a422-c5fa86ea68a3`.

| Service | ID | Notes |
| --- | --- | --- |
| `app` | `787ca1c9-035f-4ddf-b763-6c7f7cf2145b` | node:20-alpine, Nixpacks, `pnpm build` → `dist/index.js`; public `https://app-production-263c.up.railway.app` |
| `MySQL-NtCC` | `16b00d4a-71c2-4364-9ab8-c89334746da5` | the real DB; TCP proxy `switchyard.proxy.rlwy.net:58169` → internal 3306 |

`app` env vars set: `DATABASE_URL=${{MySQL-NtCC.MYSQL_URL}}`, `JWT_SECRET` (32-byte hex),
`VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `EXPO_PUBLIC_VAPID_PUBLIC_KEY`,
`EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_WEB_URL` (both the Railway URL).

Local `.env` `DATABASE_URL` points at the TCP proxy (git-ignored). Migrations can be run
locally (`pnpm db:push`) or in-container (`railway ssh --service app -- npx drizzle-kit migrate`).

### ⚠️ Orphaned services — clean up

~~Three accidental MySQL services were created by the failed `railway add --database mysql`
attempts and are **still running** (wasting resources):~~ **DELETED 2026-09-13** via
GraphQL `serviceDelete` (all returned `true`; project now holds only `app` + `MySQL-NtCC`,
prod `/api/health` still 200 afterwards):

- ~~`MySQL` — `59be744a-2d12-40dc-9a2f-d83eaab69d6c`~~
- ~~`MySQL-oXpb` — `a88e8142-e3f4-4df2-88d7-b7976c5db67d`~~
- ~~`MySQL-Qy70` — `f89eeb72-4a9e-484f-8056-4eea3b0ac055`~~

~~Delete these in the Railway dashboard (or GraphQL `serviceDelete`). Only `MySQL-NtCC` is in use.~~

---

## 4. Drizzle snapshot chain — fixed, understand before adding migrations

`0023_quiet_hours` was hand-written in `b09ae3e` **without** committing
`drizzle/meta/0023_snapshot.json`. That broke the snapshot chain: `drizzle-kit generate`
diffed from `0022`, saw `quietHours` missing, and emitted a duplicate
`0024_swift_kate_bishop.sql` (`ADD quietHours` → `ER_DUP_FIELDNAME` on `pnpm db:push`).

Fix in `e71cbc8`: promoted the generated snapshot to `drizzle/meta/0023_snapshot.json`
(verified its only diff from `0022` is the `quietHours` json column and `prevId` chains to
`0022`), removed the `0024` SQL + journal entry.

**Rule going forward:** when adding a migration by hand, also commit its
`drizzle/meta/NNNN_snapshot.json` and the `_journal.json` entry. Verify with
`npx drizzle-kit generate` → must print "No schema changes, nothing to migrate".

---

## 5. Open items (need a human)

1. ~~**Push the 7 unpushed commits.** `git push origin main` (nothing has been pushed this session).~~
   **DONE 2026-09-13** — pushed `b09ae3e..da1f64d` (8 commits incl. the handover note itself);
   `main` is now in sync with `origin/main`.
2. **CI is billing-blocked.** Every GitHub Actions run on `main` dies in ~3s with 0 steps:
   *"recent account payments have failed or your spending limit needs to be increased"*
   (annotation on run `34754705704`). Fix GitHub → Settings → Billing & plans, then re-run
   the failed workflows. Not a code problem.
   (Push just triggered a fresh run — it will hit the same billing wall until fixed.)
3. ~~**Release tagging stalled at `v5.5.2`.** `5.16.0` is bumped in the manifests but untagged.
   Decide policy (catch-up tag vs. abandon) before tagging.~~ **DONE 2026-09-13** — `v5.16.0` tagged at `c1e0478` after Phase 205 identifier fix.
4. **Real-device QA not done** (cannot be verified headless) — narrowed by static
   review 2026-09-13 (see §8). Unit/integration seams are already tested
   (`sw-notificationclick`, `desktop-sw-guard`, `web-push`, `notification-routing`,
   `server-notifications`); only the OS/browser integration points below need a device:
   - **Desktop tray:** left-click restores/focuses main window (`lib.rs:1431-44`);
     menu Open / Check Now / Quit. No close-to-tray (no `close_requested` handler).
   - **Desktop notification deep-link is Linux-only by design** (`lib.rs:105-141`):
     Linux click → `notification-activated` → `navigate(/product/:id)`; macOS/Windows
     drop the route, toast only focuses. Confirm this asymmetry is acceptable.
   - **Web push (real browser + HTTPS + push service):** subscribe in Settings →
     background/unfocused toast → click focuses window at `/` (no product deep-link:
     `sw.js` `notificationclick` opens `/`; server payload carries only eventId).
     Focused tab → no OS toast, foreground pull covers it (60s poll + focus tick,
     `web-push-shown` dedup via `displayed_event_ids`).
   - **Pre-QA fixes:** ~~(a) `desktop/src-tauri/tauri.conf.json` + `Cargo.toml` are
     stuck at `5.12.0` (bundle shows stale version; root + `desktop/package.json`
     are `5.16.0`; no sync script exists). (b) `public/sw.js` precache hashes are
     stale (`entry-7673a051`/`browser-1e07bb39` vs dist's `entry-d938f2ab`/
     `browser-9e2bcd96`) — `addAll` fails silently (caught), so offline cold start
     won't serve shell JS from precache. Decide: regenerate hashes per export or
     drop precache (runtime cache-first for `/_expo/static/` still works).~~
     **BOTH FIXED 2026-09-13 (Phase 202):** (a) tauri.conf + `Cargo.toml` +
     `Cargo.lock` bumped to `5.16.0` (`cargo metadata --offline` clean) +
     `tauri-version-lockstep` test guards the parity; (b) precache now stable URLs
     only (`/index.html`, `/manifest.json`, `/favicon.ico`), cache `precache-v3`,
     + `sw-precache` test (no hashed entries, every URL resolves).
5. ~~**Orphaned Railway MySQL services** — see §3.~~ **DONE 2026-09-13** — see §3.
6. **Prod secrets review.** `VAPID_*` were generated this session; confirm they are the
   intended long-term keys. `EXPO_PUBLIC_*` are baked at build time — re-run
   `expo export -p web --clear` after changing them.

---

## 7. Continuation session (2026-09-13)

- Pushed 8 commits to `origin/main` (`b09ae3e..da1f64d`); branch in sync.
- Re-verified: prod `GET /api/health` → 200 `{ok:true}`;
  `npx drizzle-kit generate` → "No schema changes, nothing to migrate" (snapshot chain still clean).
- Deleted the 3 orphaned MySQL services via GraphQL `serviceDelete`
  (token from `~/.railway/config.json`, `User-Agent: railway-cli/4.15.0` header required).
  Project now contains only `app` + `MySQL-NtCC`.
- Remaining for a human: CI billing — **deferred until after first-release dev** per your direction (so tag is local-first; no CI verification yet), real-device QA (§5.4 + §8), secrets review (§5.6).

---

## 9. First-release dev pass (2026-09-13, Phases 203-205)

Scope per your picks: **Desktop + Mobile stores + Web via Express**, stabilize desktop flake.

- **Phase 203 — desktop flake:** `ReferenceError: __DEV__ is not defined` at `lib/_core/auth.ts:6` via `lib/device-revoked.ts`; desktop `tests/setup.ts` relied on vite `define` which is worker-flaky for `../lib/*`. Fixed with `(globalThis).__DEV__ = true` + `setup-globals` guard; 10/10 green (43 files / 218 tests).
- **Phase 204 — EAS + web-via-Express:** added `eas.json` (dev/preview/production, `appVersionSource: remote`; `EXPO_PUBLIC_EXPO_PROJECT_ID` already wired, `eas project:init` still manual — needs Expo account + credentials). Web: `server/spa.ts` (`registerSpa` after `/api/*`, `dist-web/` via `pnpm build:web`, `no-store` for shell/SW, immutable for hashed bundles) + `tests/spa.test.ts` live-HTTP checks; smoke-verified `GET /`, `/product/[id]` SPA fallback, `/sw.js`, `/_expo/static/*`, `/api/health`, non-GET passthrough. `pnpm build` now chains `dist/` + `dist-web`; `dist-web/` git-ignored.
- **Phase 205 — desktop pre-release:** aligned `tauri.conf.json` identifier `com.app.stockfinder` → `com.app.stock_tracker_pro` (matches `app.config.ts` bundleId / AGENTS.md; pre-first-install so no migration); `cargo check` + `pnpm --dir desktop build` green; full Tauri bundle still manual (needs webkit + signing on release machine).

---

## 8. Device-QA prep — static review (2026-09-13, still current after Phases 203-205)

**Desktop tray + deep-link** (`desktop/src-tauri/src/lib.rs`, `desktop/src/notifications.ts`,
`desktop/src/App.tsx` `NotificationRouter`):
- Tray left-click (`Button::Left` + `Up`) → `show()` + `set_focus()` on `main` window.
  Menu: Open (same), Check Now (`run_full_price_check`), Quit (`app.exit(0)`).
- No `close_requested` prevention, no `hide()`, no single-instance or deep-link
  protocol plugin — closing the window quits; "deep-link" = notification-click route only.
- Route flow: `notification_route_for_product` → `/product/{id}` →
  `activation_payload({route})` → `notification-activated` event → `navigate(route)`
  (frontend guards `startsWith("/")`, falls back to `/`). Linux-only; other OSes drop it.
- Nothing here looks broken; QA is confirm-on-device, plus the 5.12.0→5.16.0 version bump.

**Web push** (`lib/web-push.ts`, `lib/web-notifications.ts`, `public/sw.js`,
`server/web-push.ts`, `server/push-notifications.ts`):
- Subscribe requires `EXPO_PUBLIC_VAPID_PUBLIC_KEY` baked at build time
  (Metro `--clear` needed after rotation) + `Notification.permission === "granted"`;
  untested-seam risk is only the real push service + HTTPS secure context.
- Server silently no-ops without `VAPID_*`; prunes subscription on 410/404. OK.
- SW `push`: skips `showNotification` when a window client is focused (foreground pull
  covers it); posts `web-push-shown` → `recordDisplayedEventId` dedup. Coherent.
- SW `notificationclick`: focus existing `/`-scope window else `openWindow("/")`.
  No product deep-link — document as expected behavior or extend payload with a route.
- `public/sw.js` stale precache hashes (see §5.4) — harmless at runtime (caught warn)
  but offline cold start is degraded until fixed. `desktop/public/sw.js` is a separate
  precache-free SW and is clean.

---

## 6. Quick reference

```bash
pnpm dev            # API server + Metro web
pnpm check          # root tsc --noEmit
pnpm check:desktop  # desktop tsc --noEmit (covers ../server — run it, root check does not)
pnpm lint
pnpm test
pnpm db:push        # drizzle-kit generate && migrate (uses .env DATABASE_URL)

railway status
railway variables --service app
railway ssh --service app -- npx drizzle-kit migrate
railway up --service app --ci
```

**Gotchas**

- `pnpm check` does **not** cover `desktop/`; always run `pnpm check:desktop` too.
- `railway add --database mysql` is interactive and silently created duplicates in a
  non-TTY shell — verify with `railway list --json` after adding services.
- Railway GraphQL (`backboard.railway.app/graphql/v2`) returns Cloudflare 403 without a
  `User-Agent` header; use `railway-cli/4.15.0`.
- The Railway MySQL internal host (`mysql-ntcc.railway.internal`) is not resolvable from
  this machine — use the TCP proxy for local work.

---

## 10. Production audit + Railway recovery (2026-09-14, Phases 206-207)

**Phase 206 — production audit fixes** (audit score 68 → ~86):
- IP spoofing: rate limits keyed on the spoofable leftmost `X-Forwarded-For`; now `req.ip` (trusted hop only) in `server/rate-limit.ts` + `server/_core/oauth.ts`
- Paid-endpoint spend guard: `server/spend-budget.ts` (per-process hourly caps, `SPEND_BUDGET_*` overrides) wired into `products.parse` / `insights.get` / `images.get`
- Email delivery: `server/email.ts` (Resend HTTP) + `RESEND_API_KEY`/`EMAIL_FROM`; reset + verification now send real links; new `app/verify-email.tsx`
- SPA fallback 404s unmatched `/api/*` + `/storage/*`; `purgeOldNotificationEvents` (30d) in the warmer; empty-`name` sessions no longer lock users out; prod binds `PORT` directly + exits 1 on bind failure

**Phase 207 — prod outage + fix:**
- Setting env vars triggered a redeploy; the `app` service source was a bare `node:20-alpine` image (`repo: null`), so deploys skipped the build (0 build logs, `duration: 0`) and crashed → 502. Rolled back to the last good image (prod restored), then reconnected the service to `pnoch/product-stock-finder@main` via GraphQL `serviceConnect`
- Reconnected build then failed at `expo export`: `Failed to get the SHA-1 for .../react-native-css-interop/.cache/web.css`. NativeWind `forceWriteFileSystem` writes `web.css` during transform, but Metro only hashes files from its initial crawl; on a clean install (no stale cache) the web export fails. Only surfaced now because Phase 204 added `expo export` to the Railway build
- Fix: `metro.config.js` pre-creates `.cache/web.css` + adds the dir to `watchFolders`; verified from a clean cache
- **Prod now live on Phases 206-207** (`f30d4074`, SUCCESS): `/api/health` 200, `/` SPA 200, deep link 200, `/sw.js` `no-store`, unmatched `/api/*` JSON 404, `POST /api/auth/forgot` → `{success:true}` with email sent

**Railway notes for next time:** the `app` service must stay connected to the GitHub repo (not an image). Deploys are triggered by `serviceInstanceDeployV2` or a push to `main`. `RESEND_API_KEY` is a send-only key (`restricted_api_key`) — it cannot list/create domains, so domain setup must be done in the Resend dashboard.

**Email domain (DONE 2026-09-17):** `productstockfinder.savvylife.icu` is verified in Resend and `EMAIL_FROM=no-reply@productstockfinder.savvylife.icu`. DNS (IONOS): `resend._domainkey` TXT (DKIM), `send` MX → `feedback-smtp.us-east-1.amazonses.com`, `send` TXT SPF; root MX left on IONOS. Verified end-to-end: `POST /api/auth/forgot` → 200 and a real send returns a Resend message id.

---

## 11. Whole-app review rounds (2026-09-15, Phases 215-217)

Three parallel-audit rounds (storage/sync, scrapers/pricing, UI, desktop, notifications, server data). Every high-severity finding was reproduced before fixing.

- **Phase 215** — web IDB migration (pre-IDB users lost all data), sync full-resync deleting live items after >30d offline, rejected-push retries, future-stamp wedge, winncom model-as-price, dot-thousands parsing, "not in stock", `getBestPrice` divergence, `modelMismatch` page-header decoy, alert −5% price, sort menu outside its Modal, CSV import FS API, digest routing, 8 unmapped icons, storage-read hangs, delete-data false success, uploadHistory cap drift, unbounded discovery/desktop-health buffers, `clearAllData` health keys
- **Phase 216** — settings per-field merge (was whole-row LWW), `appendPricePoint` ordering, breaker store cross-instance serialization, money rounding at the comparison boundary
- **Phase 217** — desktop: `withGlobalTauri` (all `__TAURI__` branches were dead), tray id, `fs:allow-write-file`, mirror all four storage keys to Rust files, `run_full_price_check` for Refresh, upload caps, sync registration, Compare hooks crash, devices proxy; notifications: restock false-fire, sign-out push unregister, push routing data + SW deep-link, quiet-hours UTC offset, basket threshold; server: tombstone purge scope, OAuth email/openId linking, uploadHistory date validation, `device_labels` cleanup, three indexes (migration `0024`, applied to prod); UI: drop-calendar DST, filter crash on missing metadata, sparkline currency mixing, CSV formula injection, health summary invalid dates

**Prod state:** deploy `588d8ba4` SUCCESS, `/api/health` 200, migration `0024` applied (verified the three indexes exist).
