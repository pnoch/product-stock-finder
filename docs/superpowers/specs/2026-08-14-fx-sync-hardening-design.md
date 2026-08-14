# FX + Sync Hardening Polish — Design (v3.17.1)

## Overview

A small hardening checkpoint that closes every open review follow-up from v3.16 (Sync Hardening) and v3.17 (Live FX Rates). Seven items total, split into two implementation tasks: FX hardening and sync polish. No new user-facing features — this is correctness, robustness, and UI polish work in existing modules.

**Feature target:** v3.17.1 (todo.md Phase 39)

## Scope

All seven items:

| #   | Area | Item                                                               |
| --- | ---- | ------------------------------------------------------------------ |
| 1   | FX   | `lib/storage.ts` `getFxRates` rate-value validation (NaN guard)    |
| 2   | FX   | Mobile single-flight dedup in `lib/fx.ts` (launch + Settings race) |
| 3   | Sync | `registerSyncSetup` teardown / cleanup                             |
| 4   | Sync | "Sync now" loading state in Settings                               |
| 5   | Sync | Success tone wired in Settings UI (currently dead)                 |
| 6   | Sync | `"Sync failed — Pull failed: …"` redundant label                   |
| 7   | Sync | Symmetric 129-char pull-guard router test                          |

## Non-goals

- No new features, no new currencies, no provider changes.
- No desktop (Rust) changes — same as v3.17.
- No shared-helper extraction between `server/fx.ts` `parseRates` and `lib/storage.ts` — keep the storage fix self-contained to avoid touching the just-reviewed server file.

## Item 1 — Storage rate-value validation

**File:** `lib/storage.ts`, `getFxRates` (lines 361-380)

**Problem:** the current guard checks only `!parsed.rates` (object truthy). A tampered payload such as `{ rates: { EUR: "abc" } }` passes through, and `setExchangeRates` injects the string into `convertPrice`, producing `NaN`.

**Fix:** filter `rates` entries to numeric, finite values only (mirror `server/fx.ts` `parseRates` semantics). Non-numeric entries are dropped; if no valid entries remain, return `null` (→ static fallback). `fetchedAt` handling unchanged.

```ts
const rates: Record<string, number> = {};
for (const [code, value] of Object.entries(
  parsed.rates as Record<string, unknown>,
)) {
  if (typeof value === "number" && Number.isFinite(value)) rates[code] = value;
}
if (Object.keys(rates).length === 0) return null;
return {
  rates,
  fetchedAt: typeof parsed.fetchedAt === "number" ? parsed.fetchedAt : 0,
};
```

**Rationale:** the persisted-payload boundary is the correct trust boundary. The server already validates at its boundary (`parseRates`).

## Item 2 — Mobile single-flight

**File:** `lib/fx.ts`, `refreshFxRates` (lines 35-45)

**Problem:** launch fires `maybeRefreshFxRates` and an immediate Settings visit fires another. With missing/stale stored rates, two identical `fx.get` calls race (two fetches, two persists).

**Fix:** module-level in-flight guard around the whole refresh operation (fetch + persist + apply), cleared in `finally`. Concurrent callers share one in-flight refresh.

```ts
let refreshInFlight: Promise<void> | null = null;

export function refreshFxRates(
  storage: Storage = defaultStorage,
): Promise<void> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const result = await fetchFxRates();
      if (!result || result.fetchedAt === null) return;
      await storage.saveFxRates({
        rates: result.rates,
        fetchedAt: result.fetchedAt,
      });
      setExchangeRates(result.rates);
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}
```

Notes:

- `maybeRefreshFxRates` calls `refreshFxRates`, so it inherits the guard.
- No test-only reset needed: every call site awaits the returned promise and the guard self-clears in `finally`.

## Item 3 — Sync setup teardown

**File:** `lib/sync.ts`, `registerSyncSetup` (lines 435-443); `app/_layout.tsx` (lines 189-198)

**Problem:** `registerSyncSetup` stores a module-level ref with no teardown; the `_layout.tsx` effect never unregisters.

**Fix:** `registerSyncSetup` returns a cleanup function that nulls the ref only if it still points to the same setup (so a stale cleanup can't clobber a newer registration):

```ts
export function registerSyncSetup(setup: SyncSetup | null): () => void {
  syncSetupRef = setup;
  return () => {
    if (syncSetupRef === setup) syncSetupRef = null;
  };
}
```

`_layout.tsx` effect captures the cleanup and returns it, also clearing `syncRef.current`:

```ts
useEffect(() => {
  const setup = setupSync({ ... });
  syncRef.current = setup;
  const unregister = registerSyncSetup(setup);
  return () => {
    unregister();
    syncRef.current = null;
  };
}, [trpcClient]);
```

## Item 4 — "Sync now" loading state

**File:** `app/(tabs)/settings.tsx`, `handleSyncNow` (lines 160-167) and the Sync now button (lines 402-420)

**Fix:**

- Add `const [syncing, setSyncing] = useState(false);`
- `handleSyncNow` sets `setSyncing(true)` before the await and `setSyncing(false)` in a `finally`.
- The button is `disabled={syncing}` while syncing and renders a small `ActivityIndicator` (`color={colors.primary}`) instead of the "Sync now" text.
- Add `ActivityIndicator` to the existing react-native import (settings.tsx lines 3-12).

## Item 5 — Success tone in Settings

**File:** `app/(tabs)/settings.tsx`, `descriptionColor` (lines 395-398)

**Problem:** `formatSyncStatus` returns a `success` tone for syncs under 5 minutes, but the UI only maps `error` → `colors.error`; `success` is rendered as default (muted) — the tone is dead in the UI.

**Fix:** map `success` → `colors.success` (keep `error` → `colors.error`, `muted` → `undefined`).

## Item 6 — Redundant "Sync failed —" label

**File:** `lib/sync.ts`, `formatSyncStatus` (lines 418-420)

**Problem:** `lastSyncError` values already carry an operation prefix (`"Pull failed: …"`, `"Push failed: …"`), so the current label renders `"Sync failed — Pull failed: …"`.

**Fix:** return the error string directly:

```ts
if (meta.lastSyncError) {
  return { label: meta.lastSyncError, tone: "error" };
}
```

**Test impact:** update the single assertion at `tests/sync-status.test.ts:34` from `"Sync failed — Pull failed: network down"` to `"Pull failed: network down"`.

## Item 7 — Symmetric pull-guard test

**File:** `tests/notifications-router.test.ts`

**Problem:** v3.16 added an oversized-deviceId rejection test for `uploadConfig` (line 141) but not for `pull`.

**Fix:** add a mirror test: `caller.notifications.pull({ deviceId: "x".repeat(129) })` rejects and `mockedPull` is not called.

## Testing

| File                                 | Change                                                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `tests/storage.test.ts`              | +2 tests: tampered rates payload — non-numeric value dropped, valid values kept; all-invalid payload → `null` |
| `tests/fx-client.test.ts`            | +1 test: two concurrent `refreshFxRates` calls → exactly one fetch (single-flight)                            |
| `tests/sync-status.test.ts`          | update line 34 assertion (Item 6) + add register/unregister teardown tests (Item 3)                           |
| `tests/notifications-router.test.ts` | +1 test: oversized deviceId for `pull` rejects (Item 7)                                                       |

No changes to `tests/currency.test.ts`, `tests/fx.test.ts`.

## Gates

- `pnpm check` — 0 TypeScript errors.
- `pnpm lint` — clean (only pre-existing `MODULE_TYPELESS_PACKAGE_JSON` warning).
- `pnpm test` — full suite green (v3.17 baseline is 474 tests / 71 files; expect +6 → 480).
- `pnpm exec prettier` — format all touched files.
- `todo.md` Phase 39 appended.
- Checkpoint commit: `Checkpoint: v3.17.1: FX + sync hardening — rate-value validation, fx single-flight, sync setup teardown, sync-now loading state, success tone, label dedup, pull-guard test. TypeScript: 0 errors.` + push.
