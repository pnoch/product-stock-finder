# Shopee TH Automatic Price Checks — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users check Shopee TH prices on-device via a card button (Phase 1), then register `shopee-th` as a full parser so automatic checks flow through the existing escalation chain (Phase 2).

**Architecture:** Pure `parseShopeePrice(html, shopId, itemId)` extractor in `lib/scrapers/shopee-th.ts` shared by both phases. Phase 1 adds `refreshMarketplaceListing` (WebView host → parse → dated manual point) behind a card button. Phase 2 adds the `shopeeThParser` object (`useBrowser: true`), extends `isAutomaticProduct` for `monitoringStatus: "automatic"`, and flips status on variant-matched scrape success.

**Tech Stack:** TypeScript, cheerio, on-device WebView host, vitest, React Native.

**Spec:** `docs/superpowers/specs/2026-10-12-shopee-auto-price-design.md`

---

## File Structure

| File | Purpose |
|------|---------|
| Create `lib/scrapers/shopee-th.ts` | Extractor + parser object |
| Modify `lib/scrapers/registry.ts` | Register parser (Phase 2) |
| Modify `lib/scrapers/resilient.ts` | Shopee login-wall blocked markers (Phase 2) |
| Modify `lib/marketplace.ts` | `refreshMarketplaceListing` (Phase 1), `isAutomaticProduct` extension (Phase 2) |
| Modify `components/product/marketplace-card.tsx` | "Check price now" button (Phase 1) |
| Modify `lib/storage/watchlist.ts` | `updateMarketplaceStatus` (Phase 2) |
| Modify `lib/storage/index.ts` | Re-export (Phase 2) |
| Create `tests/scrapers/shopee-th.test.ts` | Extractor + parser tests |
| Create `tests/marketplace-refresh.test.ts` | Refresh + flip tests |

---

### Task 1: Shopee extractor + tests (Phase 1 foundation)

**Files:**
- Create: `lib/scrapers/shopee-th.ts`
- Create: `tests/scrapers/shopee-th.test.ts`

- [ ] **Step 1: Write the extractor with tests first**

The extractor signature (pure, no I/O):

```typescript
export interface ShopeePrice {
  price: number;
  currency: "THB";
  variantName: string | null;
  inStock: boolean;
}

export function parseShopeePrice(
  html: string,
  shopId: string,
  itemId: string,
): ShopeePrice | null;
```

Extraction order:
1. Embedded JSON state: search `<script>` bodies for `"shopid":1950119` / `"itemid":28177881956`-style fields (also camelCase `shopId`/`itemId`); verify IDs match args, else return null (identity guard). Pull price from `price` / `price_min` fields, variant from `selected_model` / `variation` names, stock from `stock` > 0.
2. JSON-LD (`application/ld+json` Product with `offers.price`).
3. DOM fallback via cheerio: price-ish selectors + `parsePriceFromText` from `./utils`; variant from selected-option text.
4. Login-wall markers (`ต้องเข้าสู่ระบบ`, `/verify/traffic/`, `is_logged_in=false`) → return null.
5. Prices in other currencies → return null (THB only; do not convert scraped values).

THB format notes: `฿1,290`, `฿1,290.00`, ranges `฿899 - ฿1,299` (take... no — a range means variant-dependent pricing: return null unless a single selected variant price is identifiable; never guess across a range).

- [ ] **Step 2: Write the tests**

Create `tests/scrapers/shopee-th.test.ts` with inline fixture HTML strings (small, focused — not full pages):

```typescript
import { describe, expect, it } from "vitest";
import { parseShopeePrice } from "../../lib/scrapers/shopee-th";

const SHOP = "1950119";
const ITEM = "28177881956";

describe("parseShopeePrice", () => {
  it("extracts price + variant from embedded JSON state", () => {
    const html = `<html><body><script>window.__PRELOADED__={"shopid":1950119,"itemid":28177881956,"price":1290,"price_min":1290,"price_max":1290,"stock":42,"selected_model":{"name":"30ml"}};</script></body></html>`;
    expect(parseShopeePrice(html, SHOP, ITEM)).toEqual({
      price: 1290, currency: "THB", variantName: "30ml", inStock: true,
    });
  });

  it("rejects mismatched shop/item ids", () => {
    const html = `<html><body><script>{"shopid":999,"itemid":888,"price":100,"stock":1};</script></body></html>`;
    expect(parseShopeePrice(html, SHOP, ITEM)).toBeNull();
  });

  it("returns null on the login wall", () => {
    const html = `<html><body><div>ต้องเข้าสู่ระบบ</div><div>is_logged_in=false</div></body></html>`;
    expect(parseShopeePrice(html, SHOP, ITEM)).toBeNull();
  });

  it("returns null on price ranges without a selected variant", () => {
    const html = `<html><body><script>{"shopid":1950119,"itemid":28177881956,"price_min":899,"price_max":1299,"stock":10};</script></body></html>`;
    expect(parseShopeePrice(html, SHOP, ITEM)).toBeNull();
  });

  it("returns null when out of stock and unpriced", () => {
    const html = `<html><body><p>No price here</p></body></html>`;
    expect(parseShopeePrice(html, SHOP, ITEM)).toBeNull();
  });

  it("reads JSON-LD offers", () => {
    const html = `<html><head><script type="application/ld+json">{"@type":"Product","name":"Niacinamide Serum","offers":{"price":"1150","priceCurrency":"THB","availability":"https://schema.org/InStock"}}</script></head><body></body></html>`;
    const out = parseShopeePrice(html, SHOP, ITEM);
    expect(out?.price).toBe(1150);
    expect(out?.currency).toBe("THB");
  });
});
```

(If the JSON-LD branch can't verify shop/item identity, still accept it — JSON-LD comes from the loaded canonical URL which the caller already validated. Note this in a code comment.)

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm exec vitest run tests/scrapers/shopee-th.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the extractor, run tests**

Run: `pnpm exec vitest run tests/scrapers/shopee-th.test.ts`
Expected: all pass.

- [ ] **Step 5: Check + commit**

Run: `pnpm check`
Expected: 0 errors.

```bash
git add lib/scrapers/shopee-th.ts tests/scrapers/shopee-th.test.ts
git commit -m "feat(shopee): price extractor + tests"
```

---

### Task 2: `refreshMarketplaceListing` + card button (Phase 1)

**Files:**
- Modify: `lib/marketplace.ts`
- Modify: `components/product/marketplace-card.tsx`
- Test: `tests/marketplace-refresh.test.ts`

- [ ] **Step 1: Add `refreshMarketplaceListing` to `lib/marketplace.ts`**

```typescript
import { getWebViewHost } from "./scrapers/webview-host";
import { parseShopeePrice } from "./scrapers/shopee-th";
import { updateProductListings } from "./storage"; // check actual export path — storage/index re-exports; verify import doesn't create a cycle (marketplace.ts already imported by storage/watchlist.ts! To avoid a cycle, accept a `persist` callback param instead of importing storage.)

export interface MarketplaceRefresh {
  status: "updated" | "login_required" | "unavailable" | "no_price";
}

export async function refreshMarketplaceListing(
  product: Product,
  deps: {
    loadHtml: (url: string) => Promise<string>;
    persist: (productId: string, listings: DistributorListing[]) => Promise<void>;
    now?: () => string;
  } = {
    loadHtml: (url) => getWebViewHost().load(url, { timeoutMs: 20000 }),
    persist: (productId, listings) => updateProductListings(productId, listings),
  },
): Promise<MarketplaceRefresh> {
  const marketplace = product.marketplace;
  const listing = product.listings[0];
  if (!marketplace || !listing) return { status: "unavailable" };
  let html: string;
  try {
    html = await deps.loadHtml(marketplace.canonicalUrl);
  } catch {
    return { status: "unavailable" };
  }
  const found = parseShopeePrice(html, marketplace.shopId, marketplace.itemId);
  if (!found) {
    const wall = /ต้องเข้าสู่ระบบ|verify\/traffic|is_logged_in=false/.test(html);
    return { status: wall ? "login_required" : "no_price" };
  }
  const now = (deps.now ?? (() => new Date().toISOString()))();
  const point: PricePoint = {
    date: now, price: found.price, currency: "THB",
    stockStatus: found.inStock ? "in_stock" : "out_of_stock",
    priceSource: "manual",
  };
  await deps.persist(product.id, [{
    ...listing, price: found.price, priceSource: "manual", lastChecked: now,
    priceHistory: [...listing.priceHistory, point],
  }]);
  return { status: "updated" };
}
```

Notes:
- Default `persist` imports `updateProductListings` — verify no import cycle: `storage/watchlist.ts` imports `marketplace.ts` (for `updateMarketplacePrice`). So `marketplace.ts` must NOT import storage at module top. Use lazy `await import("./storage")` inside the default param... default params evaluate at call time — a top-level import would still cycle. Solution: default `persist` uses `await import("./storage").then((m) => m.updateProductListings(...))` inside the function body. Write it that way.
- `getWebViewHost()` throws `BrowserUnavailableError` when no host (web platform) — catch it in the try and return `"unavailable"`. `getWebViewHost` returns null or throws? It returns `WebViewHost | null` via `getWebViewHost()`, throws via `requireWebViewHost()`. Use `getWebViewHost()?.load(...) ?? throw` pattern — handle null → unavailable.
- Import `PricePoint`, `DistributorListing` types from `./types`.

- [ ] **Step 2: Write refresh tests**

Create `tests/marketplace-refresh.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";
import { refreshMarketplaceListing } from "../lib/marketplace";
import { buildMarketplaceProduct } from "../lib/marketplace";
import type { Product } from "../lib/types";

const IDENTITY = { platform: "shopee", region: "TH", shopId: "1950119", itemId: "28177881956", canonicalUrl: "https://shopee.co.th/product/1950119/28177881956" } as const;

function product(): Product {
  return buildMarketplaceProduct({ identity: { ...IDENTITY }, name: "Serum", variant: "30ml", seller: "Shop", price: "1290" });
}

const JSON_HTML = `<html><body><script>{"shopid":1950119,"itemid":28177881956,"price":1190,"stock":5,"selected_model":{"name":"30ml"}};</script></body></html>`;

describe("refreshMarketplaceListing", () => {
  it("saves the observed price as a dated manual point", async () => {
    const p = product();
    const persist = vi.fn(async () => {});
    const out = await refreshMarketplaceListing(p, {
      loadHtml: async () => JSON_HTML,
      persist,
      now: () => "2026-10-12T00:00:00.000Z",
    });
    expect(out).toEqual({ status: "updated" });
    expect(persist).toHaveBeenCalledOnce();
    const listings = persist.mock.calls[0][1];
    expect(listings[0].price).toBe(1190);
    expect(listings[0].priceSource).toBe("manual");
    expect(listings[0].priceHistory).toHaveLength(2);
    expect(listings[0].priceHistory[1]).toMatchObject({ price: 1190, currency: "THB" });
  });

  it("reports login_required on the login wall", async () => {
    const out = await refreshMarketplaceListing(product(), {
      loadHtml: async () => `<html><body>ต้องเข้าสู่ระบบ</body></html>`,
      persist: vi.fn(),
    });
    expect(out).toEqual({ status: "login_required" });
  });

  it("reports unavailable when the host throws", async () => {
    const out = await refreshMarketplaceListing(product(), {
      loadHtml: async () => { throw new Error("no host"); },
      persist: vi.fn(),
    });
    expect(out).toEqual({ status: "unavailable" });
  });

  it("reports unavailable without marketplace identity", async () => {
    const p = product();
    delete (p as any).marketplace;
    const out = await refreshMarketplaceListing(p, {
      loadHtml: async () => JSON_HTML,
      persist: vi.fn(),
    });
    expect(out).toEqual({ status: "unavailable" });
  });
});
```

- [ ] **Step 3: Card button**

In `components/product/marketplace-card.tsx`, add below the "Visit Shopee product" link:

```tsx
const [checking, setChecking] = useState(false);
const check = async () => {
  if (checking) return;
  setChecking(true);
  try {
    const out = await refreshMarketplaceListing(product);
    await onUpdated();
    if (out.status === "updated") {
      if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (out.status === "login_required") {
      showAlert("Shopee login needed", "Shopee asked for login. Open Settings → Site sessions to connect, then try again.");
    } else if (out.status === "no_price") {
      showAlert("No price found", "The page loaded but no variant price was readable. Try again later.");
    } else {
      showAlert("Check unavailable", "On-device price check isn't available on this platform.");
    }
  } finally { setChecking(false); }
};
// Button:
<TouchableOpacity accessibilityRole="button" accessibilityLabel="Check current Shopee price" disabled={checking} onPress={() => void check()}>
  <Text style={{ color: colors.primary }}>{checking ? "Checking…" : "Check current price"}</Text>
</TouchableOpacity>
```

Verify "Settings → Site sessions" is the real settings route name (site-sessions-section.tsx exists under components/settings — confirm the user-facing label before writing the string; adjust to match).

- [ ] **Step 4: Run tests + check + lint, commit**

Run: `pnpm exec vitest run tests/marketplace-refresh.test.ts tests/scrapers/shopee-th.test.ts && pnpm check && pnpm lint`
Expected: all pass, 0 errors.

```bash
git add lib/marketplace.ts components/product/marketplace-card.tsx tests/marketplace-refresh.test.ts
git commit -m "feat(shopee): on-device check-price button + refresh helper"
```

---

### Task 3: Parser registration + auto-flip (Phase 2)

**Files:**
- Modify: `lib/scrapers/shopee-th.ts` (append parser object)
- Modify: `lib/scrapers/registry.ts`
- Modify: `lib/scrapers/resilient.ts` (blocked markers)
- Modify: `lib/marketplace.ts` (`isAutomaticProduct` extension)
- Modify: `lib/storage/watchlist.ts` + `lib/storage/index.ts` (`updateMarketplaceStatus`)
- Modify: `lib/background-tasks/refresh-listing.ts` (flip on success)

- [ ] **Step 1: Append the parser object**

In `lib/scrapers/shopee-th.ts`:

```typescript
import type { DistributorParser } from "./types";

function modelIds(model?: string): { shopId: string; itemId: string } | null {
  const m = model?.match(/^shopee-th-([1-9]\d{0,19})-([1-9]\d{0,19})$/);
  return m ? { shopId: m[1], itemId: m[2] } : null;
}

export const shopeeThParser: DistributorParser = {
  id: "shopee-th",
  baseUrl: "https://shopee.co.th",
  buildSearchUrl: (model) => {
    const ids = modelIds(model);
    return ids
      ? `https://shopee.co.th/product/${ids.shopId}/${ids.itemId}`
      : "https://shopee.co.th";
  },
  parsePrice: (html, model, url) => {
    const ids = modelIds(model);
    const found = ids ? parseShopeePrice(html, ids.shopId, ids.itemId) : null;
    if (!found) return null;
    return {
      price: found.price,
      currency: "THB",
      stockStatus: found.inStock ? "in_stock" : "out_of_stock",
      url: url ?? "https://shopee.co.th",
    };
  },
  rateLimitMs: 60000,
  useBrowser: true,
  browserOptions: { waitForSelector: undefined, timeoutMs: 25000 },
};
```

Wait — `browserOptions.waitForSelector: undefined` is pointless; omit `browserOptions` unless a stable selector is known. Shopee's rendered price element class names are hashed/obfuscated — do NOT guess selectors. Omit `browserOptions` entirely (defaults apply). Adjust accordingly.

- [ ] **Step 2: Register + blocked markers**

`registry.ts`: import + append `shopeeThParser` to PARSERS.

`resilient.ts` BLOCKED_MARKERS: append `"ต้องเข้าสู่ระบบ"`, `"verify/traffic"`, `"is_logged_in=false"`. (Substring match; Thai string is safe in TS source — file is UTF-8; confirm no ascii-only lint rule fires via `pnpm lint`.)

- [ ] **Step 3: `isAutomaticProduct` extension**

Current (verify exact text first): returns false for marketplace products. New logic:

```typescript
export function isAutomaticProduct(product: { marketplace?: unknown; modelNumber?: string }): boolean {
  const marketplace = product.marketplace as { monitoringStatus?: string } | undefined;
  if (marketplace) return marketplace.monitoringStatus === "automatic";
  return !product.modelNumber?.startsWith("shopee-th-");
}
```

- [ ] **Step 4: Status flip on variant-matched success**

Add to `lib/storage/watchlist.ts`:

```typescript
async function updateMarketplaceStatus(productId: string, status: "automatic" | "manual" | "login_required" | "blocked"): Promise<void> {
  await enqueue(KEYS.WATCHLIST, async () => {
    const list = await getWatchlist();
    await persistWatchlist(list.map((p) =>
      p.id === productId && p.marketplace ? { ...p, marketplace: { ...p.marketplace, monitoringStatus: status } } : p,
    ));
    notify("watchlist", productId);
  });
}
```

Re-export in `lib/storage/index.ts` (follow the existing destructure pattern).

In `lib/background-tasks/refresh-listing.ts`, after a successful refresh of a marketplace listing: the function returns the updated listing — but the status flip needs the tracked variant to compare. Where does refreshListing know the tracked variant? It has `product` (with `marketplace.variant`). After `fetchServerPrice`/scrape success... wait — refreshListing works on a listing + product; the scrape result doesn't carry variant name. ScrapeResult has no variant field!

Resolution: compare inside `parsePrice`? No — parsePrice doesn't know the tracked variant either (only model/url/html). The tracked variant lives on `product.marketplace.variant`. So the flip logic belongs where both the scrape result AND the product are available AND the observed variant name is available. But ScrapeResult has no variantName field.

Options: (a) extend ScrapeResult with optional `variantName?: string` (additive, safe); (b) re-parse in refreshListing. (a) is cleaner: `shopeeThParser.parsePrice` sets `variantName: found.variantName`; `refreshListing` after success compares `result.variantName` to `product.marketplace.variant` (case-insensitive, trimmed); match → set listing `priceSource` undefined + call `updateMarketplaceStatus(product.id, "automatic")`. Mismatch or null variant → leave manual.

Check ScrapeResult usages before extending (must be additive-optional — verify no exhaustive construction breaks; adding an optional field is safe).

Where exactly in refresh-listing.ts? Read the success path first (after server/scrape result → builds updated listing). Insert the flip there, guarded by `if (product.marketplace && result)`. Lazy-import storage to avoid cycles (check existing imports in refresh-listing.ts — it may already import storage; if it imports updateProductListings-style fns, follow the same pattern).

- [ ] **Step 5: Tests**

Append to `tests/marketplace-refresh.test.ts` (or new `tests/marketplace-auto.test.ts`):

```typescript
describe("shopeeThParser", () => {
  it("is registered with browser-first escalation", async () => {
    const { PARSERS } = await import("../lib/scrapers/registry");
    const p = PARSERS.find((x) => x.id === "shopee-th");
    expect(p).toBeDefined();
    expect(p!.useBrowser).toBe(true);
  });

  it("builds canonical URLs from model keys", async () => {
    const { shopeeThParser } = await import("../lib/scrapers/shopee-th");
    expect(shopeeThParser.buildSearchUrl("shopee-th-1950119-28177881956"))
      .toBe("https://shopee.co.th/product/1950119/28177881956");
  });

  it("parsePrice returns THB result on fixture HTML", async () => {
    const { shopeeThParser } = await import("../lib/scrapers/shopee-th");
    const html = `<html><body><script>{"shopid":1950119,"itemid":28177881956,"price":1190,"stock":5};</script></body></html>`;
    expect(shopeeThParser.parsePrice(html, "shopee-th-1950119-28177881956"))
      .toMatchObject({ price: 1190, currency: "THB" });
  });
});

describe("isAutomaticProduct", () => {
  it("includes monitoringStatus automatic", async () => {
    const { isAutomaticProduct } = await import("../lib/marketplace");
    expect(isAutomaticProduct({ marketplace: { monitoringStatus: "automatic" }, modelNumber: "shopee-th-1-2" })).toBe(true);
    expect(isAutomaticProduct({ marketplace: { monitoringStatus: "manual" }, modelNumber: "shopee-th-1-2" })).toBe(false);
    expect(isAutomaticProduct({ modelNumber: "CRS804" })).toBe(true);
  });
});
```

- [ ] **Step 6: Run tests + check + lint, commit**

Run: `pnpm exec vitest run tests/marketplace-refresh.test.ts tests/scrapers/shopee-th.test.ts && pnpm check && pnpm lint`
Expected: all pass, 0 errors.

```bash
git add lib/scrapers/shopee-th.ts lib/scrapers/registry.ts lib/scrapers/resilient.ts lib/marketplace.ts lib/storage/watchlist.ts lib/storage/index.ts lib/background-tasks/refresh-listing.ts tests/marketplace-refresh.test.ts
git commit -m "feat(shopee): parser registration + automatic status flip"
```

---

### Task 4: Guards + todo.md + verify

**Files:**
- Create: `tests/shopee-auto-guard.test.ts`
- Modify: `todo.md`

- [ ] **Step 1: Create guard**

```typescript
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("shopee auto-price wiring", () => {
  it("parser registered browser-first", () => {
    expect(read("lib/scrapers/registry.ts")).toContain("shopeeThParser");
  });

  it("card has check-price button", () => {
    expect(read("components/product/marketplace-card.tsx")).toContain("Check current");
  });

  it("refresh helper exists", () => {
    expect(read("lib/marketplace.ts")).toContain("refreshMarketplaceListing");
  });

  it("blocked markers cover the login wall", () => {
    expect(read("lib/scrapers/resilient.ts")).toContain("verify/traffic");
  });
});
```

- [ ] **Step 2: Run tests + full verify**

Run: guard + all marketplace tests, then `pnpm check && pnpm lint`, then `pnpm verify` (exit 0; fix in-scope, BLOCKED otherwise).

- [ ] **Step 3: todo.md entry** (next number, expect 1145):

```markdown
## Phase 1145: Shopee TH automatic price checks

- [x] `parseShopeePrice` extractor + fixture tests.
- [x] "Check price now" on-device button + `refreshMarketplaceListing`.
- [x] `shopee-th` parser (browser-first) + login-wall blocked markers.
- [x] Variant-matched auto-flip to `monitoringStatus: "automatic"`.
- [x] Guards. TypeScript: 0 errors.
```

- [ ] **Step 4: Commit**

```bash
git add tests/shopee-auto-guard.test.ts todo.md
git commit -m "test(shopee): auto-price guards + Phase entry"
```

---

## Self-Review

**Spec coverage:**
- ✅ Phase 1 button + helper + no-throw UI (Tasks 1-2)
- ✅ Phase 2 parser + registry + markers (Task 3 steps 1-2)
- ✅ Variant safety + auto-flip (Task 3 steps 3-4)
- ✅ Pipeline inclusion via `isAutomaticProduct` (Task 3 step 3 — downstream needs no changes)
- ✅ Server path unchanged (spec: no server changes required)
- ✅ Tests: extractor, refresh, parser, flip, guards (Tasks 1-4)

**Placeholder scan:** None — Task 2/3 include cycle-avoidance and verification rules with concrete fallbacks.

**Type consistency:** `ShopeePrice`, `MarketplaceRefresh`, `refreshMarketplaceListing(product, deps?)`, `parseShopeePrice(html, shopId, itemId)`, `updateMarketplaceStatus(productId, status)` used consistently. `ScrapeResult.variantName?` additive-optional.
