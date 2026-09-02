# Desktop Parity — Shared Package (Approach C) — Design

**Date:** 2026-09-03
**Status:** Draft — awaiting review
**Approach:** C — Extract `shared/` package (chosen over A shared-lib wrappers, B duplicate logic)
**Scope:** Full desktop parity (Rates tab, Search Bulk/Recent/Fuse, Watchlist bulk/tag, Product per-row actions, Alerts NotificationCenter, Stats/Health, Settings LLM/Scraper, Build — ~4 hours)

## 1. Goal

Bring `desktop/` to full parity with `app/` by moving the 6 pure logic modules out of `lib/` into a platform-agnostic `shared/` package consumed by both `app/` and `desktop/`. Single source of truth for catalog/distributors/currency/FX/trending/compare; `lib/` becomes the RN shell (storage/sync/notifications/background).

## 2. Non-Goals

- No storage/sync/notification extraction (RN-specific, stays in `lib/`).
- No catalog-warmer or price-cache move (server-side, stays in `server/`).
- No `lib/price-history.ts` or `lib/tags.ts` extraction this sprint (Phase 2 candidates if proven pure).

## 3. Package Layout

```
shared/                 ← platform-agnostic (no RN, no Tauri)
  package.json          { name: "@product/shared", type: module }
  tsconfig.json         extends root, outDir dist/
  src/
    catalog.ts          (from lib/catalog.ts)
    distributors.ts     (from lib/distributors.ts)
    currency.ts         (pure: CURRENCY_SYMBOLS, convertPrice, formatPrice)
    fx.ts               (pure rate fetch, no AsyncStorage write)
    trending.ts         (pure fetch, no RN)
    compare-utils.ts    (from lib/compare-utils.ts)
    price-history.ts    (window slicing, no UI — Phase 2)
    types.ts            (Product, DistributorListing — no RN types)
  _core/                ← untouched per AGENTS.md (framework)
```

`lib/` stays as RN shell: `storage/*`, `sync.ts`, `notifications.ts`, `background-tasks/*`, `live-prices.ts` (re-exports), `server-prices.ts`, `server-insights.ts`.

`desktop/src/lib/async-storage-stub.ts` and `react-native-stub.ts` remain until `lib/` is fully de-RN'd (follow-up).

## 4. Modules to Move (Phase 1)

| From | To | Notes |
|------|----|-------|
| `lib/catalog.ts` | `shared/src/catalog.ts` | Fuse search, PRODUCT_CATALOG (42 products), getAllCategories/getAllBrands |
| `lib/distributors.ts` | `shared/src/distributors.ts` | DISTRIBUTORS (25), getDistributorById, getAllDistributors |
| `lib/currency.ts` | `shared/src/currency.ts` | CURRENCY_SYMBOLS, convertPrice, formatPrice — drop setExchangeRates side-effect |
| `lib/fx.ts` (pure) | `shared/src/fx.ts` | refreshFxRates without storage write |
| `lib/trending.ts` | `shared/src/trending.ts` | Pure trending fetch |
| `lib/compare-utils.ts` | `shared/src/compare-utils.ts` | Chart helpers |

Thin wrappers left in `lib/` (deprecated, one release):
`lib/catalog.ts` → `export * from "@shared/catalog"`
`lib/currency.ts` → re-export + `setExchangeRates` writes to storage
`lib/fx.ts` → `import { refreshFxRates as sharedRefresh } from "@shared/fx"` + AsyncStorage write

## 5. Import Rewiring

`tsconfig.json` adds `paths: { "@shared/*": ["shared/src/*"] }` (already present for `shared/_core`). No metro change — `lib/` re-exports keep old `@/lib/catalog` working.

`desktop/vite.config.ts` drops the 4 bespoke aliases (`@/lib`, `@/constants`, `@/server`, `@/shared` → root) added in `1d613e1`; replaced by single `@shared` alias. RN/expo/playwright stubs remain.

`app/` and `desktop/src/pages/*` rewire imports: `../lib/catalog` → `@shared/catalog` (or keep via `lib/` shim for one release).

## 6. Build

No new build step: `shared/` is transpiled by `tsc --noEmit` like `lib/` today; both `app/` and `desktop/` consume it as source. Optional future: `shared/package.json` `exports` + `tsc -b` for explicit dist.

`pnpm check` (root `tsc --noEmit`), `pnpm --filter desktop run check`, `pnpm build` (desktop vite 3s), `pnpm exec expo export -p web --clear` all verify both consumers.

## 7. Testing

Tests move with modules: `tests/catalog-search.test.ts` → `shared/src/catalog.test.ts` or keep in `tests/` but import from `@shared/catalog`. `desktop` vitest isolates `desktop/src`; `shared/src` gets its own `vitest.config.ts`.

CI runs three suites:
- `pnpm test` (root, Expo)
- `pnpm --filter shared test` (shared pure)
- `pnpm --filter desktop test` (desktop, 36 tests)

Desktop Rates page (`desktop/src/pages/Rates.tsx` + route + sidebar) and Search parity (Fuse + Manual/Bulk sheets + Recent) are verified by `pnpm --filter desktop exec tsc --noEmit` + `desktop/dist/index.html` containing `Rates`.

## 8. Rollout

Phase 1 (this sprint): move the 6 modules, keep `lib/*.ts` shims, rewire `desktop/src/pages/*`, delete the 4 vite aliases. No catalog-warmer or storage changes.

Phase 2 (next): extract `lib/price-history.ts`, `lib/tags.ts` if proven pure.

## 9. Risks

- Alias churn during migration — mitigated by shim layer (old `@/lib/catalog` still works).
- `theme.config.js` CJS import in `lib/_core/theme.ts` — shared build handles via esbuild interop (already fixed for `CHART_COLORS` inline in `2e13971`).
- Stale `dist/` if shared dist added — avoided by source consumption.

## 10. Open Questions

- Should `shared/` export `PRODUCT_CATALOG` directly or via a `getCatalog()` lazy loader? Direct export matches current `lib/catalog.ts` shape; keep as-is.
