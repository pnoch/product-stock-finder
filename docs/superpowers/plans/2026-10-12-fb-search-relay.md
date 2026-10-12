# Facebook Marketplace Search Relay — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the user is signed into Facebook in the app's WebView, show Marketplace listings matching their Discover search query inline — "Facebook Marketplace (N)" section under distributor results — with Track flowing into the existing confirmation sheet.

**Architecture:** New `lib/marketplace/fb-search.ts` renders `facebook.com/marketplace/search/?query=…` through the on-device WebView host, extracts listing cards (title/price/itemId/image/location) from the rendered HTML, and returns a discriminated result (`listings` | `login_required` | `unavailable` | `empty`). `app/search.tsx` renders a Facebook section above catalog results when a query exists, session-gated and honestly labeled. Track pre-fills `ManualAddSheet` with the item URL (existing flow handles the rest).

**Tech Stack:** TypeScript, React Native WebView host, cheerio, vitest.

**Spec:** `docs/superpowers/specs/2026-10-12-facebook-marketplace-design.md` (Discover Search section)

---

## File Structure

| File | Purpose |
|------|---------|
| Create `lib/marketplace/fb-search.ts` | Search render + extraction |
| Create `components/search/facebook-results-section.tsx` | Inline results section |
| Modify `app/search.tsx` | Render section under results header |
| Create `tests/fb-search.test.ts` | Extraction + state tests |
| Create `tests/fb-search-guard.test.ts` | Wiring guards |
| Modify `todo.md` | Phase 1148 |

---

### Task 1: Search extraction (`lib/marketplace/fb-search.ts` + tests)

**Files:**
- Create: `lib/marketplace/fb-search.ts`
- Create: `tests/fb-search.test.ts`

- [ ] **Step 1: Write the extraction tests first**

Create `tests/fb-search.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { extractFbSearchResults, buildFbSearchUrl } from "../lib/marketplace/fb-search";

const RENDERED = `
<html><body>
<div><a href="/marketplace/item/111111111111111/">Mac Pro 2019 Xeon 24-Core</a>
<span>"listing_price":{"amount":"45,000"},"formatted_price":{"text":"฿45,000"}</span>
<span>Bangkok</span></div>
<div><a href="/marketplace/item/222222222222222/">Ubiquiti UniFi Switch 24</a>
<span>"listing_price":{"amount":"12,500"},"formatted_price":{"text":"฿12,500"}</span>
<span>Nonthaburi</span></div>
<div><a href="/marketplace/item/111111111111111/">Mac Pro 2019 Xeon 24-Core</a>
<span>"listing_price":{"amount":"45,000"},"formatted_price":{"text":"฿45,000"}</span>
<span>Bangkok</span></div>
</body></html>`;

describe("buildFbSearchUrl", () => {
  it("builds a search url with query, location, radius", () => {
    expect(buildFbSearchUrl({ query: "mac pro", location: "Bangkok", radiusKm: 30 }))
      .toBe("https://www.facebook.com/marketplace/search/?query=mac%20pro&location=Bangkok&radius=30");
  });

  it("omits empty location", () => {
    expect(buildFbSearchUrl({ query: "laptop", location: "", radiusKm: 64 }))
      .toBe("https://www.facebook.com/marketplace/search/?query=laptop&radius=64");
  });
});

describe("extractFbSearchResults", () => {
  it("extracts listings with title, price, itemId, location", () => {
    const out = extractFbSearchResults(RENDERED);
    expect(out).toHaveLength(2); // deduped by itemId
    expect(out[0]).toMatchObject({
      itemId: "111111111111111",
      title: "Mac Pro 2019 Xeon 24-Core",
      price: 45000,
      currency: "THB",
      location: "Bangkok",
    });
    expect(out[0]!.url).toBe("https://www.facebook.com/marketplace/item/111111111111111/");
  });

  it("returns empty for a login wall (distinct from no results)", () => {
    // Login pages contain the form but no item links.
    const wall = `<html><body><div>Log in</div><div>Email address or phone number</div><div>Forgotten password?</div></body></html>`;
    expect(extractFbSearchResults(wall)).toEqual([]);
  });

  it("returns empty when nothing matches", () => {
    expect(extractFbSearchResults("<html><body><div>No listings found</div></body></html>")).toEqual([]);
  });

  it("caps results at 20", () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      `<a href="/marketplace/item/${1000000000000000 + i}/">Item ${i}</a><span>"listing_price":{"amount":"1,000"},"formatted_price":{"text":"฿1,000"}</span>`).join("");
    expect(extractFbSearchResults(`<html><body>${many}</body></html>`)).toHaveLength(20);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `pnpm exec vitest run tests/fb-search.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/marketplace/fb-search.ts`**

```typescript
export interface FbSearchListing {
  itemId: string;
  title: string;
  price: number | null;
  currency: "THB" | null;
  location: string | null;
  url: string;
}

export function buildFbSearchUrl(input: { query: string; location: string; radiusKm: number }): string {
  const params = new URLSearchParams({ query: input.query.trim() });
  if (input.location.trim()) params.set("location", input.location.trim());
  params.set("radius", String(input.radiusKm));
  return `https://www.facebook.com/marketplace/search/?${params.toString()}`;
}

const ITEM_LINK = /href="\/marketplace\/item\/([1-9]\d{0,19})\/[^"]*"/g;
const PRICE_NEAR = /"listing_price":\{"amount":"([\d,]+(?:\.\d{1,2})?)"\},"formatted_price":\{"text":"(?:\\u0e3f|฿)/;
const MAX_RESULTS = 20;

export function extractFbSearchResults(html: string): FbSearchListing[] {
  const out: FbSearchListing[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(ITEM_LINK)) {
    const itemId = m[1]!;
    if (seen.has(itemId)) continue;
    seen.add(itemId);
    const start = Math.max(0, (m.index ?? 0) - 200);
    const window = html.slice(start, (m.index ?? 0) + 2000);
    const title =
      window.match(/>\s*([^<>]{1,200}?)\s*<\/a>/)?.[1]?.replace(/\s+/g, " ").trim() ?? "";
    const priceMatch = window.match(PRICE_NEAR);
    const price = priceMatch ? Number(priceMatch[1]!.replace(/,/g, "")) : null;
    const location = window.match(/>\s*([A-Za-zก-๙][^<>]{1,60}?)\s*<\/span>\s*<\/div>/)?.[1]?.trim() ?? null;
    out.push({
      itemId,
      title,
      price: price && Number.isFinite(price) && price > 0 ? price : null,
      currency: price ? "THB" : null,
      location,
      url: `https://www.facebook.com/marketplace/item/${itemId}/`,
    });
    if (out.length >= MAX_RESULTS) break;
  }
  return out;
}

export type FbSearchState =
  | { kind: "listings"; listings: FbSearchListing[] }
  | { kind: "login_required" }
  | { kind: "unavailable" }
  | { kind: "empty" };

export async function searchFbMarketplace(input: {
  query: string; location: string; radiusKm: number;
  loadHtml?: (url: string) => Promise<string>;
}): Promise<FbSearchState> {
  const loadHtml = input.loadHtml ?? (async (url: string) => {
    const { getWebViewHost } = await import("../scrapers/webview-host");
    const host = getWebViewHost();
    if (!host) throw new Error("unavailable");
    return host.load(url, { timeoutMs: 25000 });
  });
  let html: string;
  try {
    html = await loadHtml(buildFbSearchUrl(input));
  } catch {
    return { kind: "unavailable" };
  }
  if (/log in or sign up|you must log in|log in to continue|Forgotten password\?/i.test(html.slice(0, 6000))) {
    return { kind: "login_required" };
  }
  const listings = extractFbSearchResults(html);
  return listings.length > 0 ? { kind: "listings", listings } : { kind: "empty" };
}
```

Adaptation rule: the title/location regexes are grounded guesses against the render we captured ("No listings found for …" page shows the layout; real signed-in results may differ). If the live check (Task 3) shows different markup, adjust the regexes to reality — the tests use synthetic markup mirroring the extractor, so update both together.

- [ ] **Step 4: Run tests + check**

Run: `pnpm exec vitest run tests/fb-search.test.ts && pnpm check`
Expected: all pass, 0 errors.

- [ ] **Step 5: Commit**

```bash
git add lib/marketplace/fb-search.ts tests/fb-search.test.ts
git commit -m "feat(fbmp): search extraction + state machine"
```

---

### Task 2: Results section + search.tsx wiring

**Files:**
- Create: `components/search/facebook-results-section.tsx`
- Modify: `app/search.tsx`

- [ ] **Step 1: Create the section component**

`components/search/facebook-results-section.tsx`:

```tsx
// Props: { query: string }
// Behavior:
// - Debounced search (500ms) when query.trim().length >= 3: searchFbMarketplace({ query, location: "Bangkok", radiusKm: 64 }).
//   Location default "Bangkok" (v1; the sheet's location field stays the manual path).
// - States:
//   - loading: subtle "Checking Facebook Marketplace…" row (muted, spinner).
//   - login_required: collapsed row "Facebook Marketplace — sign in in the app browser to see local listings" (tap → opens the FB search sheet? No — keep simple: static guidance text).
//   - unavailable: render nothing (web platform / no host).
//   - empty: render nothing (no noise for zero matches).
//   - listings: section card "Facebook Marketplace (N)" with up to 5 rows:
//     title (1 line), price (฿ formatted, right), location (muted, small).
//     Row tap → setManualText(item.url) + open ManualAddSheet (prop callback onTrack(url)).
//     Footer "See all on Facebook →" → Linking.openURL(buildFbSearchUrl(...)).
// - useColors() theming; card style matches feed-card (surface, 16px radius).
// - Export: export function FacebookResultsSection({ query, onTrack }: { query: string; onTrack: (url: string) => void })
```

Implementation notes:
- `useEffect` with cleanup (`active` flag) + 500ms debounce timer.
- `formatPrice` from `@shared/currency` for price display (THB).
- No storage access — pure render + callback.

- [ ] **Step 2: Wire into `app/search.tsx`**

1. Import `FacebookResultsSection`.
2. State: `const [manualPrefill, setManualPrefill] = useState<string | null>(null);`
3. Render above the FlatList (after the filter chrome header — find where results header renders; place the section so it appears between the search bar area and catalog results; inside the FlatList `ListHeaderComponent` if that's where filter chrome lives — read lines 540-580 first and place it adjacent to the filter chrome so it scrolls with content).
4. `<FacebookResultsSection query={deferredQuery} onTrack={(url) => { setManualPrefill(url); setManualVisible(true); }} />`
5. `ManualAddSheet` gets `initialText={manualPrefill ?? query}` — check current prop usage (line 771: `initialText={query}`) and the sheet's reset-on-visible logic (it resets `raw` to `initialText` when `visible` changes — verify the prefill takes effect when already open; simplest: pass `initialText={manualPrefill ?? query}` and rely on the visible-change reset; if the sheet is already open when onTrack fires, close-then-open is acceptable: `setManualVisible(false); requestAnimationFrame(() => setManualVisible(true));` — verify and choose the simplest working approach).

- [ ] **Step 3: Run check + lint**

Run: `pnpm check && pnpm lint`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add components/search/facebook-results-section.tsx app/search.tsx
git commit -m "feat(fbmp): inline search results section in Discover search"
```

---

### Task 3: Guards + todo.md + verify + live check

**Files:**
- Create: `tests/fb-search-guard.test.ts`
- Modify: `todo.md`

- [ ] **Step 1: Guards**

```typescript
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("fb search relay wiring", () => {
  it("search module exists with state machine", () => {
    const src = read("lib/marketplace/fb-search.ts");
    expect(src).toContain("searchFbMarketplace");
    expect(src).toContain("login_required");
  });

  it("search screen renders the facebook section", () => {
    expect(read("app/search.tsx")).toContain("FacebookResultsSection");
  });

  it("section never claims full coverage", () => {
    const src = read("components/search/facebook-results-section.tsx");
    expect(src).not.toMatch(/all (listings|results)/i);
  });
});
```

- [ ] **Step 2: Run + verify**

`pnpm exec vitest run tests/fb-search.test.ts tests/fb-search-guard.test.ts`, `pnpm check && pnpm lint`, `pnpm verify` (CARGO_NET_OFFLINE=true if cargo stalls; exit 0; fix in-scope, BLOCKED otherwise).

- [ ] **Step 3: todo.md**

Phase 1148 (check tail for next number):

```markdown
## Phase 1148: Facebook Marketplace search relay

- [x] `lib/marketplace/fb-search.ts` (URL builder, extraction, state machine) + tests.
- [x] Inline "Facebook Marketplace (N)" section in Discover search results (session-gated).
- [x] Track → confirmation sheet prefill; login/unavailable/empty states distinct.
- [x] Guards. TypeScript: 0 errors.
```

- [ ] **Step 4: Commit**

```bash
git add tests/fb-search-guard.test.ts todo.md
git commit -m "test(fbmp): search relay guards + Phase entry"
```

- [ ] **Step 5: Live check (manual, needs signed-in device)**

On the Android APK: search "mac pro" in Discover → expect the FB section (or login guidance). Record honestly: if signed-in extraction shows different markup, adjust `extractFbSearchResults` regexes + tests together and re-verify.

---

## Self-Review

**Spec coverage (Discover Search section):**
- ✅ FB as explicit search source in Discover (Task 2 — inline in search results, session-gated)
- ✅ Distinct sign-in/error/empty states (Task 1 state machine)
- ✅ Track → confirmation flow, no auto-equivalence (Task 2 — user confirms in sheet)
- ✅ Dedup by item ID (Task 1 extraction)
- ✅ No coverage/pagination claims (Task 3 guard; section shows only observed results)
- ✅ Not in global price cache (listings are informational; only tracked products persist, already excluded)

**Placeholder scan:** Task 1 Step 3 has an explicit grounding rule with a concrete fallback (regex+test co-update). Task 2 Step 2 verifies sheet-reset behavior before choosing the prefill approach.

**Type consistency:** `FbSearchListing`, `FbSearchState`, `searchFbMarketplace({query, location, radiusKm, loadHtml?})`, `buildFbSearchUrl` used consistently; `onTrack(url)` callback matches search.tsx wiring.