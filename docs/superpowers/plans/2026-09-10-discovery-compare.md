# Discovery + Compare Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Manual-add gains URL parsing, description, and duplicate protection; Compare gains the cheapest-by-region card — both mirroring mobile.

**Architecture:** Extend the existing manual modal (same parse path, same taxonomy); render pure `cheapestByRegion` in a new card under Best Price.

**Tech Stack:** React + react-router, `discoverProduct`/`customProductSlug` (`lib/`), `cheapestByRegion` (`@shared/compare-utils`), vitest desktop (`desktop/ pnpm test`), `pnpm check`, `pnpm lint`.

---

### Task 1: Manual modal upgrades

**Files:**
- Modify: `desktop/src/pages/Search.tsx` (manual modal + `handleManualAdd`)
- Test: `desktop/tests/manual-add-ai.test.tsx` (extend — read it first for mocks/harness)

Verified facts (re-confirm): modal has paste textarea + 4 fields, no URL input/description/dup-guard; `handleManualAdd` mints `manual-${Date.now()}` with `description: ""`; `trackedIds: Set<string>` in scope with setter; `discoverProduct` imported from `../../../lib/llm-discovery`; `customProductSlug` in `lib/listing-discovery.ts:8` (verify Search.tsx's import depth for that module — it imports `discoverListings` from there already? grep first; copy the specifier).

- [ ] **Step 1: Write the failing tests** (append to manual-add-ai.test.tsx):

```tsx
it("fetches from a distributor URL", async () => {
  // type URL into the URL field; Fetch button enabled (isUrlLike gating — assert disabled for "not a url");
  // click Fetch; assert discoverProduct called with the URL; fields fill from res.product.
});
it("carries the description into the created product", async () => {
  // fill description; Add; assert addToWatchlist called with objectContaining({ description: <text> }).
});
it("blocks duplicate models with Already Tracked", async () => {
  // seed trackedIds with customProductSlug("CRS326-24G") — how? The harness renders Search with mocked storage getWatchlist? read how trackedIds gets populated (watchlist load) and seed accordingly;
  // set model "CRS326-24G"; Add; assert addToWatchlist NOT called + "Already Tracked" toast/text visible.
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm test manual-add-ai` (workdir: `desktop/`)
Expected: FAIL — no URL field, `description: ""` hardcoded, no dup guard.

- [ ] **Step 3: Write minimal implementation**

```tsx
const [urlInput, setUrlInput] = useState("");
const [urlParsing, setUrlParsing] = useState(false);
const isUrlLike = (s: string) => /^https?:\/\/\S+/i.test(s.trim());

const handleUrlFetch = async () => {
  const text = urlInput.trim();
  if (!text || urlParsing || !isUrlLike(text)) return;
  setUrlParsing(true);
  try {
    const res = await discoverProduct(text);
    if (res?.product) { fill 4 fields from res.product; }
    else { setManualError(...same fallback as paste path...); }
  } catch (e) { setManualError(toDiscoverErrorState(e)); }
  finally { setUrlParsing(false); }
};
```

Match the existing paste-parse handler's shape (read `handleManualParse` first — unify if the bodies are identical apart from source: extract `fillFromParseResult(res)` helper if clean, else duplicate 4 setters; prefer the helper if it doesn't churn the paste path... minimal churn wins: duplicate only if extraction touches working code paths. Decide by reading.)

Description: add `manualDescription` state + textarea in modal; `description: manualDescription.trim()` in `prod` (replacing `""`); reset on close/add alongside other fields.

Dup guard at top of `handleManualAdd` (after required check):

```tsx
import { customProductSlug } from "../../../lib/listing-discovery"; // verify depth
const slug = customProductSlug(manualModel.trim());
if (trackedIds.has(slug)) { showToast("Already Tracked — that model number is already in your watchlist."); return; }
```

Copy mobile alert copy verbatim ("Already Tracked", "That model number is already in your watchlist." — re-read mobile lines first; toast (desktop surface) instead of showAlert dialog).

- [ ] **Step 4: Run to verify**

Run: `pnpm test manual-add-ai` (desktop); `pnpm check` (root, 0 errors); `pnpm build` (desktop, exit 0).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/pages/Search.tsx desktop/tests/manual-add-ai.test.tsx
git commit -m "Feat: URL fetch, description, duplicate guard in manual add. TypeScript: 0 errors."
```

---

### Task 2: Cheapest-by-region card

**Files:**
- Modify: `desktop/src/pages/Compare.tsx` (card under Best Price block)
- Test: `desktop/tests/compare-region.test.tsx` (new; check for an existing Compare render harness — compare-chart-width.test.tsx renders Compare — extend it if cheap, else new file with copied harness)

Verified facts (re-confirm): `cheapestByRegion(listings, targetCurrency): RegionBest[]` (`{region, listing, usd, converted}`, sorted asc, in-stock preferred, back-order fallback, skips out-of-stock/unpriced/unknown); Compare has `displayCurrency`, `formatPrice`, `getDistributorById`, `sortedListings`; empty case = `[]`.

- [ ] **Step 1: Write the failing tests**

```tsx
it("lists cheapest in-stock per region with overall best marked", async () => {
  // listings across 2 regions (US: A $100 in-stock + B $90 out-of-stock; EU: C €80 in-stock);
  // assert both regions shown, cheapest-first order, BEST badge on the overall cheapest row.
});
it("shows the empty state with no buyable listings", async () => {
  // all out-of-stock → "No in-stock regions".
});
```

Region values: read `@shared/distributors` region strings for two real distributors (use real ids so `getDistributorById` resolves; verify flag/name fields used: `countryFlag`? mobile row shows region + distributor — read the rest of cheapest-region-card rows first for exact fields rendered (distributor name? flag? price converted?)).

- [ ] **Step 2: Run to verify they fail**

Run: chosen suite (workdir: `desktop/`)
Expected: FAIL — no region card.

- [ ] **Step 3: Write minimal implementation** (under the Best Price block, above the alert CTA — read surrounding JSX first for placement):

```tsx
import { cheapestByRegion } from "@shared/compare-utils"; // verify specifier (Compare.tsx:5-7 use @shared/* — copy form)

const regionBest = useMemo(() => cheapestByRegion(sortedListings, displayCurrency), [sortedListings, displayCurrency]);

<div className="...card chrome copied from Best Price block...">
  <h3>Cheapest by Region</h3>
  {regionBest.length === 0 ? (
    <p>No in-stock regions</p>
  ) : (
    regionBest.map((item, i) => {
      const dist = getDistributorById(item.listing.distributorId);
      return (
        <div key={item.region} className={i === 0 ? "highlight" : ""}>
          {i === 0 && <span>BEST</span>}
          <span>{item.region}</span>
          <span>{dist?.countryFlag} {dist?.name ?? item.listing.distributorId}</span>
          <span>{formatPrice(item.converted, displayCurrency)}</span>
        </div>
      );
    })
  )}
</div>
```

Mirror mobile copy verbatim ("Cheapest by Region", "BEST", "No in-stock regions"); tailwind classes copied from the neighboring Best Price card (no new design language); static highlight (amber tint like the best card? read card classes — use the same emerald/amber idiom already on the page).

- [ ] **Step 4: Run to verify**

Run: chosen suite (desktop); `pnpm check` (root, 0 errors).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/pages/Compare.tsx <test file> (verify via git status)
git commit -m "Feat: cheapest-by-region card on compare. TypeScript: 0 errors."
```

---

### Final verification (all tasks)

```bash
pnpm check          # expect: 0 errors
pnpm lint           # expect: 0 errors
pnpm test           # expect: 0 failures (root)
pnpm test           # workdir desktop/ — expect: 0 failures
pnpm build          # workdir desktop/ — expect: exit 0
```

Do NOT push. Report DONE (per-task outcome + verification counts) or BLOCKED/NEEDS_CONTEXT.
