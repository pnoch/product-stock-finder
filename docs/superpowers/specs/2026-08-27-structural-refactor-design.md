# Structural Refactor — Optional Server Follow-up

Make the 700-line `product/[id].tsx` maintainable and add the missing top-level error resilience, while keeping the price-resolution seam explicit. No behavior changes, no new migrations.

## Decisions

* Split the product detail screen into a data hook + four focused components — the only file >500 lines after `sample-data`/`sync`.
* Add a single `AppErrorBoundary` around the navigation tree — the only place with zero `ErrorBoundary` coverage (grep found 0).
* Keep `price-source` as the sole foreground price entry point; `listing-discovery` only imports its `ResolvedPrice` type.

## File Structure

```
app/product/[id].tsx                716 → ~120 (orchestration)
hooks/use-product-detail.ts         NEW  ~180 (data hook)
components/product/detail-header.tsx     NEW  ~90
components/product/distributor-row.tsx   NEW  ~110
components/product/alert-section.tsx     NEW  ~140
components/product/reminder-section.tsx  NEW  ~90
components/app-error-boundary.tsx        NEW  ~60
lib/price-source.ts                 unchanged (sole foreground entry)
lib/storage/index.ts                comment-grouped re-exports only
```

`lib/distributors.ts` (452) and `lib/sync.ts` (525) stay as-is.

## Product Detail Decomposition

**`hooks/use-product-detail.ts`**

Inputs: `id` from `useLocalSearchParams`. Outputs: `{ product, listings, bestDeal, priceTrends, selected, setSelected, loading }`. Wraps `getWatchlist()` via `defaultStorage`, `getBestPrice`/`findBestDeal`, `filterByRange` memo, and `deriveListingQueries` → `resolvePrice`. No UI, fully testable with mocked storage/price-source.

**`components/product/detail-header.tsx`**

Props: `{ product: Product; bestDeal: BestDeal | null; region: string }`. Renders name/model/brand·category, `StockBadge(bestDeal)`, region chip via `getDistributorById`. Stateless.

**`components/product/distributor-row.tsx`**

Props: `{ listing: DistributorListing; product: Product; onWatchToggle }`. Derives `isWatched` from `product`/`stockWatches`, calls `addStockWatch`/`removeStockWatch` + `scheduleStockAlert`/`cancelNotification`. `React.memo` per row for 25-row lists.

**`components/product/alert-section.tsx` / `reminder-section.tsx`**

Props: `{ productId: string }`. Own form state (`price`, `currency`, `days`), validation, delegates to `lib/storage` + `lib/notifications`, surfaces `showAlert` on result. Parent only passes `productId` and handles `router.push` for compare / not-found guard.

Data flow: `app/product/[id].tsx` calls the hook and distributes its return values to the four components. No prop drilling beyond one level.

## Error Boundary

`components/app-error-boundary.tsx` (class component, ~60 lines):

* `getDerivedStateFromError` → `hasError`, `componentDidCatch` → `console.error` + `AsyncStorage.setItem("last_error")`.
* Fallback: centered `View` with `IconSymbol("exclamationmark.triangle")`, `Text("Something went wrong")`, truncated `error.message`, actions “Try Again” (`setState({hasError:false})`) and “Go Home” (`router.replace("/(tabs)")`).
* Registered in `app/_layout.tsx` around `<Stack>`, inside `SafeAreaProvider`. Also forwards `window` `unhandledrejection` to the boundary via `setState` in `_layout`'s first effect.

## Consolidation

* `lib/listing-discovery.ts`: `type FetchPrice = typeof resolvePrice` importing `ResolvedPrice` — makes the seam explicit without moving logic.
* `lib/storage/index.ts`: re-exports grouped by `// Watchlist` / `// Alerts` / `// Reminders` / `// Settings` / `// Meta` comment blocks. No runtime change. `lib/_core` hands-off guard reiterated in `AGENTS.md`.

## Testing

* Existing suites (`price-source`, `distributor-analysis`, `live-prices`, `scraping-integration`) unchanged.
* New: `hooks/use-product-detail.test.tsx` (mock `defaultStorage` + `resolvePrice`, assert loading → product/bestDeal/priceTrends), `components/app-error-boundary.test.tsx` (throwing child → fallback).

## Rollout

1. Commit 1: new hook + 4 components + boundary (no deletions).
2. Commit 2: rewrite `app/product/[id].tsx` to ~120-line orchestration, delete old inline code.
3. Commit 3: storage barrel grouping + `AGENTS.md` guard.
4. Each commit `pnpm check` + `pnpm test`; final `pnpm db:push` still **0014-0017** unchanged.
