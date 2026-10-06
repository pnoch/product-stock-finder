# Neobits + MBS I-WAV Search-URL Fixes — Design Spec

**Date:** 2026-10-05
**Goal:** Make Neobits and MBS I-WAV return prices by correcting their search URLs to the parameters their storefronts actually use.

## Problem

Phase 1102 documented Neobits and MBS I-WAV as "JS-driven with no usable search endpoint." Direct recon on 2026-10-05 under the new headed browser path shows both pages load unblocked (200) and both have a working search — the parsers were simply calling the wrong URL parameter.

- **Neobits** — `buildSearchUrl` uses `/search?search_param=all&main_search_field=<model>`, which returns the homepage (0 model hits). The real storefront search box (`#main-search-field`) submits to `/search?keywords=<model>`, which returns the CRS326 product. The existing parser (`.product-price, .price4, .price`) then extracts `$215.95` USD with the model gate passing.
- **MBS I-WAV** — `buildSearchUrl` uses `/search?q=<model>`, but `?q=` does not filter (returns generic products). The site's typeahead submits to `/search?keywords=<model>`, which returns the CRS326 product. The existing parser (`.product-views-price, …`) then extracts `$291.78` CAD with the model gate passing.

## Scope

**In scope:** the two `buildSearchUrl` fixes (mobile + Rust desktop parity) and their tests.

**Out of scope:** ROC-NOC (JS/AJAX-populated prices) and HellasCom (search mechanism undiscovered) — separate investigations.

## Architecture

Two one-line URL changes, mirrored in the Rust desktop parsers (the parity guard requires identical strings):

### 1. Neobits — `lib/scrapers/neobits.ts`

```ts
buildSearchUrl: (model) =>
  `https://www.neobits.com/search?keywords=${encodeURIComponent(model)}`,
```

### 2. MBS I-WAV — `lib/scrapers/mbsiwav.ts`

```ts
buildSearchUrl: (model) =>
  `https://www.mbsiwav.com/search?keywords=${encodeURIComponent(model)}`,
```

### 3. Rust parity — `desktop/src-tauri/src/scrapers/{neobits,mbsiwav}.rs`

Mirror both URL strings exactly (the parity test compares host+path after stripping the encoding placeholder).

## Data Flow

1. `prices.get` → `resilientFetch` → browser path (headed in production).
2. The corrected URL returns the product page; the existing parser extracts the price and the model gate confirms the product.

## Error Handling

Unchanged — a miss still returns `null` and the breaker records it.

## Testing

- `tests/scrapers/neobits.test.ts` / `mbsiwav.test.ts` — update the existing `buildSearchUrl` assertions to the new URLs.
- `tests/desktop-scraper-parity.test.ts` — must stay green (URL parity).

## Success Criteria

- Neobits returns `$215.95` USD and MBS I-WAV returns `$291.78` CAD for CRS326-24G-2S+RM through the real parser path.
- `pnpm verify` stays green.
