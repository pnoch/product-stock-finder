# Manual Add with LLM-Assisted Cleanup — Design Spec

**Date:** 2026-09-01
**Goal:** Let users add any product to the watchlist by pasting free text (model number, name, or a spec-sheet paragraph); an LLM cleans it into the product template, the user reviews/edits, and distributor listings are auto-discovered via the existing scraping stack.

## Background

The watchlist is currently capped at the 17-item catalog. The scraping infra already searches by model number (`parser.buildSearchUrl` + server-side `getCachedPrice`), and `invokeLLM` (server/_core/llm.ts) supports structured output schemas — used by price insights. This feature wires those together.

**Critical gap verified:** the background scrape loop only refreshes *existing* listings; a product added with zero listings never gains any. Discovery must run at add time.

## Server: product-parse

`server/product-parse.ts`:
- `parseProductText(raw: string): Promise<ParsedProduct | null>` — builds a prompt instructing extraction of `{ name, modelNumber, brand, category, description }`; calls `invokeLLM` with a JSON output schema; validates/trims strings (name/modelNumber required, max lengths); returns null on any failure.
- `ParsedProduct = { name: string; modelNumber: string; brand: string; category: string; description: string }`.

Router addition (`server/routers.ts`):
```
products: {
  parse: publicProcedure
    .input(z.object({ raw: z.string().min(1).max(2000) }))
    .query(async ({ input }) => parseProductText(input.raw))
}
```
Returns `{ product: ParsedProduct | null }`. No caching (fresh parse per request); no DB writes.

## Client: listing discovery

`lib/listing-discovery.ts`:
```typescript
export async function discoverListings(
  modelNumber: string,
  onProgress?: (done: number, total: number) => void,
): Promise<DistributorListing[]>
```
- Iterates `getAllParserIds()` with concurrency 3.
- Per distributor: `fetchServerPrice(distributorId, modelNumber)`; a returned snapshot becomes a `DistributorListing`:
  `{ distributorId, price, currency, stockStatus, expectedDate, url, lastChecked: now, priceHistory: [point(now)] }`.
- Misses (null snapshot) skipped; errors swallowed per-distributor.
- Progress callback after each completes. Pure module (dependency-injectable for tests).

## Client: tRPC wrapper

`lib/server-product-parse.ts`: `parseProductText(raw)` → `trpc.products.parse.query({ raw })` returning `ParsedProduct | null` (null on network/server failure).

## UI: ManualAddSheet

`components/search/manual-add-sheet.tsx` — bottom sheet (TagPickerSheet conventions), two steps:

**Step 1 — Paste:** multiline TextInput (placeholder shows a messy example), pre-filled with the current search query when opened from search. Button "Clean up with AI" → loading state → calls `parseProductText`.
- Success → Step 2 with parsed fields.
- Failure (null) → Step 2 anyway, raw text as name, modelNumber empty — user fills manually. Show muted hint "Couldn't reach the AI — fill in manually."

**Step 2 — Review:** editable fields (name, model number, brand, category, description). Validation: name + modelNumber non-empty. Button "Add & Search Distributors":
1. `addToWatchlist({ id: custom-<slug(modelNumber)>, ...fields, isWatched: true, addedAt: now, listings: [] })`
2. `discoverListings(modelNumber, progress)` with inline progress ("Searching distributors 12/25…")
3. `updateProductListings(id, found)`
4. Summary alert: "Added — found prices at N distributors" (or "No distributors had it yet; we'll keep watching" when 0)
5. Close + `onAdded` callback (refresh search data).

Slug: lowercase modelNumber, non-alphanumerics → `-`, trimmed, deduped.

## Entry Point

Search screen header: new icon button (plus-square / wand icon — verify mapping) next to the bulk-import button, opening the sheet.

## Edge Cases

- Duplicate modelNumber → `addToWatchlist` already no-ops on existing id; sheet shows "Already tracked" alert before discovery.
- LLM unavailable (no API key server-side) → parse returns null → manual fallback path.
- Discovery finds 0 listings → product still added; future manual refresh can retry (existing refresh flows iterate listings, so 0-listing products stay inert — acceptable, communicated in the alert).
- Raw input > 2000 chars → truncated client-side before send.

## Testing

- `tests/listing-discovery.test.ts`: mocked `fetchServerPrice` — snapshot→listing mapping, misses skipped, progress totals, concurrency-independent ordering.
- `tests/product-slug.test.ts` (or fold into discovery test file): slug normalization cases.
- Server parse: unit-test the validation/trimming layer with a mocked `invokeLLM` boundary (no live LLM in tests).
- Full suite must pass.

## File Summary

| File | New/Modify |
|------|-----------|
| `server/product-parse.ts` | new (~90 lines) |
| `server/routers.ts` | modify (products.parse) |
| `lib/server-product-parse.ts` | new (~20 lines) |
| `lib/listing-discovery.ts` | new (~80 lines) |
| `tests/listing-discovery.test.ts` | new |
| `tests/product-parse.test.ts` | new |
| `components/search/manual-add-sheet.tsx` | new (~230 lines) |
| `app/search.tsx` | modify (header button + sheet) |
| `todo.md` | append Phase 85 |
