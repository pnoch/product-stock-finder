# Facebook Marketplace Tracking — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import Facebook Marketplace item/share links as manual-monitoring THB listings, and add a Facebook Marketplace search source in Discover that opens results in the on-device WebView for browsing/selection.

**Architecture:** `FacebookIdentity` joins the marketplace union; a server resolver resolves share links via a bounded headed-browser render (identity only, no price); the confirmation form gains a market selector (TH/THB fixed for v1); the MarketplaceCard gains a "Check price" action that loads the item in the on-device WebView and saves a verified observation; Discover gains a Facebook section that opens `facebook.com/marketplace/search?query=...` in the WebView with keyword/location/radius. No background checks, no Rust parser, no global price cache.

**Tech Stack:** TypeScript, Expo Router, tRPC, Patchright (server, headed under Xvfb), on-device WebView host, vitest.

**Spec:** `docs/superpowers/specs/2026-10-12-facebook-marketplace-design.md`

---

## File Structure

| File | Purpose |
|------|---------|
| Modify `shared/marketplace-url.ts` | `FacebookIdentity`, recognition, messages |
| Modify `server/marketplace-resolver.ts` | Facebook share-link resolution (browser render) |
| Modify `server/routers/products.ts` | No change (same endpoint) — verify |
| Modify `lib/marketplace.ts` | Builder/refresh branches for facebook |
| Modify `lib/types.ts` | (already union via shared) — verify only |
| Modify `components/search/manual-add-sheet.tsx` | FB labels + market field |
| Modify `app/search.tsx` | FB link labels |
| Modify `components/product/marketplace-card.tsx` | FB branding + check action |
| Create `components/marketplace/facebook-search-sheet.tsx` | Discover FB search sheet |
| Modify `components/home/discover`-equivalent (`app/(tabs)/discover.tsx`) | FB search entry |
| Create `tests/facebook-marketplace.test.ts` | Recognition + builder + refresh tests |
| Create `tests/facebook-resolver.test.ts` | Resolver tests (mocked browser) |
| Create `tests/facebook-guard.test.ts` | Wiring guards |
| Modify `todo.md` | Phase 1147 |

---

### Task 1: Identity + recognition + tests

**Files:**
- Modify: `shared/marketplace-url.ts`
- Test: `tests/facebook-marketplace.test.ts` (create; move FB tests here later — Task 1 creates the file)

- [ ] **Step 1: Read current recognition**

Read `shared/marketplace-url.ts` fully (Shopee/Lazada patterns, `MarketplaceUrl` kinds, `isShopeeInput`/`isLazadaInput`/`isMarketplaceInput`, `marketplaceResolutionMessage` platform param).

- [ ] **Step 2: Add FacebookIdentity + recognition**

```typescript
export interface FacebookIdentity {
  platform: "facebook";
  itemId: string; // digits, no leading zero
  canonicalUrl: string; // https://www.facebook.com/marketplace/item/{itemId}/
}

export type MarketplaceIdentity = ShopeeIdentity | LazadaIdentity | FacebookIdentity;
```

Recognition (extend `parseMarketplaceUrl`):
- Canonical: `https://www.facebook.com/marketplace/item/{digits}/` (also `web.facebook.com` host, optional query params stripped). itemId: `[1-9]\d{0,19}`. → `{ kind: "product", identity }`.
- Share: `https://www.facebook.com/share/{token}/` (token alnum 5-32) → `{ kind: "short_link", url }` (mirror Lazada short shape; resolver resolves).
- Reject: other facebook hosts (`m.facebook.com`, `fb.watch`, `facebook.com` non-marketplace/share paths), non-HTTPS, creds/ports (existing guard), `/marketplace` category/browse URLs without `/item/`.

`isFacebookInput(raw)` + extend `isMarketplaceInput`. `marketplaceResolutionMessage`: facebook variants ("Facebook Marketplace link import …", `unresolved` → "copy the individual Marketplace item link").

- [ ] **Step 3: Tests** (`tests/facebook-marketplace.test.ts`)

```typescript
import { describe, expect, it } from "vitest";
import { isFacebookInput, isMarketplaceInput, parseMarketplaceUrl } from "../shared/marketplace-url";

describe("facebook url recognition", () => {
  it("recognizes canonical item urls and strips tracking", () => {
    expect(parseMarketplaceUrl("https://www.facebook.com/marketplace/item/2556068711502321/?rdid=x")).toEqual({
      kind: "product",
      identity: { platform: "facebook", itemId: "2556068711502321", canonicalUrl: "https://www.facebook.com/marketplace/item/2556068711502321/" },
    });
  });

  it("accepts web.facebook.com host", () => {
    const out = parseMarketplaceUrl("https://web.facebook.com/marketplace/item/123/");
    expect(out.kind).toBe("product");
  });

  it("recognizes share links as short_link", () => {
    expect(parseMarketplaceUrl("https://www.facebook.com/share/1DRTMqB7bR/")).toEqual({
      kind: "short_link", url: "https://www.facebook.com/share/1DRTMqB7bR/",
    });
  });

  it("rejects category/browse urls, other hosts, leading zeros, non-https", () => {
    expect(parseMarketplaceUrl("https://www.facebook.com/marketplace/category/electronics/").kind).not.toBe("product");
    expect(parseMarketplaceUrl("https://m.facebook.com/marketplace/item/123/").kind).not.toBe("product");
    expect(parseMarketplaceUrl("https://www.facebook.com/marketplace/item/0123/").kind).not.toBe("product");
    expect(parseMarketplaceUrl("http://www.facebook.com/marketplace/item/123/").kind).not.toBe("product");
  });

  it("input detectors", () => {
    expect(isFacebookInput("https://www.facebook.com/share/abc/")).toBe(true);
    expect(isMarketplaceInput("https://www.facebook.com/marketplace/item/1/")).toBe(true);
    expect(isMarketplaceInput("https://shopee.co.th/product/1/2")).toBe(true);
    expect(isMarketplaceInput("https://example.com")).toBe(false);
  });
});
```

- [ ] **Step 4: Run + check + commit**

`pnpm exec vitest run tests/facebook-marketplace.test.ts && pnpm check && pnpm lint`

```bash
git add shared/marketplace-url.ts tests/facebook-marketplace.test.ts
git commit -m "feat(fbmp): identity + URL recognition"
```

---

### Task 2: Server share-link resolution (browser render, identity only)

**Files:**
- Modify: `server/marketplace-resolver.ts`
- Test: `tests/facebook-resolver.test.ts` (create)

- [ ] **Step 1: Read the resolver flow**

Read `server/marketplace-resolver.ts` fully (redirect loop, `fetchPinned`, `readCapped`, `LANDING_HTML_CAP`, deps injection shape used by tests).

- [ ] **Step 2: Add Facebook resolution**

Add to the resolver (same `resolveMarketplaceLink` entry, same deps injection):

```typescript
const FB_SHARE_HOST = "www.facebook.com";
const FB_RENDER_TIMEOUT_MS = 20_000;

export interface FacebookRenderDeps {
  renderHtml: (url: string) => Promise<string>; // headed browser render
}

// Extracts the marketplace item id from a rendered share-link page.
export function parseFacebookShareRender(html: string): string | null {
  const m =
    html.match(/marketplace\/item\/([1-9]\d{0,19})/) ??
    html.match(/"item_id"\s*:\s*"?([1-9]\d{0,19})"?/);
  return m ? m[1]! : null;
}
```

In `resolveMarketplaceLink`: when input parses as facebook `short_link`, resolve via injected `renderHtml` (default: lazy-import a new `renderWithBrowser` helper in `server/browser.ts` — check whether `server/prices.ts` already exposes a headed render entry (`PSF_BROWSER_HEADED` path) and reuse it; do NOT duplicate Playwright launch code). Flow:
1. `renderHtml(shareUrl)` — bounded by `FB_RENDER_TIMEOUT_MS`.
2. `parseFacebookShareRender(html)` → itemId; null → `{ kind: "error", reason: "unresolved" }`.
3. Validate final URL host is `www.facebook.com`/`web.facebook.com` and path is `/marketplace/item/{id}/` matching the extracted id (defense in depth).
4. Return `{ kind: "product", identity: { platform: "facebook", itemId, canonicalUrl: `https://www.facebook.com/marketplace/item/${itemId}/` } }`.
5. Canonical FB item URLs validate inline (no fetch, no render).
6. Rate limit/budget: reuse the existing `products.resolveMarketplace` bucket + `tryConsumeBudget("products.parseUrl")` (browser render is expensive — keep the same budget key; note this in the report).

- [ ] **Step 3: Tests** (`tests/facebook-resolver.test.ts`)

Mock `renderHtml` at the boundary (mirror existing resolver tests' deps style):
- share link + rendered page containing item URL → product identity.
- rendered login page (no item id) → `{ kind: "error", reason: "unresolved" }`.
- render throws/timeout → error, never throws.
- canonical item URL → inline validation, no render call (assert renderHtml not called).
- non-facebook URL → never reaches the FB path.

- [ ] **Step 4: Run + check + commit**

`pnpm exec vitest run tests/facebook-resolver.test.ts && pnpm check`

```bash
git add server/marketplace-resolver.ts tests/facebook-resolver.test.ts
git commit -m "feat(fbmp): share-link resolution via bounded browser render"
```

---

### Task 3: Builder + refresh + confirmation form

**Files:**
- Modify: `lib/marketplace.ts`
- Modify: `components/search/manual-add-sheet.tsx`
- Modify: `app/search.tsx` (labels only)
- Test: `tests/facebook-marketplace.test.ts` (append)

- [ ] **Step 1: Generalize builder + refresh for facebook**

In `lib/marketplace.ts`:
- `buildMarketplaceProduct`: accept `FacebookIdentity` — key `fbmp-{itemId}`, distributorId = key, round-trip check via `parseMarketplaceUrl(canonicalUrl)`. Currency/market: v1 fixes TH/THB — but the spec says store market as listing metadata, not identity. Simplest honest v1: the confirmation form requires the user to confirm "Thailand · THB" (fixed choice, single option); builder stores it implicitly via THB price + existing fields. No new type fields. (Note this in the report.)
- `refreshMarketplaceListing`: facebook branch — load `canonicalUrl` via WebView host (same lazy default), parse with a new `parseFacebookPrice` (see Step 2), statuses: `updated` | `login_required` (login markers) | `unavailable` | `no_price`. Title verification: compare observed title against `product.name` (case-insensitive, whitespace-normalized); mismatch → `{ status: "no_price" }` + card message "Listing changed — reconfirm". (Keep it simple: no new status kind; reuse `no_price` with distinct message.)

- [ ] **Step 2: `parseFacebookPrice`** (in `lib/marketplace.ts` or `lib/scrapers/facebook.ts` — prefer the latter for symmetry; create `lib/scrapers/facebook.ts`)

```typescript
export interface FacebookPrice {
  price: number;
  currency: "THB";
  title: string | null;
  inStock: boolean | null; // null = unknown availability
}

export function parseFacebookPrice(html: string, itemId: string): FacebookPrice | null {
  // Identity guard: page must reference our item.
  if (!html.includes(`/marketplace/item/${itemId}`) && !html.includes(`"item_id":"${itemId}"`)) return null;
  // Login wall.
  if (/log in or sign up|you must log in|login/i.test(html.slice(0, 4000))) return null;
  // Price: item JSON "price" fields (formatted string like "฿237,290" or amount+currency).
  // Ground this against a real signed-in render before finalizing (Task 6 live check).
  const m = html.match(/"price"\s*:\s*"?฿?([\d,]+(?:\.\d{1,2})?)"?/);
  if (!m) return null;
  const price = Number(m[1]!.replace(/,/g, ""));
  if (!Number.isFinite(price) || price <= 0) return null;
  const title = html.match(/"marketplace_listing_title"\s*:\s*"([^"]{1,300})"/)?.[1] ?? null;
  const sold = /listing.*sold|mark as sold|no longer available/i.test(html);
  return { price, currency: "THB", title, inStock: sold ? false : null };
}
```

**Grounding requirement:** before committing, render the real share link once with the server headed browser (the Task 2 render path) and grep the actual price/title JSON spellings; adjust regexes to reality. If the anonymous render shows no price (login wall — expected), keep the regexes as best-effort grounded on JSON field names visible in the rendered HTML (`marketplace_listing_title` etc.) and mark Task 6's live check as the final gate.

- [ ] **Step 3: Confirmation form**

`manual-add-sheet.tsx`:
- FB branch in `handleMarketplaceParse`: same flow, labels "Facebook Marketplace link import".
- Market field: single fixed row "Thailand · THB" (static text, not a picker — v1 scope).
- Draft modelNumber: `fbmp-{itemId}`.
- `canAdd` unchanged (name/variant/seller/price) — variant label for FB: "Condition or note (optional)"? NO — keep required variant for consistency? Spec says no variant field for FB. Make variant optional for FB (empty allowed → builder stores variant as "Single option" — check how Shopee handles single-option; mirror it).

- [ ] **Step 4: Labels in `app/search.tsx`** — extend existing ternaries with `isFacebookInput`.

- [ ] **Step 5: Tests + check + commit**

Append builder/refresh/price tests to `tests/facebook-marketplace.test.ts` (identity round-trip, fbmp- key, login wall → login_required, title mismatch → no_price, price extraction).

`pnpm exec vitest run tests/facebook-marketplace.test.ts && pnpm check && pnpm lint`

```bash
git add lib/marketplace.ts lib/scrapers/facebook.ts components/search/manual-add-sheet.tsx app/search.tsx tests/facebook-marketplace.test.ts
git commit -m "feat(fbmp): builder + refresh + confirmation form"
```

---

### Task 4: MarketplaceCard check action + branding

**Files:**
- Modify: `components/product/marketplace-card.tsx`
- Test: `tests/facebook-marketplace.test.ts` (append card-level if needed) — guards in Task 5 cover wiring

- [ ] **Step 1: Platform branding + FB check action**

- Header: `platform === "facebook" ? "Facebook Marketplace" : platform === "lazada" ? "Lazada TH" : "Shopee TH"`.
- Visit link label: "Open Facebook listing" for FB.
- Check button: same `refreshMarketplaceListing` flow (already platform-branched). FB-specific messages: login_required → "Open Settings → Site sessions to connect Facebook" (verify the site-sessions section supports non-parser sites — read `components/settings/site-sessions-section.tsx`; if it's parser-list-driven, note the gap and keep the card message generic: "Log into Facebook in the app's browser, then try again." — do NOT build a new session UI in this task).
- Monitoring text: FB → "Manual monitoring. Facebook requires login; price is not automatically verified."

- [ ] **Step 2: Run + check + commit**

`pnpm check && pnpm lint`

```bash
git add components/product/marketplace-card.tsx
git commit -m "feat(fbmp): card branding + check action"
```

---

### Task 5: Discover FB search sheet + guards + verify

**Files:**
- Create: `components/marketplace/facebook-search-sheet.tsx`
- Modify: `app/(tabs)/discover.tsx`
- Create: `tests/facebook-guard.test.ts`
- Modify: `todo.md`

- [ ] **Step 1: Search sheet**

`components/marketplace/facebook-search-sheet.tsx`:
- Props: `{ visible, onClose }`.
- Fields: keyword (TextInput), location (TextInput, default "Bangkok"), radius chips (10/30/64 km, default 64).
- "Open in Facebook" button: builds `https://www.facebook.com/marketplace/search/?query={enc}&location={enc}&radius={km}` (verify exact param spellings against a real search URL — ground it: fetch `https://www.facebook.com/marketplace/search/?query=laptop` anonymously once; if params differ, adjust) and loads it via the WebView host (`getWebViewHost().load(url, { timeoutMs: 25000 })`), showing the result count + first titles extracted by a light DOM/JSON scan (reuse `parseFacebookPrice`-style title regex; do NOT over-extract). If the render is a login wall → show "Sign in required" state with the same guidance as the card. If WebView unavailable (web platform) → open the URL externally via `Linking.openURL`.
- Results are informational (browsable list); each row has "Copy link" (clipboard) + "Track" (navigates to the manual-add sheet prefilled with the item URL — reuse the existing sheet flow via a callback prop or router param; simplest: copy link + toast "Paste into Add Product to track").

- [ ] **Step 2: Discover entry**

In `app/(tabs)/discover.tsx`, add a "Facebook Marketplace" row/button under the search bar (above TrendingSection) opening the sheet. Style matches neighboring sections (`useColors()`, 16px card).

- [ ] **Step 3: Guards** (`tests/facebook-guard.test.ts`)

- recognition file contains `FacebookIdentity` + `fbmp-`
- resolver contains `parseFacebookShareRender`
- sheet exists + Discover references it
- card has Facebook branding branch
- no `fbmp-` product enters automatic pipelines: assert `isAutomaticProduct({ marketplace: { platform: "facebook", ... } })` is false (append to `tests/facebook-marketplace.test.ts`)

- [ ] **Step 4: todo.md + verify**

Phase 1147 entry (check tail for next number). Then `pnpm check && pnpm lint`, targeted tests, `pnpm verify` (CARGO_NET_OFFLINE=true if cargo stalls; exit 0; fix in-scope, BLOCKED otherwise).

```bash
git add components/marketplace/facebook-search-sheet.tsx "app/(tabs)/discover.tsx" tests/facebook-guard.test.ts todo.md
git commit -m "feat(fbmp): Discover search sheet + guards + Phase entry"
```

---

### Task 6: Live verification (manual gate)

**Files:** none (verification only)

- [ ] **Step 1: Server render check**

Run the resolver against the real share link (`https://www.facebook.com/share/1DRTMqB7bR/`) via tsx — expect the Mac Pro identity (`2556068711502321`). Record output.

- [ ] **Step 2: Signed-in device check (USER ACTION)**

On the Android APK: import the link, confirm details, tap "Check price" while logged into Facebook in the app WebView. Record: does the price extract? Does login persist? Report honestly — if extraction fails, the feature stays manual-only (by design) and we note the gap.

- [ ] **Step 3: Report**

Summarize what works, what stays manual, and any regex adjustments made from the live render.

---

## Self-Review

**Spec coverage:**
- ✅ Import: recognition + resolver + confirmation (Tasks 1-3)
- ✅ On-device check + session guidance (Tasks 3-4)
- ✅ Title verification before saving (Task 3)
- ✅ Discover search source (Task 5)
- ✅ Exclusions (isAutomaticProduct false — Task 5 guard; existing marketplace exclusion covers it)
- ✅ No Rust parser, no global cache (by omission; guard asserts non-automatic)
- ✅ Live verification gate (Task 6)

**Placeholder scan:** Task 3 Step 2 and Task 5 Step 1 require grounding against real renders — explicitly instructed with fallbacks, not placeholders.

**Type consistency:** `FacebookIdentity`, `fbmp-{itemId}`, `parseFacebookPrice(html, itemId)`, `parseFacebookShareRender(html)` used consistently.