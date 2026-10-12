# Lazada TH Marketplace Integration — Design Spec

**Date:** 2026-10-12
**Status:** Approved
**Scope:** Lazada TH only. Follows the Shopee TH pattern (Phase 1144 + auto-price Phase 1145).

## Evidence

Test link (ASUS ROG Strix SCAR 18 2026, RTX 5090): item `16199450766`, sku `127341978928`, `฿237,290.00`, InStock.

- Short links (`s.lazada.co.th/s.XXXX`) return HTTP 200 HTML (no redirect chain) with `og:title`, `og:image`, and `itemId`/`skuId` in `al:ios:url` / `al:android:url` app-link meta. No price on the landing page.
- Canonical URL: `https://www.lazada.co.th/products/<slug>-i{itemId}-s{skuId}.html` (identity embedded in URL).
- Price: embedded page state `pdt_price` (e.g. `"฿237,290.00"`), tied to the selected sku (`_p_sku`, `pdt_simplesku`). JSON-LD `Offer` carries availability + sku but NO price.
- Stock: JSON-LD `availability` (`InStock`/`OutOfStock`) + embedded state.
- Blocking: none observed — full page over plain datacenter fetch. No login wall.
- Brand: `brand_name` in tracking data (e.g. `"ASUS"`).

## Architecture

Mirror Shopee, generalized to multi-platform:

1. **Identity union** (`shared/marketplace-url.ts`): `MarketplaceIdentity = ShopeeIdentity | LazadaIdentity` discriminated by `platform`. `LazadaIdentity { platform: "lazada", region: "TH", itemId, skuId, canonicalUrl }`. URL recognition: `s.lazada.co.th/s.<code>` short links; `www.lazada.co.th/products/...-i<itemId>-s<skuId>.html` canonical. Model key: `lazada-th-{itemId}-{skuId}`.
2. **Resolver** (`server/marketplace-resolver.ts`): extend result + resolution to Lazada. Short-link hop fetches landing HTML (capped, pinned DNS, allowlisted hosts `s.lazada.co.th` + `www.lazada.co.th`) and extracts itemId/skuId from app-link meta; canonical URLs validate inline. Same hop/loop bounds and SSRF discipline.
3. **Extractor** (`lib/scrapers/lazada-th.ts`): `parseLazadaPrice(html, itemId, skuId)` — pdt_price parsed (THB only, ranges refused), validated against selected sku (`_p_sku`/`pdt_simplesku` match), stock from JSON-LD availability. Identity guard: sku field `16199450766_TH-127341978928` or page itemId must match.
4. **Parser** (`lazadaThParser`): `useBrowser: false` (plain first — it works), standard escalation on failure, conservative rate limit. Variant-match auto-flip reuses the Shopee mechanism (`variantName` on ScrapeResult, `monitoringStatus`).
5. **Confirmation form**: same fields (name/variant/seller/THB); variant prefilled from og:title when unambiguous, seller from tracking `seller_name` (empty here → user-entered).
6. **Card**: "Lazada TH" branding, manual price, check-price button (WebView host works the same), visit canonical URL.
7. **Exclusions**: extend `isAutomaticProduct` + all `shopee-th-` key guards to `lazada-th-` (shared helper, not duplicated prefix checks — refactor to a `MARKETPLACE_KEY_PREFIXES` list if cleaner).
8. **Catalog + Rust**: `lazada-th` DISTRIBUTORS entry (32 distributors / 27 parsers; update pinned counts + docs), Rust port + dispatch, model-gate fixture from the real page shape.

## Out of Scope

- Other Lazada regions (same pattern applies per-region later).
- Affiliate/commercial APIs.
- Variant switching on the page (observe only).
- Server-side authenticated sessions.
