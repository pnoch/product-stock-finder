# Product Image Generation Design Spec

**Date:** 2026-08-13
**Phase:** 31 — Product Image Generation
**Status:** Approved (brainstorming)

## Overview

Expose the scaffolded image-generation module (`server/_core/imageGeneration.ts`) via a new tRPC endpoint that generates a product thumbnail for a catalog product, caches the resulting URL, and displays it on the watchlist, search, and product-detail screens on both mobile and desktop. The catalog currently has **0 products with an `imageUrl`**, so this fills a real gap.

This is the second scaffolded backend feature wired into a real endpoint (after LLM price insights in Phase 30). Generation happens on-demand (first request) plus a bounded background pre-generate pass in the warmer, so the whole catalog gets images over time.

## Goals

- Generate a product thumbnail for any catalog product via the scaffolded `generateImage` module.
- Cache the generated image URL (no TTL — images don't change) in a new Drizzle table with in-memory fallback.
- Public `images.get` endpoint (no auth), matching `prices.get` / `insights.get`.
- Background pre-generate fills the catalog over time.
- Display the thumbnail on watchlist, search, and product-detail screens on both mobile and desktop, with a placeholder fallback.

## Non-Goals (out of scope this phase)

- Voice transcription, Data API, or owner notifications — separate future phases.
- Uploading generated image bytes to file storage — the forge service already returns a hosted URL, so we persist that URL.
- Editing existing images (the `originalImages` option of `generateImage`) — only fresh generation from a product prompt.
- Client-side image generation — all generation happens server-side.

## Architecture

**Approach (chosen):** On-demand generation with a persistent URL cache (no TTL), public `images.get` endpoint, plus a bounded background pre-generate pass in the warmer.

```
Client (mobile/desktop)
   │  images.get(productId)          (public, no auth)
   ▼
server/routers.ts ──► server/product-images.ts
                        │
                        ├─► cache lookup (product_images table | memory Map)
                        │      present?  ──► return cached URL
                        │
                        └─► generateImage (server/_core/imageGeneration.ts)  →  URL
                              │
                              ▼
                        cache + return
```

## Data Model

### `product_images` table (new)

Keyed by `productId`. One row per product.

| Column | Type | Notes |
| --- | --- | --- |
| `productId` | varchar(128) | PK |
| `imageUrl` | text | not null — generated image URL |

Primary key on `productId`.

> **Deviation from a naive design:** `productId` (not `modelNumber`) is the key because the image is per-product and the app addresses products by `productId` (same rationale as `price_insights`).

## Server Components

### `server/product-images.ts` (new)

Image generation + cache, mirroring the `price-insights.ts` pattern (DB table with in-memory Map fallback when no `DATABASE_URL`).

- `getProductImage(productId)` — returns `{ imageUrl: string } | null`. Checks the cache; if present, returns it. Otherwise generates, caches, returns. **No TTL** (images don't change).
- `buildImagePrompt(product)` — derives a prompt from the product's name, brand, and category (e.g. "a MikroTik CRS804-4DDQ-hRM networking switch, product photo, clean background").
- `generateImageForProduct(productId)` — resolves the product via `PRODUCT_CATALOG`, calls `generateImage` from `server/_core/imageGeneration.ts` with the prompt, returns the URL. Throws on failure.
- `listProductsMissingImage()` — returns catalog product ids that have no cached image (used by the background pre-generate).
- `clearImagesForTests()` — clears the in-memory Map.

### `server/routers.ts` (modify)

- Add `images.get` public procedure — input `{ productId: string }`, returns `getProductImage(productId)`.

### `server/prices.ts` (modify) — background pre-generate

- Add `IMAGES_PER_TICK = 2`.
- Add `warmProductImages(count)` — calls `listProductsMissingImage()`, generates images for the first `count` missing products (via `generateImageForProduct`), returns the number generated.
- In the warmer tick, after `warmCatalogRotation`, call `void warmProductImages(IMAGES_PER_TICK)`.

## Mobile Components

### `lib/server-images.ts` (new)

- `fetchProductImage(productId)` — calls `images.get.query({ productId })`, 4s timeout via `Promise.race`, null on failure (mirrors `fetchPriceInsight`). Returns `{ imageUrl: string } | null`.

### App display (modify)

- **Watchlist card** (`app/(tabs)/watchlist.tsx`): render the product image (via `fetchProductImage`), falling back to the existing icon/placeholder when null.
- **Search results** (`app/search.tsx`): render the product image, falling back to a placeholder.
- **Product detail header** (`app/product/[id].tsx`): render the product image, falling back to a placeholder.

## Desktop Components (Rust)

### `desktop/src-tauri/src/lib.rs` (modify)

- Add `fetch_product_image(api_base_url, product_id)` command — GETs `images.get?input={json}`, parses `{ imageUrl }`, returns it (or null). Register in `generate_handler!`.
- Watchlist, search, and product-detail pages render the image (via the command), falling back to a placeholder.

## Data Flow

1. **View:** user opens watchlist/search/detail → app calls `images.get(productId)`.
2. **Cache check:** server returns the cached URL if present.
3. **Generate:** on miss, server builds a prompt from the product, calls `generateImage`, caches the URL, returns it.
4. **Display:** app renders the image; shows a placeholder on null/error.
5. **Background:** the warmer pre-generates images for missing products (2 per tick) so the catalog fills over time.

## Error Handling

- `generateImage` failure or missing product: `getProductImage` returns null → the app shows a placeholder. No crash.
- Product not in catalog: returns null.
- Server unreachable / timeout: `fetchProductImage` returns null → placeholder.
- No `DATABASE_URL`: cache lives in the in-memory Map; survives only for the server process lifetime.
- Background pre-generate failures: swallowed; the product stays "missing image" and is retried on a later tick.

## Config

- `IMAGES_PER_TICK = 2` in `server/prices.ts`. No env vars (the image module reads its own env via `server/_core/env.ts`).

## Testing

- **Server (`tests/product-images.test.ts`):** `getProductImage` generates and caches on first call; returns cached URL on second call without regenerating; returns null for unknown product; `generateImage` failure returns null; `listProductsMissingImage` returns only products without a cached image.
- **Router (`tests/images-router.test.ts`):** `images.get` returns the URL; works without auth; returns null on missing product.
- **Mobile (`tests/server-images.test.ts`):** `fetchProductImage` returns the URL, null on timeout/error.
- **Desktop:** cargo test for `fetch_product_image` parsing.

## Out of Scope

- Voice transcription, Data API, owner notifications.
- Uploading image bytes to file storage.
- Editing existing images.
- Client-side image generation.