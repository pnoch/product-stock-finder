# eBay Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add eBay (ebay.com, USD) link import + automatic price checks by extending the marketplace layer to a fourth platform.

**Architecture:** `EbayIdentity` joins the union; `ebay.io` short links resolve via the existing Facebook-style headed render; `parseEbayPrice` reads JSON-LD (grounded on the real rendered page); `ebayParser` is browser-first (plain fetch is 403); eBay products auto-flip on identity+price (no variant to mismatch); catalog grows to 33/28 with a Rust port.

**Tech Stack:** TypeScript, cheerio, tRPC, Patchright (server), Rust (Tauri), vitest + cargo test.

**Spec:** `docs/superpowers/specs/2026-10-13-ebay-integration-design.md`

**Grounding evidence (real rendered page, `/tmp/opencode/ebay-rendered.html` shape):**
- JSON-LD: `<script type="application/ld+json">[{"@type":"Product",...,"offers":{"price":"104670.88","priceCurrency":"THB","availability":"https://schema.org/InStock","itemCondition":"https://schema.org/NewCondition",...}}]</script>` — array form, no sku, name contains `<wbr/>`.
- DOM: `US $3,114.00` (`.ux-textspans`), `THB104,670.88` (`x-price-approx__price`), `5 available`/`2 sold` (`qtyAvailability`), seller `"username":"mercocool"`.

---

## File Structure

| File | Purpose |
|------|---------|
| Modify `shared/marketplace-url.ts` | `EbayIdentity`, recognition, messages |
| Modify `server/marketplace-resolver.ts` | `ebay.io` short-link resolution |
| Create `lib/scrapers/ebay.ts` | Extractor + parser |
| Modify `lib/scrapers/registry.ts` | Register parser |
| Modify `lib/marketplace.ts` | Builder + refresh branches |
| Modify UI (sheet, card, search) | eBay labels |
| Modify `shared/src/distributors.ts` | `ebay-us` entry (33/28) |
| Modify `desktop/src-tauri/src/scrapers/` | `ebay.rs` + registration + dispatch |
| Create tests | URL, extractor, resolver, guards |

---

### Task 1: Identity + recognition + tests

**Files:**
- Modify: `shared/marketplace-url.ts`
- Test: `tests/ebay-marketplace.test.ts` (create)

- [ ] **Step 1: Read the current union**

Read `shared/marketplace-url.ts` fully (three-platform shapes, `MarketplaceUrl` kinds, input detectors, `marketplaceResolutionMessage` platform param).

- [ ] **Step 2: Add EbayIdentity + recognition**

```typescript
export interface EbayIdentity {
  platform: "ebay";
  region: "US";
  itemId: string; // digits, no leading zero
  canonicalUrl: string; // https://www.ebay.com/itm/{itemId}
}

export type MarketplaceIdentity = ShopeeIdentity | LazadaIdentity | FacebookIdentity | EbayIdentity;
```

Recognition in `parseMarketplaceUrl`:
- Canonical: `https://www.ebay.com/itm/{digits}` (query stripped; optional trailing slash) AND slug form `https://www.ebay.com/itm/{slug}/{digits}` → product identity.
- Short: `https://ebay.io/m/{code}` (alnum + `-`/`_`, 1-64) → `{ kind: "short_link", url }`.
- Reject: other TLDs (`ebay.co.uk`, `ebay.de`, `ebay.co.th`), `pages.ebay.com`, non-HTTPS, creds/ports, leading zeros.

`isEbayInput` + extend `isMarketplaceInput` + `isMarketplaceKey` (`ebay-us-`). `marketplaceResolutionMessage`: ebay variants.

- [ ] **Step 3: Tests**

```typescript
import { describe, expect, it } from "vitest";
import { isEbayInput, isMarketplaceInput, isMarketplaceKey, parseMarketplaceUrl } from "../shared/marketplace-url";

describe("ebay url recognition", () => {
  it("recognizes canonical item urls and strips tracking", () => {
    expect(parseMarketplaceUrl("https://www.ebay.com/itm/178212205608?mkcid=16")).toEqual({
      kind: "product",
      identity: { platform: "ebay", region: "US", itemId: "178212205608", canonicalUrl: "https://www.ebay.com/itm/178212205608" },
    });
  });

  it("recognizes slug-form canonical urls", () => {
    const out = parseMarketplaceUrl("https://www.ebay.com/itm/MikroTik-CRS812/178212205608");
    expect(out.kind).toBe("product");
    if (out.kind === "product" && out.identity.platform === "ebay") {
      expect(out.identity.itemId).toBe("178212205608");
    }
  });

  it("recognizes short links without fetching", () => {
    expect(parseMarketplaceUrl("https://ebay.io/m/CV7fAk")).toEqual({
      kind: "short_link", url: "https://ebay.io/m/CV7fAk",
    });
  });

  it("rejects other TLDs, bad ids, non-https", () => {
    expect(parseMarketplaceUrl("https://www.ebay.co.uk/itm/123/").kind).not.toBe("product");
    expect(parseMarketplaceUrl("https://www.ebay.com/itm/0123/").kind).not.toBe("product");
    expect(parseMarketplaceUrl("http://www.ebay.com/itm/123/").kind).not.toBe("product");
    expect(parseMarketplaceUrl("https://pages.ebay.com/x").kind).not.toBe("product");
  });

  it("input detectors + key coverage", () => {
    expect(isEbayInput("https://ebay.io/m/abc")).toBe(true);
    expect(isMarketplaceInput("https://www.ebay.com/itm/1")).toBe(true);
    expect(isMarketplaceKey("ebay-us-178212205608")).toBe(true);
    expect(isMarketplaceKey("CRS804")).toBe(false);
  });
});
```

- [ ] **Step 4: Run + check + commit**

`pnpm exec vitest run tests/ebay-marketplace.test.ts && pnpm check && pnpm lint`

```bash
git add shared/marketplace-url.ts tests/ebay-marketplace.test.ts
git commit -m "feat(ebay): identity + URL recognition"
```

---

### Task 2: Extractor + parser + registry + tests

**Files:**
- Create: `lib/scrapers/ebay.ts`
- Modify: `lib/scrapers/registry.ts`
- Test: `tests/scrapers/ebay.test.ts`

- [ ] **Step 1: Write the extractor + parser**

```typescript
import type { DistributorParser, ScrapeResult } from "./types";

export interface EbayPrice {
  price: number;
  currency: string; // observed (USD on ebay.com; THB appears as eBay's conversion)
  title: string | null;
  inStock: boolean;
  condition: string | null;
}

const WBR = /<wbr\/?>/g;

function stripWbr(value: string): string {
  return value.replace(WBR, "");
}

function parseJsonLdProduct(html: string): { price: number; currency: string; title: string | null; inStock: boolean; condition: string | null } | null {
  const blocks = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g) ?? [];
  for (const block of blocks) {
    const raw = block.replace(/^<script[^>]*>/, "").replace(/<\/script>$/, "");
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { continue; }
    const items = Array.isArray(parsed) ? parsed : [parsed];
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const product = item as Record<string, unknown>;
      if (product["@type"] !== "Product") continue;
      const offers = product["offers"] as Record<string, unknown> | undefined;
      if (!offers || typeof offers !== "object") continue;
      const price = Number(offers["price"]);
      const currency = typeof offers["priceCurrency"] === "string" ? offers["priceCurrency"] : null;
      if (!Number.isFinite(price) || price <= 0 || !currency) continue;
      const availability = typeof offers["availability"] === "string" ? offers["availability"] : "";
      const condition = typeof offers["itemCondition"] === "string" ? offers["itemCondition"] : null;
      return {
        price,
        currency,
        title: typeof product["name"] === "string" ? stripWbr(product["name"]) : null,
        inStock: availability.includes("InStock"),
        condition: condition?.includes("NewCondition") ? "New" : condition?.includes("UsedCondition") ? "Used" : null,
      };
  }
  }
  return null;
}

export function parseEbayPrice(html: string, itemId: string): EbayPrice | null {
  // Identity guard: the page must reference our item.
  if (!html.includes(`/itm/${itemId}`) && !html.includes(`"itemId":"${itemId}"`)) return null;
  // Login wall / error pages.
  if (/Sign in or register|Error Page/i.test(html.slice(0, 4000)) && !parseJsonLdProduct(html)) return null;
  const found = parseJsonLdProduct(html);
  if (!found) return null;
  return found;
}

function modelIds(model?: string): string | null {
  const m = model?.match(/^ebay-us-([1-9]\d{0,19})$/);
  return m ? m[1]! : null;
}

function parseProductPage(html: string, url: string | undefined, itemId: string): ScrapeResult | null {
  const found = parseEbayPrice(html, itemId);
  if (!found) return null;
  return {
    price: found.price,
    currency: found.currency,
    stockStatus: found.inStock ? "in_stock" : "out_of_stock",
    url: url ?? `https://www.ebay.com/itm/${itemId}`,
    variantName: undefined,
  };
}

export const ebayParser: DistributorParser = {
  id: "ebay-us",
  baseUrl: "https://www.ebay.com",
  buildSearchUrl: (model) => {
    const id = modelIds(model);
    return id ? `https://www.ebay.com/itm/${id}` : "https://www.ebay.com";
  },
  parsePrice: (html, model, url) => {
    const id = modelIds(model);
    if (!id) return null;
    return parseProductPage(html, url, id);
  },
  rateLimitMs: 60000,
  useBrowser: true,
};
```

- [ ] **Step 2: Register in `lib/scrapers/registry.ts`** (import + append).

- [ ] **Step 3: Tests** (`tests/scrapers/ebay.test.ts`)

Fixtures modeled on the real page:
- JSON-LD array Product → price/currency/availability/condition extracted; `<wbr/>` stripped from title.
- Identity guard: no `/itm/{id}` reference → null.
- Error page (no JSON-LD) → null.
- OutOfStock → inStock false (price still returned).
- USD price (priceCurrency "USD") accepted; stored as-is.
- Parser registered (`useBrowser` true), buildSearchUrl canonical, parsePrice end-to-end with the fixture.

- [ ] **Step 4: Run + check + commit**

`pnpm exec vitest run tests/scrapers/ebay.test.ts && pnpm check && pnpm lint`

```bash
git add lib/scrapers/ebay.ts lib/scrapers/registry.ts tests/scrapers/ebay.test.ts
git commit -m "feat(ebay): extractor + parser + tests"
```

---

### Task 3: Resolver + builder + refresh branches

**Files:**
- Modify: `server/marketplace-resolver.ts`
- Modify: `lib/marketplace.ts`
- Test: `tests/ebay-resolver.test.ts` (create), `tests/ebay-marketplace.test.ts` (append)

- [ ] **Step 1: Resolver**

Extend `server/marketplace-resolver.ts`:
- `EBAY_SHORT_HOST = "ebay.io"` — short links resolve via the same `renderHtml` dep used for Facebook (bounded headed render). Extract itemId from the FINAL URL (`/itm/{digits}`) via `parseEbayItemFromUrl(url)`. Validate final host is `www.ebay.com` (defense in depth). Return `{ kind: "product", identity: { platform: "ebay", region: "US", itemId, canonicalUrl: `https://www.ebay.com/itm/${itemId}` } }`.
- Canonical ebay URLs validate inline (no render).
- Same budget key + rate limit as the other marketplace paths.

- [ ] **Step 2: Builder + refresh in `lib/marketplace.ts`**

- `buildMarketplaceProduct`: ebay branch — round-trip via `parseMarketplaceUrl`, key `ebay-us-{itemId}`, variant empty → "Single option" (mirror facebook), currency: listings store the OBSERVED currency at refresh time; at build time the manual price is user-entered — the form labels it "Price (USD)" for ebay. **Currency handling:** `buildMarketplaceProduct` currently hardcodes `"THB"` in listing + history. For ebay, use `"USD"`. Add a per-platform currency map: `{ shopee: "THB", lazada: "THB", facebook: "THB", ebay: "USD" }` — used in builder + `updateMarketplacePrice` + refresh point recording. `parseManualPrice` stays currency-agnostic (positive number).
- `refreshMarketplaceListing`: ebay branch — `parseEbayPrice(html, marketplace.itemId)`; statuses mirror facebook (no variant comparison): title-mismatch → no_price; identity-missing → unavailable; success → `variantMatched: true` (no variant to mismatch — flip eligible).
- `updateMarketplacePrice`: use the platform currency map instead of hardcoded THB.

- [ ] **Step 3: Tests**

Resolver (mocked render): short link → identity; render throw → error; canonical inline (no render); non-ebay never reaches the path.
Builder: ebay build (key, round-trip, USD currency, variant default); mismatch throws. Refresh: grounded fixture → updated + variantMatched true; title change → no_price.

- [ ] **Step 4: Run + check + commit**

```bash
git add server/marketplace-resolver.ts lib/marketplace.ts tests/ebay-resolver.test.ts tests/ebay-marketplace.test.ts
git commit -m "feat(ebay): resolver + builder + refresh"
```

---

### Task 4: UI labels + catalog + prefix sweep

**Files:**
- Modify: `components/search/manual-add-sheet.tsx`, `components/product/marketplace-card.tsx`, `app/search.tsx`
- Modify: `shared/src/distributors.ts`, `tests/distributors.test.ts`, `tests/agents-doc-drift.test.ts`, `AGENTS.md`, `design.md`, `docs/store-listing.md`
- Modify: `components/marketplace/facebook-search-sheet.tsx` + `components/search/facebook-results-section.tsx` (only if they enumerate platforms — verify)

- [ ] **Step 1: Platform-aware labels**

Replace the platform ternaries (28 sites) with a small helper. In `lib/marketplace.ts` (or a new `lib/marketplace/labels.ts`):

```typescript
export function marketplaceBrandName(platform: string): string {
  switch (platform) {
    case "lazada": return "Lazada";
    case "facebook": return "Facebook Marketplace";
    case "ebay": return "eBay";
    default: return "Shopee";
  }
}

export function marketplaceShortName(platform: string): string {
  switch (platform) {
    case "lazada": return "Lazada TH";
    case "facebook": return "Facebook Marketplace";
    case "ebay": return "eBay";
    default: return "Shopee TH";
  }
}
```

Sweep the ternaries in `manual-add-sheet.tsx` (5 sites), `marketplace-card.tsx` (brand + shortName + visit label + login/no_price messages), `app/search.tsx` (2 ternaries + `isEbayInput`), `facebook-search-sheet.tsx` + `facebook-results-section.tsx` (verify — they may be facebook-only already).

Currency label in the confirmation form: "Price (THB)" for shopee/lazada/facebook, "Price (USD)" for ebay — platform-aware.

- [ ] **Step 2: Catalog + counts**

`shared/src/distributors.ts` entry (after `shopee-th`/`lazada-th`):

```typescript
{
  id: "ebay-us",
  name: "eBay",
  taxMode: "origin",
  currency: "USD",
  country: "United States",
  countryCode: "US",
  region: "North America",
  website: "https://www.ebay.com",
  paymentMethods: ["Credit Card", "PayPal"],
  notes: "Marketplace — tracked per listing; browser-first checks",
},
```

Update: `tests/distributors.test.ts` 32→33; `tests/agents-doc-drift.test.ts` 32→33 + 27→28; AGENTS.md + design.md counts (33/28); store-listing (count chars first: "Track stock and prices across 33 electronics distributors. Alerts and history.").

- [ ] **Step 3: Run + check + lint + commit**

```bash
git add <changed files>
git commit -m "feat(ebay): platform-aware labels + catalog + docs"
```

---

### Task 5: Rust port + fixture + guards + verify

**Files:**
- Create: `desktop/src-tauri/src/scrapers/ebay.rs`
- Modify: `desktop/src-tauri/src/scrapers/mod.rs`, `desktop/src-tauri/src/lib.rs`
- Create: `tests/fixtures/scrapers/ebay-us.html`
- Create: `tests/ebay-guard.test.ts`, `desktop/tests/ebay-rust-guard.test.ts` (check desktop test naming first)
- Modify: `tests/scrapers/adversarial.test.ts` (exemption — cap check first, currently ≤3)
- Modify: `tests/scraping-integration.test.ts` (parser count 27→28 + match-row skip if needed)
- Modify: `todo.md` (Phase 1150)

- [ ] **Step 1: Rust port** (mirror `shopee-th.rs`/`lazada-th.rs` structure — read them first)

`split_model` on `ebay-us-`; canonical URL; `parse_html`: JSON-LD array Product extraction (serde_json; accept array or object; `@type == "Product"`; offers.price/priceCurrency/availability/itemCondition), identity guard (`/itm/{id}` in html), error-page rejection. Browser-first: `use_browser` → `fetch_with_browser(&url, None, Some(25000))`, else plain. In-file unit tests mirroring TS cases. Register `#[path = "ebay.rs"] pub mod ebay;` (alphabetical) + dispatch `"ebay-us" => scrapers::ebay::scrape(model, true).await`.

- [ ] **Step 2: Fixture + adversarial**

`tests/fixtures/scrapers/ebay-us.html` — realistic minimal page (JSON-LD array Product with THB-converted price + USD DOM price + qtyAvailability). Verify `parsePrice(fixture, "__NO_SUCH_MODEL__")` → null and `parsePrice(fixture, "ebay-us-178212205608")` → price. Adversarial exemption for `ebay-us` (identity-keyed) — check the cap (≤3; bump to 4 with justification comment if needed).

- [ ] **Step 3: Guards**

`tests/ebay-guard.test.ts`: registry contains ebayParser; card brands eBay; `isMarketplaceKey` covers `ebay-us-`; catalog has ebay-us; resolver mentions `ebay.io`; `isAutomaticProduct` false for manual ebay. Desktop parity test: `ebay.rs` exists + dispatch arm present.

- [ ] **Step 4: Full verify**

Targeted tests → `pnpm check && pnpm lint` → `pnpm verify` (`CARGO_NET_OFFLINE=true` if cargo stalls; exit 0; fix in-scope, BLOCKED otherwise). Live re-check: `resolveMarketplaceLink("https://ebay.io/m/CV7fAk")` returns the MikroTik identity.

- [ ] **Step 5: todo.md + commit**

Phase 1150 entry + commit guards/todo (Rust port may be its own commit).

---

## Self-Review

**Spec coverage:**
- ✅ Identity + recognition (Task 1)
- ✅ Resolver short-link via headed render (Task 3)
- ✅ Extractor JSON-LD primary + identity guard (Task 2)
- ✅ Parser browser-first (Task 2)
- ✅ Auto-flip without variant (Task 3 — variantMatched true on identity+price)
- ✅ Currency: observed currency stored; USD at build (Task 3)
- ✅ Labels + catalog + docs (Task 4)
- ✅ Rust + fixture + guards (Task 5)
- ✅ Multi-variation listings out of scope (recognition only accepts bare/slug item URLs)

**Placeholder scan:** None — grounding evidence embedded; Task 5 requires checking conventions first.

**Type consistency:** `EbayIdentity`, `ebay-us-{itemId}`, `parseEbayPrice(html, itemId)`, `ebayParser`, `marketplaceBrandName/ShortName` used consistently.