# Shopee TH Automatic Price Checks — Design Spec

**Date:** 2026-10-12
**Status:** Approved
**Scope:** Shopee TH only (marketplace products with `monitoringStatus: "manual"`)

## Problem

Phase 1144 imports Shopee TH links as manual-monitoring products: no automatic price extraction (datacenter fetches hit a traffic-error page; headed browsers hit a login wall). Users must re-check prices by hand.

## Key Insight

The app already owns the machinery: the on-device WebView renderer (`components/webview-fetch-host.tsx`, residential IP + real cookies) and the session-assist unlock flow (user logs in once, cookies persist, health screen offers unlock when blocked). Shopee TH becomes a parser that rides this chain instead of needing new infrastructure.

## Phase 1 — "Check price" Button (user-triggered, on-device)

**`components/product/marketplace-card.tsx`:** new "Check price now" button.

1. Loads the product's `canonicalUrl` through the on-device WebView host (`getWebViewHost().load(url, { timeoutMs })`).
2. Parses rendered HTML with the Shopee price extractor (new `lib/scrapers/shopee-th.ts`, pure `parseShopeePrice(html, shopId, itemId)` — shared by both phases).
3. On success appends a dated price point (`priceSource: "manual"`, user-triggered observation), updates `lastChecked`, refreshes the card ("Last checked <time>").
4. On login-wall/blocked result shows the existing guidance and links to Settings → Site sessions for unlock.
5. Failures never throw to UI: toast + keep last-known price.

New `refreshMarketplaceListing(product)` in `lib/marketplace.ts` encapsulates steps 1–3 so UI stays thin. No background, no pipeline changes, no status flip in Phase 1.

## Phase 2 — Full Parser Registration (automatic)

**New `lib/scrapers/shopee-th.ts`:** `shopeeThParser: DistributorParser`:
- `id: "shopee-th"`, `baseUrl: "https://shopee.co.th"`, `useBrowser: true` (skip plain fetch — datacenter is blocked; go straight to WebView), `browserOptions.waitForSelector` targeting the price element, `rateLimitMs` conservative (60s+).
- `buildSearchUrl(model)`: model is `shopee-th-{shopId}-{itemId}` → returns canonical product URL.
- `parsePrice(html, model?, url?)`: extract embedded page state (JSON) first, DOM selectors second; verify shop/item IDs from URL match the tracked identity (model-mismatch guard); return `null` on login-wall/blocked markers (feeds existing `classifyFetchStatus` → health screen offers session-assist unlock automatically).
- Registered in `lib/scrapers/registry.ts` + per-scraper test under `tests/scrapers/` with saved fixture HTML.

**Variant safety:** compare the page's observed variant name against the tracked `marketplace.variant`. Match → record price, set listing `priceSource` undefined, set `monitoringStatus: "automatic"`. Mismatch → keep manual status (never alert on the wrong variant).

**Pipeline inclusion:** extend `isAutomaticProduct` (`lib/marketplace.ts`) to return true when `marketplace?.monitoringStatus === "automatic"`. Everything downstream (price-check, restock, digest, alerts, uploads, Drops, history backfill, desktop, Rust) follows without further changes. Manual points already recorded keep `priceSource: "manual"` and stay excluded individually.

**Server scraping:** server-side `resilientFetch` for `shopee-th` uses headless browser escalation per existing chain; expected to stay blocked (datacenter) — on-device is the primary path. No server changes required.

## Error Handling

- Login wall / blocked markers → `null` + existing health/unlock UX. No new modals.
- Variant mismatch → manual status retained, card shows "tracked variant not selected on page".
- WebView unavailable (web platform) → button disabled with explanation; Phase 2 skips silently as today.
- All receipt/status writes best-effort; check pipeline never throws on Shopee paths.

## Testing

- Unit: extractor against fixture HTML (price, variant, login-wall, blocked, mismatch cases).
- Registry: parser registered, `useBrowser: true`.
- `isAutomaticProduct`: manual → false, automatic → true, legacy shopee-th modelNumber → false.
- Status-flip integration: successful scrape sets `monitoringStatus: "automatic"` + clears listing `priceSource`.
- Wiring guards: card button, health unlock path unchanged.
- Live verification (manual, once): real serum link through on-device check before release claim.

## Out of Scope

- Shopee Affiliate API (optional later complement; needs credentials).
- Lazada (same two-phase pattern applies once a TH test link exists).
- Server-side authenticated sessions (no credential storage added).
- Variant auto-switching on the page (we observe, never drive the page).
