# eBay Integration — Design Spec

**Date:** 2026-10-13
**Status:** Approved
**Scope:** eBay.com (US site, USD listings) following the Shopee TH pattern.

## Evidence

Test link (MikroTik CRS812-8DS-2DQ-2DDQ-RM, New Sealed): item `178212205608`, US $3,114.00 (~THB 104,670.88), InStock, NewCondition, seller `mercocool`, 5 available / 2 sold.

- Short links (`ebay.io/m/{code}`): plain fetch → 302 to error pages; headed browser resolves to the canonical item URL. Resolution = browser render, identity only.
- Canonical (`www.ebay.com/itm/{itemId}`): plain fetch → **403** (datacenter blocked). Headed browser → full page, no login.
- **JSON-LD** (array-of-Product form): `price` (THB-converted string), `priceCurrency`, `availability` (InStock), `itemCondition` (NewCondition), `brand.name`, `name` (contains `<wbr/>` to strip). No `sku`, no seller in offers.
- DOM fallbacks: USD price `US $3,114.00` in `.ux-textspans`; THB approx `THB104,670.88` in `x-price-approx__price`; quantity `N available` / `N sold` in `qtyAvailability`; seller in `"username":"..."` JSON.
- No variants for this listing type (single item id; `var=` empty). Multi-variation listings exist but are out of scope for v1.

## Architecture

Mirror Shopee (browser-first), reusing the marketplace layer:

1. **Identity** (`shared/marketplace-url.ts`): `EbayIdentity { platform: "ebay", region: "US", itemId, canonicalUrl }`. Union extends to three platforms. Recognition: `ebay.io/m/{code}` short (alnum 1-64); `www.ebay.com/itm/{digits}` canonical (query stripped; also accept slug-path form `/itm/{slug}/{itemId}`). Reject non-HTTPS, creds/ports, other eBay TLDs (v1: ebay.com only), leading-zero ids.
2. **Model key**: `ebay-us-{itemId}`. `isMarketplaceKey` extended.
3. **Resolver** (`server/marketplace-resolver.ts`): `ebay.io` short links resolve via the existing bounded headed render (same path as Facebook share links — identity only, no price). Canonical URLs validate inline. Same hop/loop bounds, budget key, rate limit.
4. **Extractor** (`lib/scrapers/ebay.ts`): `parseEbayPrice(html, itemId)` —
   - Identity guard: page references `/itm/{itemId}`.
   - Primary: JSON-LD array → Product with `offers.price` + `priceCurrency` (accept any currency eBay returns — listings are USD on ebay.com; THB appears as eBay's own conversion; store the observed currency, never fabricate). Strip `<wbr/>` from title.
   - Stock: `offers.availability` (InStock/OutOfStock); quantity from `qtyAvailability` text (`N available`).
   - Condition: `itemCondition` (NewCondition → "New", UsedCondition → "Used", else null).
   - Login-wall/blocked markers → null (feeds classifyFetchStatus).
5. **Parser** (`ebayParser`): `id: "ebay-us"`, `useBrowser: true` (plain fetch is 403), `rateLimitMs: 60000`, `buildSearchUrl` → canonical item URL. Inner `parseProductPage(html, url, itemId)` forwarding url (scraper-url-forwarding guard).
6. **Variant-match auto-flip**: eBay listings have no variant field for v1 — `variantName: undefined` from the extractor; the flip logic (compare tracked variant vs observed) treats missing observed variant as no-match, so **eBay products stay manual until a variant-less flip rule is added**. V1 decision: single-variation eBay listings flip to automatic when identity + price are read (no variant to mismatch). Implement as: `variantMatched = true` when `marketplace.platform === "ebay"` and the extractor returned a price (identity guard already ran). Multi-variation listings are rejected at import (v1).
7. **Currency**: listings store their observed currency (USD for ebay.com); display converts via existing FX (`convertPrice`). The confirmation form prefills USD price; THB display handled by existing conversion.
8. **Card**: "eBay" branding; check-price button (WebView host, browser-first); visit canonical URL; monitoring text per status.
9. **Exclusions**: `isMarketplaceKey` covers `ebay-us-`; all pipeline guards follow automatically.
10. **Catalog + Rust**: `ebay-us` DISTRIBUTORS entry (33 distributors / 28 parsers; update pinned counts + docs), Rust port + dispatch, model-gate fixture from the real rendered page shape.

## Out of Scope

- Multi-variation eBay listings (var= selectors).
- Other eBay TLDs (ebay.co.uk, ebay.de, ...) — same pattern per-region later.
- eBay APIs (Browse/Shopping) — not needed given browser access works.
- Server-side sessions (none needed — no login wall).
- Seller-profile fetching.