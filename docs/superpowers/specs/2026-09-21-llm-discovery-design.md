# LLM-Powered Product + Retailer Discovery

**Date:** 2026-09-21
**Status:** Approved

## Problem

The product catalog is static (18 networking products) and the distributor list is fixed (25 electronics distributors). Users who want to track non-networking products or buy from general retailers (Amazon, Best Buy, etc.) have no way to do so without the Manual Add flow, which requires knowing exact product details and retailer URLs.

## Solution

When a user searches for a product not in the catalog, offer a "Discover with AI" option that uses an LLM to generate product information and suggest retailers. The discovered product and retailers are stored locally and available for price tracking.

## Flow

1. User searches for "Sony WH-1000XM5"
2. Fuse.js returns empty results
3. App shows: "Not found — discover with AI?" button below empty state
4. User taps button → loading state → app calls `POST /api/discovery` with the query
5. Server calls LLM with a structured prompt, parses response
6. Returns: product info + suggested retailers
7. App adds product to local catalog (AsyncStorage)
8. App adds retailers to distributor list (AsyncStorage)
9. User is taken to the new product's detail page
10. User can now set price alerts, track stock, compare prices at discovered retailers

## Changes

### New: `lib/llm-discovery.ts`

- `discoverProduct(query: string)` — calls server endpoint
- Returns `{ product: Product, retailers: Distributor[] }` or null on failure
- Stores discovered product in AsyncStorage under `discovered_products` key
- Stores discovered retailers in AsyncStorage under `discovered_distributors` key

### New: `lib/storage/discovery.ts`

- `getDiscoveredProducts()` / `saveDiscoveredProducts()` — CRUD for discovered products
- `getDiscoveredDistributors()` / `saveDiscoveredDistributors()` — CRUD for discovered retailers
- Discovered items are merged with static catalog/distributors at load time

### New: `server/routers/discovery.ts`

- `POST /api/discovery` — accepts `{ query: string }`, calls LLM, returns structured product + retailers
- LLM prompt asks for: product name, modelNumber, brand, category, description, and 2-4 common retailers with name, website, country, currency
- Uses same LLM infrastructure as `server/price-insights.ts`

### Modified: `app/search.tsx`

- When `tagFilteredResults.length === 0` and `query.trim().length > 0`, show "Discover with AI?" button
- Button calls `discoverProduct(query)`, adds results, navigates to product detail

### Modified: `desktop/src/components/SearchModal.tsx`

- Same "Discover with AI?" empty state behavior

### Modified: `lib/catalog.ts`

- `PRODUCT_CATALOG` remains static
- New `getAllCatalog()` function that merges static + discovered products
- `searchCatalog()` updated to search merged catalog

### Modified: `lib/distributors.ts`

- `DISTRIBUTORS` remains static
- New `getAllDistributors()` function that merges static + discovered retailers

## What stays the same

- Static catalog and distributor lists remain as defaults
- Fuse.js search, compare chart, price alerts — all untouched
- Server scraping infrastructure — discovered retailers get parsers on-demand or fall back to generic scraping

## Testing

- Unit tests for `discoverProduct()` mock response parsing
- Unit tests for storage merge logic (static + discovered)
- Integration test: empty search → discover → product appears in catalog
- `pnpm check` — 0 errors
- `pnpm lint` — 0 errors
- `pnpm test` — all pass
