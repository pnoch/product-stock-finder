# Design: v4.8 Cleanup — PII Logging, Version, Dead Code, Deps, Docs, Dedupe

Date: 2026-08-16
Status: Approved

## Problem

A codebase audit surfaced six cleanup items: PII leaking into production logs, stale version
metadata, dead code, unused dependencies with active native plugins, stale docs, and duplicated
price-check logic. None are features; all reduce quality/maintainability.

## Changes

### 1. PII logging (`hooks/use-auth.ts`, `app/oauth/callback.tsx`)

- Remove every `console.log` that emits user objects (id/openId/name/email), session-token
  prefixes, or full callback URLs.
- Add a module-local `debugLog(...args)` helper gated on `__DEV__` that logs only non-PII flow
  markers (e.g. `"[useAuth] fetchUser completed"`). No user data, no tokens, no URLs.
- Production builds emit zero auth-related logging.

### 2. Version consolidation

- `package.json` `version` → `"4.7.2"`.
- `app.config.ts` `version` → `"4.7.2"`.
- `app/(tabs)/settings.tsx` lines ~1477 and ~1520: replace hardcoded `1.0.0` / `v1.0.0` with the
  version read from `Constants.expoConfig?.version` (via `expo-constants`, already a dependency),
  falling back to `"dev"` when unavailable. Single source of truth = `app.config.ts`.

### 3. Dead code deletion

Delete only after re-verifying zero importers:

- `components/hello-wave.tsx`, `components/parallax-scroll-view.tsx`,
  `components/external-link.tsx`, `components/ui/collapsible.tsx`
- `constants/const.ts` (byte-for-byte duplicate of `shared/const.ts`)
- `desktop/src/lib/notifications.ts` (duplicate of `desktop/src/notifications.ts`)
- `app/dev/theme-lab.tsx` (orphan route, no navigation references)
- `getDistributorsByRegion` export in `lib/distributors.ts`
- `extractCurrency` + `extractExpectedDate` exports in `lib/scrapers/utils.ts`
- `storageGet` + `storageGetSignedUrl` exports in `server/storage.ts`

Do not touch `template.json` (it is the original template snapshot, not live code).

### 4. Unused dependencies

- Remove from `package.json` dependencies: `expo-audio`, `expo-video`, `expo-keep-awake`,
  `expo-image`, `expo-system-ui` (all confirmed 0 imports in code).
- Remove the `expo-audio` and `expo-video` plugin entries from `app.config.ts` (drops the
  microphone permission and PiP/background-playback config from native builds).
- Run `pnpm install` to update `pnpm-lock.yaml`.

### 5. Stale docs

- `design.md`: rename "Stock Tracker Pro" → "Product Stock Finder"; fix "50+ distributors" → 25.
- `todo.md`: rename header; fix Phase 4 "30+ distributors" → 25.
- `server/README.md`: rewrite to document the actual implemented backend — real routers
  (sync, prices, fx, insights, images, notifications, devices), `db.ts`, `sync-db.ts`, `prices.ts`
  (+ price-cache/history/insights/product-images), `fx.ts`, `notifications.ts`,
  `push-notifications.ts`, `devices.ts`, `catalog-warmer.ts`, env vars, and testing. Replace the
  template-era boilerplate (scaffold tables, `auth.logout` describe.skip, generic LLM/image
  recipes) with accurate content.

### 6. Dedupe `lib/background-price-check.ts`

- Extract the shared scrape+restock+digest+alert core (currently duplicated at lines ~179-269 in
  the TaskManager task and ~320-405 in `checkPriceDropsNow`) into one internal
  `runPriceCheckCore(opts: { onProgress?: (current: number, total: number) => void })`.
- The TaskManager task calls `runPriceCheckCore()` and maps completion to
  `BackgroundTask.BackgroundTaskResult.Success` / `Failed`.
- `checkPriceDropsNow(onProgress)` calls `runPriceCheckCore({ onProgress })` then
  `syncServerNotifications()`.
- Behavior is unchanged: same CONCURRENCY batching, 2s inter-scrape delay, `refreshListing`,
  `checkRestocks`, digest, and alert-fire logic (including the re-read + `deactivateAlert`
  duplicate-fire guard). The foreground's local `alert.isActive/triggeredAt/triggeredPrice`
  mutations are dropped (dead writes — `deactivateAlert` persists the state).
- `tests/price-check.test.ts` must stay green.

## Scope Exclusions

- No feature work; no schema/migration changes; no `_core/` edits.
- `template.json` untouched.
- `desktop/` behavior unchanged (only the dead `desktop/src/lib/notifications.ts` file is deleted).

## Verification

- `pnpm check` — 0 TypeScript errors
- `pnpm lint` — clean
- `pnpm test` — full suite green (633 passed / 9 skipped baseline)
- `pnpm install` succeeds after dependency removal
- One checkpoint commit: `Checkpoint: v4.8: Cleanup (PII logging, version, dead code, deps, docs, price-check dedupe). TypeScript: 0 errors.`