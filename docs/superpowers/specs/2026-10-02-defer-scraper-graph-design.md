# Defer the Scraper Graph from First Load — Design Spec

> **Status: WITHDRAWN (not implemented).** Investigation after writing this spec
> found the parser graph is also pulled at startup through the **health tree**:
> `lib/scrapers/health.ts` statically imports `PARSERS`, and `lib/notifications.ts`
> value-imports `HEALTH_ALERT_THRESHOLD` from it; `_layout.tsx` reaches health via
> `lib/background-price-check`. Deferring only the four modules below would **not**
> remove the parsers. A clean removal would also require deferring `scrapers/health`'s
> `PARSERS` import and breaking the notifications→health value import (extract the
> constant), plus the background-task singletons — ~6–7 modules. Given the framework
> dominates the ~1.06 MB gzip bundle and the parser share is an uncertain ~5–10%,
> the effort/risk was judged to outweigh the payoff. Retained for the findings.

**Date:** 2026-10-02
**Goal:** Remove the distributor-scraper graph (25 parsers + `resilient` + `cheerio` stub) from the initial web/mobile JS bundle by making the client's static imports into `lib/scrapers/**` lazy (dynamic `import()` at the point of use).

## Problem

The single web bundle is **4.12 MB raw / ~1.06 MB gzip** (`entry-*.js`). Framework (React/RN/expo-router/react-navigation/reanimated/gesture-handler) dominates and is unavoidable, but the **entire scraper graph ships on first paint** because several modules reachable from `app/_layout.tsx` statically import it:

| Module | Static import |
|--------|---------------|
| `lib/price-source.ts` | `./scrapers/registry` (`getParserByDistributorId`), `./scrapers/resilient` (`createMemoryBreakerStore`, `fetchAndParse`) |
| `lib/listing-discovery.ts` | `./scrapers/registry` (`getAllParserIds`) |
| `lib/background-tasks/refresh-listing.ts` | `../scrapers/registry`, `../scrapers/resilient` |
| `lib/background-tasks/instances.ts` | `../scrapers/resilient` (`createStorageBreakerStore`) |

`lib/price-source.ts` is the sole foreground price entry point; `_layout.tsx` imports `listing-discovery`/`manual-add` at module scope. Device scraping is an **on-demand fallback** (server-first), so the parsers do not need to be in the first-paint chunk.

**Feasibility (verified):** Metro web already code-splits dynamic `import()` — the current build emits a separate `breaker-clear` chunk.

## Design

Convert each static edge above into a dynamic `import()` inside the async function that actually uses it, so Metro emits the graph as an on-demand chunk. Keep types as `import type` (erased at build).

### 1. `lib/price-source.ts`
- Replace the two static imports with `import type { BreakerStore } from "@/lib/scrapers/resilient";` (type only).
- Lazy-init the breaker store: `let breakerStore: BreakerStore | null = null;` and `breakerStore ??= createMemoryBreakerStore();` after the dynamic import.
- In `scrapePriceOnDevice`, `const [{ getParserByDistributorId }, { createMemoryBreakerStore, fetchAndParse }] = await Promise.all([import("@/lib/scrapers/registry"), import("@/lib/scrapers/resilient")]);`.
- `isPlausiblePrice` / `ServerPriceResult` stay as-is.

### 2. `lib/listing-discovery.ts`
- Replace `import { getAllParserIds } from "./scrapers/registry"` with a dynamic import inside the function(s) that call it.
- `resolvePrice` from `./price-source` stays static (after §1, `price-source` no longer pulls the graph).

### 3. `lib/background-tasks/refresh-listing.ts` and `instances.ts`
- Dynamic-import the registry/resilient members where used (these are native background tasks; deferring also trims the mobile first-load bundle). Types stay `import type`.

### 4. Verify the entry graph is clear
- Rebuild (`pnpm build:web`, **no `--clear`**) and confirm the entry no longer contains parser markers (`data-product-price-without-tax`, `resilientFetch`), and that new chunk file(s) appeared and the entry shrank. Report the before/after gzip size.

## Testing

- Existing suites must stay green — `tests/scrape-price-on-device*`, `tests/listing-discovery*`, background-task tests, and the full root + desktop suites. The dynamic imports are inside already-async functions, so behavior is unchanged (same modules, loaded on first use).
- Add a **source guard** (`tests/scraper-graph-lazy.test.ts`): assert the four client modules contain no static `from "<...>scrapers/registry"` / `scrapers/resilient` import (only `import(` dynamic forms and `import type`), so a future edit cannot silently re-bundle the graph.
- The measurable acceptance is the entry delta from §4 (documented in the phase note, not asserted in a test).

## Out of scope

- Expo Router route-level `lazy` (`EXPO_ROUTER_IMPORT_MODE=lazy`): blocked — `expo export --clear` fails locally with a Babel/worklets version conflict.
- Lazy-loading chart/screen components (a separate, smaller lever).
- Fixing the `--clear` export build.
