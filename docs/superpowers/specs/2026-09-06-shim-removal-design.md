# Deprecated lib Shim Removal — Design

Date: 2026-09-06. Scope: delete 4 pure re-export shims, convert
currency/fx shims into documented live modules (approved: full scope).

## Finding

Six `lib/` files carry `// Deprecated: prefer @shared/*. Kept for one
release.` Four are pure re-exports with no own logic
(`distributors`, `catalog`, `trending`, `compare-utils`). Two cannot
move to shared: `lib/currency.ts` owns the mutable live-rate overlay
(`setExchangeRates`, live `convertPrice`/`getBestPrice`/
`hasExchangeRate`/`getExchangeRate`) and `lib/fx.ts` owns the
AsyncStorage persistence wrappers (`loadFxRates`, `refreshFxRates`,
`maybeRefreshFxRates`). Roughly 55 import sites reference the shims.

## Approach

Manual per-module repoint + delete (approved over a codemod script:
one-line path swaps, each eyeballed, `tsc` + guards verify).

## Pure shims

For `lib/distributors.ts`, `lib/catalog.ts`, `lib/trending.ts`,
`lib/compare-utils.ts`:

- Enumerate importers per module with `rg`.
- Rewrite path strings only, preserving import shape (single vs
  multi-line):
  - app/components/desktop/tests: `from "@/lib/X"` →
    `from "@shared/X"`.
  - server: `from "../lib/X"` → `from "../shared/src/X.js"`
    (matches the existing `../shared/const.js` convention).
  - lib-internal: `from "./X"` → `from "@shared/X"`.
- `git rm` the 4 shim files once their importer count is zero
  (verify with `rg` before deleting).

## Live modules

- `lib/currency.ts`: delete the deprecation header and the pure
  re-export lines (`CURRENCY_SYMBOLS`, `CURRENCIES`, `FX_TTL_MS`,
  `getCurrencySymbol`, `formatPrice`, `EXCHANGE_RATES`). Keep the live
  overlay + live functions. New header documents it as the live-rate
  layer over `@shared/currency`.
- `lib/fx.ts`: delete the deprecation header; keep the storage
  wrappers; header documents it as the persistence layer over
  `@shared/fx`.
- Stragglers: pure names still imported via `@/lib/currency`
  (`formatPrice` in `app/compare/[id].tsx`, `app/(tabs)/index.tsx`,
  `app/w/[token].tsx`, `components/best-distributor-card.tsx`) move to
  `@shared/currency`. Live-name imports (`convertPrice`,
  `getBestPrice`, `setExchangeRates`, `refreshFxRates`,
  `maybeRefreshFxRates`, `loadFxRates`) stay untouched.

## Testing

- New guard test (style of `tests/shared-desktop-criticals.test.ts`):
  asserts no source file imports `@/lib/{distributors,catalog,
  trending,compare-utils}` (or the `../lib/` / `./` equivalents) and
  that the 4 shim files no longer exist.
- Existing currency live-vs-pure guard still passes unchanged.
- Verification: `pnpm check` (0 errors), `pnpm lint` (no new
  warnings), `pnpm test` (full suite green), desktop `pnpm build`,
  `expo export -p web` (deletions touch bundler resolution on all
  three platforms).

## Non-goals

- No behavior or signature changes; no logic edits beyond import
  paths, headers, and the currency re-export removal.
- No live code moves into shared; mobile/desktop/server logic
  untouched.
