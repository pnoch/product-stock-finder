# LLM Price Insights Design Spec

**Date:** 2026-08-12
**Phase:** 30 — LLM Price Insights
**Status:** Approved (brainstorming)

## Overview

Expose the scaffolded LLM module (`server/_core/llm.ts`) via a new tRPC endpoint that generates a natural-language buying recommendation for a product, based on its server-side price history, current snapshot, distributor context, and shipping/landed-cost estimates. The insight is generated on first view and cached with a 24h TTL. Both mobile and desktop product-detail screens display it.

This is the first of several scaffolded backend features (`server/_core/` has LLM, image generation, voice transcription, Data API, owner notifications — none wired into a router yet). This phase wires up the LLM module for a concrete, product-relevant use case.

## Goals

- Generate a short, factual, natural-language buying recommendation for a product (e.g. "price is down 12% over 30 days and is historically lowest in August — a good time to buy").
- Base the insight on real server-side data: price history (Phase 28), current snapshot, distributor names/regions, and landed-cost estimates (reusing `lib/best-deal.ts` `findBestDeal`).
- Cache generated insights with a 24h TTL so the LLM isn't called on every view.
- Public endpoint (no auth), matching `prices.get`.
- Display on both mobile and desktop product-detail screens.

## Non-Goals (out of scope this phase)

- A generic chat/completion endpoint — only the product-insight use case.
- Image generation, voice transcription, Data API, or owner notifications — separate future phases.
- Streaming LLM responses — the insight is a single short text.
- Client-side LLM calls — all LLM calls happen server-side.

## Architecture

**Approach (chosen):** On-demand generation with a 24h TTL cache, public `insights.get` endpoint, server-side LLM call.

```
Client (mobile/desktop)
   │  insights.get(productId)          (public, no auth)
   ▼
server/routers.ts ──► server/price-insights.ts
                        │
                        ├─► cache lookup (price_insights table | memory Map)
                        │      fresh (<24h)?  ──► return cached insight
                        │
                        └─► build context (history + snapshot + distributors + landed cost)
                              │
                              ▼
                        invokeLLM (server/_core/llm.ts)  →  text
                              │
                              ▼
                        cache + return
```

## Data Model

### `price_insights` table (new)

Keyed by `productId`. One row per product.

| Column | Type | Notes |
| --- | --- | --- |
| `productId` | varchar(128) | PK |
| `insight` | text | not null — generated recommendation |
| `generatedAt` | bigint | not null — epoch ms, used for TTL |

Primary key on `productId`.

> **Deviation from a naive design:** `productId` (not `modelNumber`) is the key because the insight is per-product (aggregating all its listings), and the app addresses products by `productId`.

## Server Components

### `server/price-insights.ts` (new)

Insight generation + cache, mirroring the `price-cache.ts` / `price-history.ts` pattern (DB table with in-memory Map fallback when no `DATABASE_URL`).

- `getInsight(productId, opts?)` — returns `{ insight: string, generatedAt: number } | null`. Checks the cache; if fresh (< `INSIGHT_TTL_MS`), returns it. Otherwise generates, caches, returns.
- `buildInsightContext(productId)` — assembles the compact context payload for the LLM. **The server has no watchlist** (listings live in the app's AsyncStorage), so it reconstructs per-distributor data from server-side history + snapshots:
  - Resolve `productId` → `modelNumber` via `PRODUCT_CATALOG` (from `lib/catalog.ts`). If not found, return null.
  - For each distributor with a parser (`getParserByDistributorId`), fetch its history via `getHistory(distributorId, modelNumber)` (Phase 28) and its current snapshot via `getCachedPrice`. Build a synthetic `DistributorListing` per distributor from the latest history point + snapshot (price, currency, stockStatus, distributorId, productId).
  - Compute the best/cheapest in-stock listing via `findBestDeal` (from `lib/best-deal.ts`, using the synthetic listings, a destination region, and a display currency — e.g. USD).
  - Summarize the price trend from history: min/max, first/last price, % change over the window.
  - Include distributor names/regions (via `getDistributorById`) for the top listings.
- `generateInsight(context)` — calls `invokeLLM` from `server/_core/llm.ts` with a system prompt asking for a short (1-3 sentence), factual buying recommendation. Returns the text. Throws on LLM failure.
- `clearInsightsForTests()` — clears the in-memory Map.

Constants: `INSIGHT_TTL_MS = 24 * 60 * 60 * 1000` (24h).

### `server/routers.ts` (modify)

- Add `insights.get` public procedure — input `{ productId: string }`, returns `getInsight(productId)`.

## Mobile Components

### `lib/server-insights.ts` (new)

- `fetchPriceInsight(productId)` — calls `insights.get.query({ productId })`, 4s timeout via `Promise.race`, null on failure (mirrors `fetchServerPrice`). Returns `{ insight: string, generatedAt: number } | null`.

### `app/product/[id].tsx` (modify)

- On load, fetch the insight via `fetchPriceInsight(id)`. Display it in a card with a subtle "AI insight" label. Hide the card gracefully on null/error (no blocking, no error state).

## Desktop Components (Rust)

### `desktop/src-tauri/src/lib.rs` (modify)

- Add `fetch_price_insight(app, product_id)` command — GETs `insights.get?input={json}`, parses `{ insight, generatedAt }`, returns it (or null). Register in `generate_handler!`.
- Product detail page (`desktop/src/pages/ProductDetail.tsx`) fetches and displays the insight card.

## Data Flow

1. **View:** user opens product detail → app calls `insights.get(productId)`.
2. **Cache check:** server returns cached insight if fresh (< 24h).
3. **Generate:** on miss/expiry, server builds context (history + snapshot + distributors + landed cost), calls `invokeLLM`, caches the result, returns it.
4. **Display:** app shows the insight card; hides it on null/error.

## Error Handling

- LLM failure or missing history: `getInsight` returns null (or the router returns null) — the app hides the insight card. No crash.
- Product not in catalog / no history: `buildInsightContext` returns null → `getInsight` returns null.
- Server unreachable / timeout: `fetchPriceInsight` returns null → card hidden.
- No `DATABASE_URL`: insight cache lives in the in-memory Map; survives only for the server process lifetime.
- TTL: expired insights are regenerated on next view (not pre-emptively).

## Config

- `INSIGHT_TTL_MS = 24h` in `server/price-insights.ts`. No env vars (the LLM module already reads its own env config via `server/_core/env.ts`).

## Testing

- **Server (`tests/price-insights.test.ts`):** `buildInsightContext` builds context from history + catalog; `getInsight` returns cached fresh insight without calling the LLM; expired insight regenerates; LLM failure returns null; `clearInsightsForTests` resets.
- **Router (`tests/prices-router.test.ts` or new `tests/insights-router.test.ts`):** `insights.get` returns the insight; works without auth; returns null on missing product.
- **Mobile (`tests/server-insights.test.ts`):** `fetchPriceInsight` returns the insight, null on timeout/error.
- **Desktop:** cargo test for `fetch_price_insight` parsing.

## Out of Scope

- Generic chat/completion endpoint.
- Image generation, voice transcription, Data API, owner notifications.
- Streaming LLM responses.
- Client-side LLM calls.