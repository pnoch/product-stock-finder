# Background Price-Check Refactor — Design Spec

**Date:** 2026-08-25
**Goal:** Break `lib/background-price-check.ts` (430 lines) into a thin barrel at the same path backed by a `lib/background-tasks/` directory of focused modules, preserving the public API and behavior byte-for-byte.

## Current State

One module handles four concerns:

- Shared singletons: `healthService = createHealthService(AsyncStorage)`, `breakerStore = createStorageBreakerStore(AsyncStorage)`
- Health collector: `createHealthCollector` — batches per-scrape health updates; flush merges into service history, records samples, triggers `checkHealthAlerts`
- Listing refresh: `refreshListing` — server-first (`fetchServerPrice`) then local scrape fallback (`resilientFetch` + parser); records health outcomes; appends price points
- Core check: `runPriceCheckCore` — concurrency-3 batched scrape loop over watchlist, restock checks, digest scheduling, price-alert evaluation (fire + deactivate)
- Task plumbing: two module-level `TaskManager.defineTask` registrations (PRICE_CHECK_TASK, HEALTH_PROBE_TASK), register/unregister functions honoring settings.checkInterval, `syncBackgroundTasks`
- Health alerts: `checkHealthAlerts` — detectHealthAlert/Recovery over samples → local notification + server mirror upload
- Foreground entry: `checkPriceDropsNow`

Public API (9 exports): `PRICE_CHECK_TASK`, `HEALTH_PROBE_TASK`, `createHealthCollector`, `runPriceCheckCore`, `registerPriceCheckTask`, `registerHealthProbeTask`, `syncBackgroundTasks`, `checkHealthAlerts`, `checkPriceDropsNow`.

## Target Architecture

```
lib/background-price-check.ts   barrel re-export (~15 lines) — unchanged path

lib/background-tasks/
  instances.ts        healthService + breakerStore singletons (~10)
  health-collector.ts createHealthCollector (~40)
  refresh-listing.ts  refreshListing (~100)
  price-check.ts      runPriceCheckCore (~105)
  health-alerts.ts    checkHealthAlerts (~45)
  tasks.ts            defineTask ×2 (module-level) + register×2 +
                      syncBackgroundTasks (~90)
```

**Dependency flow (no cycles):**

```
instances ← {health-collector, refresh-listing, health-alerts, tasks}
health-alerts ← health-collector (flush calls checkHealthAlerts(service))
{health-collector, refresh-listing} ← price-check ← tasks
```

## Placement Decisions

- Singletons in one `instances.ts` so `createHealthService(AsyncStorage)` / breaker store are never duplicated and instance identity is preserved.
- `defineTask` calls stay at module-level global scope inside `tasks.ts`. The barrel re-exports from it, so any consumer import of `@/lib/background-price-check` still evaluates the definitions exactly as today.
- `checkPriceDropsNow` stays in the barrel (2 lines: runPriceCheckCore + syncServerNotifications) or moves to `price-check.ts` — implementer's choice based on import cleanliness; barrel must export it either way.
- Dynamic `import("./server-notifications")` calls inside checkHealthAlerts are preserved verbatim (lazy-load avoids web bundling issues).

## Public API Invariants

1. `@/lib/background-price-check` exports exactly the same 9 names.
2. Consumers unchanged (`app/_layout.tsx`, hooks, tests).
3. All function signatures and behavior identical — pure structural extraction.

## Testing

Existing background-task tests must pass unchanged (they exercise createHealthCollector, refreshListing paths via runPriceCheckCore, checkHealthAlerts). Full suite per task.

## Extraction Order (one commit each)

1. Scaffold `lib/background-tasks/`: instances.ts + health-collector.ts
2. refresh-listing.ts
3. price-check.ts
4. health-alerts.ts
5. tasks.ts + convert original file to barrel + todo.md + push

**Key metrics:** 430-line single file → 6 focused modules + 15-line barrel; public API unchanged.
