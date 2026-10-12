# Lazada TH Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Lazada TH link import + automatic price checks by generalizing the Shopee TH marketplace layer to multi-platform.

**Architecture:** `MarketplaceIdentity` becomes a `platform`-discriminated union; a shared `isMarketplaceKey` helper replaces 11 scattered `shopee-th-` prefix checks; new `lazada-th` parser (plain-first), catalog entry, and Rust port mirror Shopee.

**Tech Stack:** TypeScript, Expo Router, tRPC, Drizzle (no schema change), Rust (Tauri), vitest + cargo test.

**Spec:** `docs/superpowers/specs/2026-10-12-lazada-integration-design.md`

---

## File Structure

| File | Purpose |
|------|---------|
| Modify `shared/marketplace-url.ts` | `LazadaIdentity`, union, recognition, messages |
| Modify `lib/marketplace.ts` | `isMarketplaceKey`, generic builder, Lazada refresh |
| Create `lib/scrapers/lazada-th.ts` | Extractor + parser |
| Modify `lib/scrapers/registry.ts` | Register parser |
| Modify `server/marketplace-resolver.ts` | Lazada short-link resolution |
| Modify 11 prefix-check sites | Use `isMarketplaceKey` |
| Modify `shared/src/distributors.ts` | `lazada-th` entry (32/27) |
| Modify `desktop/src-tauri/src/scrapers/` | `lazada-th.rs` + registration + dispatch |
| Modify UI (sheet, card, search) | Platform-agnostic labels |
| Tests | URL, extractor, parser, refresh, guards |

---

### Task 1: Identity union + URL recognition + tests

**Files:**
- Modify: `shared/marketplace-url.ts`
- Test: `tests/marketplace-url.test.ts` (append)

- [ ] **Step 1: Read the current file**

Read `shared/marketplace-url.ts` fully (Shopee shapes, `parseMarketplaceUrl`, `isShopeeInput`, `marketplaceResolutionMessage`, `MAX_MARKETPLACE_URL_LENGTH` in `shared/const.ts` — check whether the cap constant is Shopee-named and needs a generic alias).

- [ ] **Step 2: Add Lazada types + recognition**

```typescript
export interface LazadaIdentity {
  platform: "lazada";
  region: "TH";
  itemId: string;   // digits, no leading zero
  skuId: string;    // digits, no leading zero
  canonicalUrl: string;
}

export type MarketplaceIdentity = ShopeeIdentity | LazadaIdentity;

export function isMarketplaceKey(modelNumber?: string): boolean {
  return typeof modelNumber === "string" &&
    (modelNumber.startsWith("shopee-th-") || modelNumber.startsWith("lazada-th-"));
}
```

Recognition rules:
- Short: `https://s.lazada.co.th/s.<code>` (code: alnum, 1-64 chars) → `{ kind: "short", platform: "lazada" }` (check the existing short-link result shape for Shopee and mirror it — read the file).
- Canonical: `https://www.lazada.co.th/products/<slug>-i<itemId>-s<skuId>.html` → product with extracted ids. Also accept `https://www.lazada.co.th/products/i<itemId>-s<skuId>.html` (no slug). Reject non-digit ids, leading zeros, wrong hosts (`lazada.com`, `lazada.sg`), non-HTTPS, credentials/ports.
- `isShopeeInput` stays as-is; add `isLazadaInput` (same trigger style) + `isMarketplaceInput = isShopeeInput || isLazadaInput`.
- `marketplaceResolutionMessage`: Lazada variants ("Lazada link import …", livestream n/a — Lazada has no livestream-link case; unsupported hosts → existing generic message).

- [ ] **Step 3: Append tests**

```typescript
describe("lazada url recognition", () => {
  it("recognizes canonical urls with slug", () => {
    expect(parseMarketplaceUrl("https://www.lazada.co.th/products/asus-rog-i16199450766-s127341978928.html")).toEqual({
      kind: "product",
      identity: {
        platform: "lazada", region: "TH",
        itemId: "16199450766", skuId: "127341978928",
        canonicalUrl: "https://www.lazada.co.th/products/asus-rog-i16199450766-s127341978928.html",
      },
    });
  });

  it("recognizes slugless canonical urls", () => {
    const out = parseMarketplaceUrl("https://www.lazada.co.th/products/i16199450766-s127341978928.html");
    expect(out.kind).toBe("product");
  });

  it("recognizes short links without fetching", () => {
    expect(parseMarketplaceUrl("https://s.lazada.co.th/s.Z9ZEU8")).toEqual({
      kind: "short", platform: "lazada",
    });
  });

  it("rejects wrong regions, bad ids, non-https", () => {
    expect(parseMarketplaceUrl("https://www.lazada.sg/products/a-i1-s2.html").kind).not.toBe("product");
    expect(parseMarketplaceUrl("https://www.lazada.co.th/products/a-i01-s2.html").kind).not.toBe("product");
    expect(parseMarketplaceUrl("http://www.lazada.co.th/products/a-i1-s2.html").kind).not.toBe("product");
  });

  it("isMarketplaceKey covers both platforms", () => {
    expect(isMarketplaceKey("shopee-th-1-2")).toBe(true);
    expect(isMarketplaceKey("lazada-th-16199450766-127341978928")).toBe(true);
    expect(isMarketplaceKey("CRS804")).toBe(false);
    expect(isMarketplaceKey(undefined)).toBe(false);
  });
});
```

Adapt to actual result shapes found in Step 1 (if short-link results carry different fields, match them).

- [ ] **Step 4: Run tests + check, commit**

Run: `pnpm exec vitest run tests/marketplace-url.test.ts && pnpm check`
Expected: all pass, 0 errors.

```bash
git add shared/marketplace-url.ts tests/marketplace-url.test.ts
git commit -m "feat(lazada): identity union + URL recognition + tests"
```

---

### Task 2: Extractor + parser + registry + tests

**Files:**
- Create: `lib/scrapers/lazada-th.ts`
- Modify: `lib/scrapers/registry.ts`
- Test: `tests/scrapers/lazada-th.test.ts`

- [ ] **Step 1: Write the extractor + parser**

```typescript
import * as cheerio from "cheerio";
import { parsePriceFromText } from "./utils";
import type { DistributorParser, ScrapeResult } from "./types";

export interface LazadaPrice {
  price: number;
  currency: "THB";
  variantName: string | null;
  inStock: boolean;
}

function parseThb(text: string): number | null {
  const m = text.replace(/,/g, "").match(/฿\s*([\d.]+)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

export function parseLazadaPrice(html: string, itemId: string, skuId: string): LazadaPrice | null {
  // 1. Identity guard: page must reference our item (sku field "<item>_TH-<sku>" or _p_item=<item>).
  const idOk = html.includes(`${itemId}_TH-${skuId}`) || html.includes(`_p_item=${itemId}`);
  if (!idOk) return null;
  // 2. pdt_price tied to the selected sku.
  const selOk = html.includes(`_p_sku=${skuId}`) || html.includes(`pdt_simplesku:${skuId}`) || html.includes(`"pdt_simplesku":"${skuId}"`) || html.includes(`pdt_simplesku=${skuId}`);
  // 3. Price: first pdt_price occurrence.
  const pm = html.match(/pdt_price\\?":\\?"([^"\\]+)"/) ?? html.match(/pdt_price":"([^"]+)"/);
  const price = pm ? parseThb(pm[1]!) : null;
  if (price === null || !selOk) return null;
  // 4. Stock from JSON-LD availability.
  const oos = /"availability"\s*:\s*"https?:\/\/schema\.org\/OutOfStock"/.test(html);
  return { price, currency: "THB", variantName: null, inStock: !oos };
}
```

Hmm — step 2's selOk patterns are speculative against minified variants. Before finalizing, verify against the REAL saved page (`/tmp/opencode/lazada.html` may be gone — re-fetch the canonical URL with curl and grep the exact `pdt_price`/`_p_sku` spellings). Adjust the regexes to match reality; keep the selected-sku validation (refuse price when the page's selected sku differs).

Variant name: spec says prefill from og:title when unambiguous. The extractor returns `variantName: null` (og:title is the product title, not the variant). Variant stays user-entered — note this; do NOT fabricate variant from title.

Parser object:

```typescript
function modelIds(model?: string): { itemId: string; skuId: string } | null {
  const m = model?.match(/^lazada-th-([1-9]\d{0,19})-([1-9]\d{0,19})$/);
  return m ? { itemId: m[1]!, skuId: m[2]! } : null;
}

function parseProductPage(html: string, url: string | undefined, itemId: string, skuId: string): ScrapeResult | null {
  const found = parseLazadaPrice(html, itemId, skuId);
  if (!found) return null;
  return {
    price: found.price, currency: "THB",
    stockStatus: found.inStock ? "in_stock" : "out_of_stock",
    url: url ?? `https://www.lazada.co.th/products/i${itemId}-s${skuId}.html`,
    variantName: found.variantName ?? undefined,
  };
}

export const lazadaThParser: DistributorParser = {
  id: "lazada-th",
  baseUrl: "https://www.lazada.co.th",
  buildSearchUrl: (model) => {
    const ids = modelIds(model);
    return ids ? `https://www.lazada.co.th/products/i${ids.itemId}-s${ids.skuId}.html` : "https://www.lazada.co.th";
  },
  parsePrice: (html, model, url) => {
    const ids = modelIds(model);
    if (!ids) return null;
    return parseProductPage(html, url, ids.itemId, ids.skuId);
  },
  rateLimitMs: 60000,
  // Plain first (works from datacenters); standard escalation on failure.
};
```

Note: inner function MUST be named `parseProductPage` (scraper-url-forwarding guard requires `parseHtml(`/`parseProductPage(` with forwarded url — second arg is `url` variable, not a string literal).

- [ ] **Step 2: Register**

`registry.ts`: import + append `lazadaThParser`.

- [ ] **Step 3: Tests** (`tests/scrapers/lazada-th.test.ts`)

Use realistic fixtures (modeled on the real page, small):
- extracts pdt_price + InStock with matching selected sku
- rejects mismatched selected sku (different `_p_sku`)
- rejects missing identity markers
- rejects OutOfStock → inStock false (still returns price — stock false, price present)
- rejects non-THB price text
- parser registered (import registry, find `lazada-th`, `useBrowser` falsy), buildSearchUrl canonical, parsePrice end-to-end

- [ ] **Step 4: Run + check + commit**

Run: `pnpm exec vitest run tests/scrapers/lazada-th.test.ts && pnpm check && pnpm lint`
Expected: all pass, 0 errors.

```bash
git add lib/scrapers/lazada-th.ts lib/scrapers/registry.ts tests/scrapers/lazada-th.test.ts
git commit -m "feat(lazada): extractor + parser + tests"
```

---

### Task 3: Resolver + generic builder + refresh

**Files:**
- Modify: `server/marketplace-resolver.ts`
- Modify: `lib/marketplace.ts`
- Modify: `lib/types.ts` (marketplace field type)
- Test: `tests/marketplace-resolver.test.ts`, `tests/marketplace-product.test.ts` (append)

- [ ] **Step 1: Read current resolver + builder**

Read `server/marketplace-resolver.ts` (short-link hop flow, allowlist, cap constant) and `lib/marketplace.ts` lines 76-97 (builder) + `lib/types.ts` line 90 (`marketplace?: ShopeeIdentity & {...}`).

- [ ] **Step 2: Extend the resolver**

- Allowlist `s.lazada.co.th` for initial fetch (same DNS-pinned capped fetch as Shopee short links).
- On landing HTML: extract `itemId`/`skuId` from `al:ios:url` / `al:android:url` meta (`lazada://th/d?itemId=(\d+)&skuId=(\d+)`), else from `og:url` canonical pattern. No price extraction server-side (landing page has none).
- Return `{ kind: "product", identity: { platform: "lazada", region: "TH", itemId, skuId, canonicalUrl } }` with canonical `https://www.lazada.co.th/products/i{itemId}-s{skuId}.html`.
- Canonical Lazada URLs validate inline (no fetch).
- Reuse hop/loop bounds, length cap (`MAX_MARKETPLACE_URL_LENGTH`), rate limit bucket (same `products.resolveMarketplace` endpoint — no new endpoint).

- [ ] **Step 3: Generalize `lib/marketplace.ts`**

- `Product.marketplace` type (`lib/types.ts` line 90): `ShopeeIdentity` → `MarketplaceIdentity` (import type from shared).
- `buildMarketplaceProduct`: accept `identity: MarketplaceIdentity`; key = `shopee-th-{shop}-{item}` | `lazada-th-{item}-{sku}`; identity round-trip check per platform (Shopee: existing; Lazada: parse canonical, compare itemId+skuId); error messages platform-agnostic ("Enter a name, variant…, seller and positive THB price."); distributorId = key.
- `refreshMarketplaceListing`: branch extractor by `marketplace.platform` (`parseShopeePrice` vs `parseLazadaPrice`); card-facing statuses unchanged.
- `isAutomaticProduct` + `isMarketplaceKey`: already generic? `isMarketplaceKey` covers both (Task 1). `isAutomaticProduct` checks `marketplace` object presence — no change needed. Replace the legacy `modelNumber.startsWith("shopee-th-")` fallback with `isMarketplaceKey` for clarity (same behavior).

- [ ] **Step 4: Tests**

Resolver tests (mock fetch at boundary, mirror Shopee cases): short-link meta extraction, HopLimit, non-Lazada host never fetched, network failure → error.
Builder tests: Lazada product builds with `lazada-th-` key + identity round-trip; mismatched identity throws; variant/seller/price validation shared.

- [ ] **Step 5: Run + check + commit**

Run targeted tests + `pnpm check && pnpm lint`. Then:

```bash
git add server/marketplace-resolver.ts lib/marketplace.ts lib/types.ts tests/marketplace-resolver.test.ts tests/marketplace-product.test.ts
git commit -m "feat(lazada): resolver + generic builder + refresh"
```

---

### Task 4: Prefix-check sweep + catalog + UI labels

**Files:**
- Modify: `lib/price-source.ts` (2 sites), `lib/server-notifications.ts`, `lib/listing-discovery.ts`, `lib/live-prices.ts`, `lib/manual-add.ts`, `components/search/manual-add-sheet.tsx`, `desktop/src/lib/server-prices.ts`, `desktop/src/server-notifications.ts`, `desktop/src-tauri/src/lib.rs` (3 sites: `is_automatic_product`, `check_all_prices` filter, keep dispatch style)
- Modify: `shared/src/distributors.ts` (entry), `tests/distributors.test.ts` (32), `tests/agents-doc-drift.test.ts` (32/27), `AGENTS.md`, `design.md`, `docs/store-listing.md` (counts + bullet)
- Modify: `app/search.tsx` (labels), `components/search/manual-add-sheet.tsx` (labels), `components/product/marketplace-card.tsx` (platform branding)

- [ ] **Step 1: Replace prefix checks with `isMarketplaceKey`**

Sites (verify each before editing): `lib/price-source.ts:28,54`, `lib/server-notifications.ts:154`, `lib/listing-discovery.ts:32`, `lib/live-prices.ts:81` (`!isMarketplaceKey(modelNumber)`), `lib/manual-add.ts:166`, `desktop/src/lib/server-prices.ts:22` (`isMarketplaceKey(modelNumber) || ...`), `desktop/src/server-notifications.ts:152`, Rust `is_automatic_product` + `check_all_prices` filter (extend `starts_with` to both prefixes — no shared helper in Rust; add both literals).

Import `isMarketplaceKey` from `@shared/marketplace-url` (check each file's existing shared-import style first).

- [ ] **Step 2: Catalog + counts**

Entry (after `shopee-th` in `shared/src/distributors.ts`):

```typescript
{
  id: "lazada-th",
  name: "Lazada Thailand",
  taxMode: "origin",
  currency: "THB",
  country: "Thailand",
  countryCode: "TH",
  region: "Asia-Pacific",
  website: "https://www.lazada.co.th",
  paymentMethods: ["Credit Card", "Bank Transfer", "Cash on Delivery"],
  notes: "Marketplace — tracked per listing; plain-fetch first",
},
```

Update: `tests/distributors.test.ts` 31→32; `tests/agents-doc-drift.test.ts` 31→32, 26→27; AGENTS.md + design.md counts (31→32, 26→27, keep "global electronics" phrasing); store-listing short/full (check 80-char limit: "Track stock and prices across 32 electronics distributors. Alerts and history." = count first); design.md "(32 sites)" + bullets (add `- Lazada TH (Thailand, marketplace)`).

- [ ] **Step 3: UI labels platform-agnostic**

- `manual-add-sheet.tsx`: draft modelNumber for Lazada = `lazada-th-{itemId}-{skuId}`; button/title strings ("Resolve Shopee Link" → platform-aware via `result.identity.platform` or input check `isLazadaInput` — mirror existing `isShopeeInput` ternaries); description mentions both.
- `app/search.tsx`: same ternaries for Discover/Import button + accessibility labels.
- `marketplace-card.tsx`: header "Shopee TH" → `marketplace.platform === "lazada" ? "Lazada TH" : "Shopee TH"`; visit link label likewise; monitoring text unchanged.

- [ ] **Step 4: Run + check + lint, commit**

```bash
git add <all Task 4 files>
git commit -m "feat(lazada): prefix sweep + catalog + platform-aware UI"
```

---

### Task 5: Rust port + fixtures + guards + verify

**Files:**
- Create: `desktop/src-tauri/src/scrapers/lazada-th.rs`
- Modify: `desktop/src-tauri/src/scrapers/mod.rs`, `desktop/src-tauri/src/lib.rs` (dispatch arm)
- Create: `tests/fixtures/scrapers/lazada-th.html`
- Create: `tests/lazada-guard.test.ts`, `desktop/tests/lazada-parity.test.tsx` (check desktop test dir naming first)
- Modify: `tests/scrapers/adversarial.test.ts` (exemption with justification — cap is 2, currently 2 used! read the cap test first: `toBeLessThanOrEqual(2)`. If full, alternative: make the extractor handle the synthetic page? It can't (no ids). Second alternative: extend the cap with justification comment + update the assertion. Prefer: add exemption + bump cap to 3 with comment — the cap test itself asserts ≤2, so update it deliberately.)
- Modify: `todo.md` (Phase 1146)

- [ ] **Step 1: Rust port** (mirror `shopee-th.rs`)

`split_model` on `lazada-th-` prefix; canonical URL builder; `parse_html`: pdt_price regex + selected-sku check + JSON-LD availability OutOfStock; login-wall n/a (no wall observed — return Err("No Lazada TH price found") when absent). `fetch_with_browser(&url, None, Some(25000))` when `use_browser`, else plain `fetch_html`. Unit tests in-file (mirror TS cases). Register `#[path = "lazada-th.rs"] pub mod lazada_th;` + dispatch `"lazada-th" => scrapers::lazada_th::scrape(model, false).await` (plain-first, mirror TS `useBrowser` falsy).

Verify the parity tests: currency test needs `"THB"` literal near `parse_price_page(` — if the port doesn't call `parse_price_page`, the test skips it (no match → continue) — acceptable; browser-wait test needs `fetch_with_browser(..., None` ↔ TS null waitForSelector — ensure the regex `fetch_with_browser\(\s*[^,]+,\s*Some\("([^"]+)"\)` finds NO match (returns null) matching TS null. Confirm by running the parity test.

Build offline-safe: `cargo test --no-run` to file first (Rust builds are slow; direct binary run if cargo stalls on network).

- [ ] **Step 2: Fixture**

`tests/fixtures/scrapers/lazada-th.html` — realistic minimal page: JSON-LD Product/Offer (InStock, sku `16199450766_TH-127341978928`), embedded `pdt_price:"฿237,290.00"` + `_p_sku=127341978928`. Verify `parsePrice(fixture, "__NO_SUCH_MODEL__")` → null and `parsePrice(fixture, "lazada-th-16199450766-127341978928")` → 237290 in a scratch check (or as assertions in the lazada-th test file).

- [ ] **Step 3: Adversarial exemption**

Add `"lazada-th"` to CANNOT_PARSE_SYNTHETIC with justification (identity-keyed like shopee-th). Check the cap assertion first — if `≤2` blocks a third entry, bump to 3 with an updated comment (deliberate, not silent).

- [ ] **Step 4: Guards**

`tests/lazada-guard.test.ts`: registry contains lazadaThParser; card brands Lazada TH; `isMarketplaceKey` covers both; catalog has lazada-th; resolver mentions `s.lazada.co.th`. Desktop parity test: `lazada-th.rs` exists, dispatch arm present (grep lib.rs — substring test like existing patterns; check desktop/tests dir for the equivalent guard file first).

- [ ] **Step 5: Full verify**

`pnpm exec vitest run` (targeted first), `pnpm check && pnpm lint`, `pnpm verify` (CARGO_NET_OFFLINE=true if cargo stalls; exit 0; fix in-scope, BLOCKED otherwise). Live re-check: `resolveMarketplaceLink` on the real short link returns the product identity (regression proof).

- [ ] **Step 6: todo.md + commit**

Phase 1146 entry + commit guards/todo. Separate commit for the Rust port if large.

---

## Self-Review

**Spec coverage:**
- ✅ Identity union + recognition (Task 1)
- ✅ Resolver short-link meta extraction (Task 3)
- ✅ Extractor + parser plain-first (Task 2)
- ✅ Variant-match auto-flip reuse — no changes needed (mechanism is platform-agnostic; Lazada `variantName` flows through `ScrapeResult.variantName`; confirm in Task 3 review)
- ✅ Confirmation form generic builder (Task 3)
- ✅ Card branding (Task 4)
- ✅ Exclusion sweep (Task 4)
- ✅ Catalog + Rust + fixture (Tasks 4-5)

**Placeholder scan:** None — Task 2 requires re-fetching the real page to ground regexes; Task 5 requires checking cap/dir conventions first.

**Type consistency:** `LazadaIdentity`, `MarketplaceIdentity`, `isMarketplaceKey`, `lazada-th-{itemId}-{skuId}`, `parseLazadaPrice(html, itemId, skuId)`, `lazadaThParser` used consistently throughout.
