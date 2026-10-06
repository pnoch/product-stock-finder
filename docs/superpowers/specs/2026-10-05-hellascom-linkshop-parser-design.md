# HellasCom (linkshop.gr) Parser Fix — Design Spec

**Date:** 2026-10-05
**Goal:** Make HellasCom return prices by pointing its parser at the real storefront (`linkshop.gr`, CS-Cart), correcting the search URL and price selector, and adding card-scoped Greek stock inference.

## Problem

Phase 1102 documented HellasCom as "JS-driven with no usable search endpoint." Recon on 2026-10-05 shows the parser targets the wrong host entirely:

- **Wrong host:** `hellascom.gr` is HellasCom's *corporate* site (no shop, no search input). The actual storefront is **`linkshop.gr`** ("LinkShop.gr | MikroTik στην Ελλάδα | HELLASCOM Μ. ΕΠΕ"), a CS-Cart store. `hellascom.gr/search?q=` returns nothing.
- **Wrong search URL:** the CS-Cart search is `https://www.linkshop.gr/?dispatch=products.search&q=<model>&search_performed=Y`. The bare `?dispatch=products.search&q=` returns no products; `search_performed=Y` is required.
- **Wrong price selector:** prices are in `.ty-grid-list__price` (grid) / `.ty-product-block__price-actual` (detail), not `.product-price, .price`. Verified: `$177.42` EUR for CRS326-24G-2S+RM, `$483.87` for the probe model CRS326-24S+2Q+RM.
- **Stock is card-scoped and Greek:** each product card carries `<div class="block_avail_status_label"><div class="title"><b>Διαθέσιμο με παραγγελία</b>`. The current parser reads the page-wide first match (the wrong product's status). Labels: `Εκτός Παραγωγής` (out of production → out_of_stock), `Διαθέσιμο με/για παραγγελία` (available on/for order → back_order), `Διαθέσιμο` (available → in_stock).

## Scope

**In scope:** host + search URL + price selector + card-scoped Greek stock on mobile and Rust; the distributor `website`; Greek stock markers in the shared `inferStockStatus` + Rust mirror; tests.

**Out of scope:** none — this is the last distributor from the Phase-1102 list.

## Architecture

### 1. Distributor host — `shared/src/distributors.ts` + `desktop/.../browser.rs`

Change HellasCom's `website` to `https://www.linkshop.gr` (its real storefront), and the Rust `HOST_REGIONS` entry `("hellascom.gr", EUROPE)` → `("linkshop.gr", EUROPE)`. `tests/parser-host-parity.test.ts` requires `parser.baseUrl` host == distributor website host; `tests/desktop-scraper-parity.test.ts` requires the Rust region table to cover every distributor host.

### 2. Parser — `lib/scrapers/hellascom.ts`

```ts
buildSearchUrl: (model) =>
  `https://www.linkshop.gr/?dispatch=products.search&q=${encodeURIComponent(model)}&search_performed=Y`,
```
`baseUrl: "https://www.linkshop.gr"`, price selector `.ty-grid-list__price, .ty-product-block__price-actual`, and card-scoped stock:

```ts
const card = $price.closest(".ty-grid-list__item, .ty-product-block");
const stockText =
  card.find(".block_avail_status_label .title b, .product_availability_status .title b").first().text() ||
  $(".stock-status, .availability, .product-stock").first().text();
```

`browserOptions.waitForSelector` → `.ty-grid-list__price, .ty-product-block__price-actual`.

### 3. Rust — `desktop/src-tauri/src/scrapers/hellascom.rs`

Mirror the URL, price selector, and browser wait selector. Keep the `parse_price_page` call (so the parity guard still extracts the price selector), then override `stock_status` with a card-scoped lookup using `closest_matching` + the availability label.

### 4. Greek stock markers — `lib/scrapers/utils.ts` + `desktop/.../mod.rs`

Add to `inferStockStatus` (and the Rust mirror, which the parity guard requires identical):
- out_of_stock: `"εκτός παραγωγής"`, `"εξαντλήθηκε"`, `"μη διαθέσιμο"`
- back_order: `"με παραγγελία"`, `"για παραγγελία"`
- in_stock: `"διαθέσιμο"`

Ordering already puts out_of_stock first, so `μη διαθέσιμο` beats `διαθέσιμο`; back_order before in_stock, so `Διαθέσιμο με παραγγελία` → back_order.

## Data Flow

1. `prices.get` → `resilientFetch` → plain/browser fetch of the CS-Cart search URL.
2. `findPriceElement` picks the model's grid price; the card-scoped stock label is read from the same card.
3. Returns `{ price, currency: "EUR", stockStatus, … }`.

## Error Handling

Unchanged — a miss returns `null`; the breaker records it.

## Testing

- `tests/scrapers/hellascom.test.ts` — update `baseUrl`/`buildSearchUrl` assertions; add a search-results fixture case (extracts 177.42 EUR, `back_order`) and a non-matching model → `null`. The existing corporate-site fixture still returns `null`.
- `tests/fixtures/scrapers/hellascom-gr-search.html` — a minimal two-card CS-Cart grid.
- `tests/scraping-integration.test.ts` — add Greek `inferStockStatus` cases.
- `tests/desktop-scraper-parity.test.ts` / `tests/parser-host-parity.test.ts` — stay green.
- Rust: a stock-scoping unit test.

## Success Criteria

- HellasCom returns `177.42` EUR for CRS326-24G-2S+RM with `back_order` stock through the real parser path.
- `pnpm verify` stays green.
