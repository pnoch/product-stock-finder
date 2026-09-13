# Handover — Product Stock Finder

**Date:** 2026-09-13 (continued — open items worked, see §7)
**Branch:** `main` @ `da1f64d` (in sync with `origin/main` — 8 commits pushed this session)
**Version:** `5.16.0` (root `package.json`, `app.config.ts`, `desktop/package.json` in lockstep)
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
| `pnpm test` (root) | 257 passed / 1 skipped files, 1682 passed / 10 skipped tests |
| `pnpm test` (desktop) | 42 passed files, 217 passed tests |
| `pnpm db:push` | "No schema changes, nothing to migrate" + applied |
| Prod API | `GET https://app-production-263c.up.railway.app/api/health` → 200 `{ok:true}` |

Feature backlog is empty: `todo.md` runs through **Phase 201**, all `[x]`.

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
3. **Release tagging stalled at `v5.5.2`.** `5.16.0` is bumped in the manifests but untagged.
   Decide policy (catch-up tag vs. abandon) before tagging.
4. **Real-device QA not done** (cannot be verified headless):
   - Tauri tray-click deep-links.
   - Web push over HTTPS (needs a real browser + push service).
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
- Remaining for a human: CI billing (§5.2), release tag policy (§5.3),
  real-device QA (§5.4), secrets review (§5.6).

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
