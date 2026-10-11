# Redesign Plan B — Concierge Onboarding

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 3-slide carousel + country picker with a 3-question concierge flow that builds the user's initial watchlist, alerts, and shipping setup.

**Architecture:** New `components/onboarding/concierge-screen.tsx` (3 steps + done screen) rendered by `app/_layout.tsx` instead of `OnboardingScreen` for first-run users. Reuses catalog search, CountryPicker, and storage primitives. Same `has_seen_onboarding` gate — no migration.

**Tech Stack:** TypeScript, Expo Router, React Native, AsyncStorage.

**Spec:** `docs/superpowers/specs/2026-10-11-android-redesign-design.md` (Section 2)

---

## File Structure

| File | Purpose |
|------|---------|
| Create `components/onboarding/concierge-screen.tsx` | 3-step flow + done screen |
| Create `lib/concierge.ts` | Pure helpers (alert price calc, setup builder) + tests |
| Modify `app/_layout.tsx` | Render concierge instead of carousel |
| Keep `components/onboarding/onboarding-screen.tsx` | Untouched (fallback, deleted in a later cleanup) |
| Create `tests/concierge.test.ts` | Unit tests |
| Create `tests/concierge-wiring-guard.test.ts` | Wiring guards |

---

### Task 1: Pure helpers (`lib/concierge.ts` + tests)

**Files:**
- Create: `lib/concierge.ts`
- Create: `tests/concierge.test.ts`

- [ ] **Step 1: Write `lib/concierge.ts`**

```typescript
import type { Product } from "@/lib/types";
import { getBestPrice } from "@/lib/currency";

/** Default alert = 10% under current best in-stock price, rounded to 2dp. Null when no price. */
export function defaultAlertTarget(
  product: Product,
  displayCurrency: string,
): { targetPrice: number; currency: string } | null {
  const best = getBestPrice(product.listings ?? [], displayCurrency);
  if (!best) return null;
  const target = Math.round(best.price * 0.9 * 100) / 100;
  if (!(target > 0)) return null;
  return { targetPrice: target, currency: best.currency };
}

/** Clamp multi-select to max 5, preserving order, deduped by id. */
export function clampSelection(ids: string[], max = 5): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= max) break;
  }
  return out;
}
```

Verify `getBestPrice` import path: `lib/currency.ts` exports `getBestPrice` (confirmed line 58). Check its return shape — `{ price, currency }` — by reading the function signature before finalizing (if it returns more fields, only use price/currency).

- [ ] **Step 2: Write tests**

Create `tests/concierge.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { defaultAlertTarget, clampSelection } from "../lib/concierge";
import type { Product } from "../lib/types";

function makeProduct(price: number, currency = "USD"): Product {
  return {
    id: "p1",
    name: "Widget",
    modelNumber: "W1",
    brand: "T",
    category: "Switch",
    description: "",
    isWatched: false,
    addedAt: new Date().toISOString(),
    listings: [{
      distributorId: "d1",
      distributorName: "D1",
      price,
      currency,
      stockStatus: "in_stock",
      url: "https://example.com",
      lastChecked: new Date().toISOString(),
      priceHistory: [],
    }],
  } as unknown as Product;
}

describe("defaultAlertTarget", () => {
  it("returns 10% under best price", () => {
    expect(defaultAlertTarget(makeProduct(100), "USD")).toEqual({
      targetPrice: 90,
      currency: "USD",
    });
  });

  it("returns null when no listings", () => {
    const p = makeProduct(100);
    p.listings = [];
    expect(defaultAlertTarget(p, "USD")).toBeNull();
  });

  it("converts currency before discounting", () => {
    // EUR listing, USD display — target must be in display currency.
    const p = makeProduct(100, "EUR");
    const out = defaultAlertTarget(p, "USD");
    expect(out).not.toBeNull();
    expect(out!.currency).toBe("USD");
    expect(out!.targetPrice).toBeGreaterThan(0);
  });
});

describe("clampSelection", () => {
  it("caps at 5 preserving order", () => {
    expect(clampSelection(["a", "b", "c", "d", "e", "f", "g"])).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("dedupes by id", () => {
    expect(clampSelection(["a", "b", "a", "c"])).toEqual(["a", "b", "c"]);
  });

  it("passes through short lists", () => {
    expect(clampSelection(["a"])).toEqual(["a"]);
    expect(clampSelection([])).toEqual([]);
  });
});
```

If `getBestPrice` excludes out-of-stock listings and the test product's listing shape mismatches, adjust the fixture (read `getBestPrice` first).

- [ ] **Step 3: Run tests**

Run: `pnpm exec vitest run tests/concierge.test.ts`
Expected: all pass.

- [ ] **Step 4: Run check**

Run: `pnpm check`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add lib/concierge.ts tests/concierge.test.ts
git commit -m "feat(redesign): concierge helpers + tests"
```

---

### Task 2: Concierge screen component

**Files:**
- Create: `components/onboarding/concierge-screen.tsx`

- [ ] **Step 1: Study the pieces**

Read (skim):
- `components/onboarding/onboarding-screen.tsx` lines 1-100 (imports, slide structure, finish/save pattern, `setOnboardingSeen` usage).
- `components/search/catalog-search-bar.tsx` props (same learning as Plan A Task 2 — reuse query-state pattern).
- `components/ui/country-picker.tsx` props (`value`, `onChange` — confirmed pattern at onboarding-screen lines 220-224).
- `hooks/use-colors.ts` return shape.
- How ids are generated for alerts: search `Date.now().toString()` or `generateId\|uuid\|nanoid` in `app/(tabs)/alerts.tsx` or `lib/storage/`; copy the convention.

- [ ] **Step 2: Write the component**

Create `components/onboarding/concierge-screen.tsx`:

```tsx
// Props: { onComplete: () => void }
// Steps: 0 = hunt (search + multi-select, max 5, Skip), 1 = ship (CountryPicker + tax-exempt + Back/Skip),
//        2 = notify (3 toggles: drops ON, stock ON, digest OFF + Back/Skip), 3 = done (summary + Finish).
// Finish: for each selected product -> addToWatchlist; if drops on -> addAlert per product with
//         defaultAlertTarget (skip products with null target); if stock on -> addStockWatch per
//         in-stock-capable listing? No — one any-distributor watch per product.
//         Save settings (shipToCountry, displayCurrency from getCountry, taxExempt).
//         setOnboardingSeen() then onComplete().
// Skip (any step): setOnboardingSeen() then onComplete() immediately (no partial writes).
// Back buttons navigate steps. All writes wrapped in try/catch with alert on failure (don't strand user).
```

Detailed requirements:
- Step 0 search: reuse `CatalogSearchBar` with local query state; results list shows catalog matches with checkmark toggle; selected count "3 of 5 selected"; Continue disabled when 0 selected (Skip always available).
- Catalog source: `PRODUCT_CATALOG` from `@shared/catalog` (same as search screen). Selected products must be converted to full `Product` objects before `addToWatchlist` — read how `app/search.tsx` builds the product from a catalog entry (copy that construction).
- Step 1 ship: `CountryPicker` + tax-exempt Switch (copy from onboarding-screen lines 140-190 styling).
- Step 2 notify: three Switch rows with descriptions. State: `notifyDrops` (default true), `notifyStock` (default true), `notifyDigest` (default false).
- Step 3 done: summary text "Tracking N products across 25 stores" + bullet list of what was created (alerts count, watches count) + Finish button.
- Stock watches: `addStockWatch` takes a `BackOrderReminder` — read `lib/types.ts` lines 125+ for required fields; create one per product with scope "any" (check the scope field values in types: `"distributor" | "any"` per notifications router — confirm).
- Digest toggle: persisted to settings (`priceDigest` or equivalent — check `AppSettings` type; if no digest flag exists, store nothing and note it — do NOT invent a settings field).
- Styling: `useColors()`, 28px step titles, progress dots or "Step N of 3", Skip top-right (copy onboarding-screen pattern).

- [ ] **Step 3: Run check + lint**

Run: `pnpm check && pnpm lint`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add components/onboarding/concierge-screen.tsx
git commit -m "feat(redesign): concierge onboarding flow"
```

---

### Task 3: Wire into layout + guards + verify

**Files:**
- Modify: `app/_layout.tsx`
- Create: `tests/concierge-wiring-guard.test.ts`
- Modify: `todo.md`

- [ ] **Step 1: Swap the rendered component**

In `app/_layout.tsx`, find where `<OnboardingScreen>` is rendered for the `"intro"` state (around lines 349-427). Replace with `<ConciergeScreen onComplete={...}>` using the same `onComplete` handler. Keep the import tidy (remove `OnboardingScreen` import only if unused elsewhere in the file; otherwise leave it).

Verify `hasSeenOnboarding` gate and PUBLIC_ROUTES logic are untouched.

- [ ] **Step 2: Wiring guard**

Create `tests/concierge-wiring-guard.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("concierge onboarding wiring", () => {
  it("layout renders concierge for first-run", () => {
    expect(read("app/_layout.tsx")).toContain("ConciergeScreen");
  });

  it("concierge uses catalog search + country picker + storage", () => {
    const src = read("components/onboarding/concierge-screen.tsx");
    expect(src).toContain("CatalogSearchBar");
    expect(src).toContain("CountryPicker");
    expect(src).toContain("addToWatchlist");
    expect(src).toContain("setOnboardingSeen");
  });

  it("helpers exist", () => {
    const src = read("lib/concierge.ts");
    expect(src).toContain("defaultAlertTarget");
    expect(src).toContain("clampSelection");
  });
});
```

Fix assertions to match reality (keeping intent) if any fail.

- [ ] **Step 3: Run tests + check + lint + verify**

Run: `pnpm exec vitest run tests/concierge.test.ts tests/concierge-wiring-guard.test.ts`
Expected: all pass. Then `pnpm check && pnpm lint` (0 errors). Then `pnpm verify` (exit 0; fix in-scope, report BLOCKED otherwise).

- [ ] **Step 4: todo.md entry**

Read tail for next number (expect 1141), append:

```markdown
## Phase 1141: Redesign B — concierge onboarding

- [x] `lib/concierge.ts` (defaultAlertTarget, clampSelection) + tests.
- [x] ConciergeScreen (hunt → ship → notify → done) replaces carousel for first-run.
- [x] Same `has_seen_onboarding` gate; skip jumps to Discover; no auth wall.
- [x] Old onboarding-screen.tsx retained (cleanup deferred). TypeScript: 0 errors.
```

- [ ] **Step 5: Commit**

```bash
git add "app/_layout.tsx" tests/concierge-wiring-guard.test.ts todo.md
git commit -m "test(redesign): concierge wiring + Phase entry"
```

---

## Self-Review

**Spec coverage (§2):**
- ✅ Q1 hunt with multi-select ≤5 + skip (Tasks 1-2)
- ✅ Q2 ship with CountryPicker + currency/tax (Task 2)
- ✅ Q3 notify toggles with smart defaults + alert/watch creation (Task 2)
- ✅ Done screen with summary → Home with data (Task 2)
- ✅ Skip → Discover, no auth wall, existing users unaffected (Tasks 2-3)
- ✅ Old screen retained (Task 3)

**Placeholder scan:** None — Task 2 lists exact sources to copy for every uncertain piece.

**Type consistency:** `defaultAlertTarget` returns `{ targetPrice, currency } | null` matching `PriceAlert` fields; `clampSelection(string[], max?)` used by step 0.
