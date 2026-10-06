# Estimated Shipping + Exact-Rate CTA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Label landed-cost shipping/total as estimates and point the user to the store for the exact rate, without changing the ranking engine.

**Architecture:** A tiny `lib/estimate-format.ts` gives a consistent `~$38 est.` string. The best-deal card uses it for the shipping/total terms and adds a "check exact rates at checkout" note; the listing card's existing Visit button is relabelled when a destination is active.

**Tech Stack:** TypeScript, React Native, vitest.

**Spec:** `docs/superpowers/specs/2026-10-06-estimated-shipping-cta-design.md`

---

## File Structure

- Create `lib/estimate-format.ts` — `formatEstimate`.
- Modify `components/product/distributor-listing-section.tsx` — estimate labels + note in the best-deal card.
- Modify `components/product/distributor-listing-card.tsx` — "Visit · exact shipping" label when a destination is active.
- Tests: `tests/estimate-format.test.ts`, `tests/estimated-shipping-guards.test.ts`.

---

### Task 1: `formatEstimate`

**Files:** Create `lib/estimate-format.ts`; Test `tests/estimate-format.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/estimate-format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatEstimate } from "../lib/estimate-format";

describe("formatEstimate", () => {
  it("prefixes with ~ and suffixes with est.", () => {
    expect(formatEstimate(38, "USD")).toBe("~$38 est.");
  });

  it("uses the currency symbol", () => {
    expect(formatEstimate(38, "EUR")).toBe("~€38 est.");
  });

  it("rounds to whole units", () => {
    expect(formatEstimate(38.4, "USD")).toBe("~$38 est.");
    expect(formatEstimate(38.6, "USD")).toBe("~$39 est.");
  });

  it("handles zero", () => {
    expect(formatEstimate(0, "USD")).toBe("~$0 est.");
  });

  it("falls back to the code for an unknown currency", () => {
    expect(formatEstimate(38, "ZZZ")).toBe("~ZZZ 38 est.");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/estimate-format.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `lib/estimate-format.ts`:

```ts
import { CURRENCY_SYMBOLS } from "@shared/currency";

/**
 * A clearly-approximate money string for estimated figures (shipping, landed
 * total). The `~` and `est.` markers exist so an estimate is never mistaken for
 * a firm quote — the exact rate is only known at the store's checkout.
 */
export function formatEstimate(amount: number, currency: string): string {
  const rounded = Math.round(amount);
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  const gap = symbol.length > 1 && /^[A-Z]{3}$/.test(symbol) ? " " : "";
  return `~${symbol}${gap}${rounded} est.`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/estimate-format.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/estimate-format.ts tests/estimate-format.test.ts
git commit -m "feat(destination): formatEstimate helper"
```

---

### Task 2: Best-deal card estimate labels + note

**Files:** Modify `components/product/distributor-listing-section.tsx`; Test `tests/estimated-shipping-guards.test.ts`

- [ ] **Step 1: Write the failing guard test**

Create `tests/estimated-shipping-guards.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("estimated shipping labelling", () => {
  it("the best-deal breakdown labels shipping and total as estimates", () => {
    const src = read("components/product/distributor-listing-section.tsx");
    // The destination breakdown must use formatEstimate for the shipping and
    // total terms so they read as estimates, not quotes.
    expect(src).toContain("formatEstimate");
    expect(src).toContain("check exact rates at checkout");
  });

  it("the listing card relabels Visit when a destination is active", () => {
    const src = read("components/product/distributor-listing-card.tsx");
    expect(src).toContain("exact shipping");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/estimated-shipping-guards.test.ts`
Expected: FAIL — the strings are absent.

- [ ] **Step 3: Implement**

In `components/product/distributor-listing-section.tsx`:
- Import `formatEstimate` from `@/lib/estimate-format`.
- In the destination breakdown block (currently around line 521-531), replace the shipping and total terms with `formatEstimate(...)` and add the note. The block should read:

```tsx
              {destination && (
                <>
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>
                    {formatPrice(bestDeal.price, bestDeal.currency)} +{" "}
                    {formatEstimate(bestDeal.shipping ?? 0, bestDeal.currency)}
                    {bestDeal.tax > 0
                      ? ` + ${formatPrice(bestDeal.tax, bestDeal.currency)}`
                      : ""}
                    {bestDeal.importEstimate && bestDeal.importEstimate > 0
                      ? ` + ${formatEstimate(bestDeal.importEstimate, bestDeal.currency)}`
                      : ""}{" "}
                    = {formatEstimate(bestDeal.total, bestDeal.currency)}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
                    Shipping is estimated. Check exact rates at checkout.
                  </Text>
                </>
              )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/estimated-shipping-guards.test.ts && pnpm check`
Expected: PASS (2 tests); 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add components/product/distributor-listing-section.tsx tests/estimated-shipping-guards.test.ts
git commit -m "feat(destination): label best-deal shipping/total as estimates"
```

---

### Task 3: "Visit · exact shipping" label

**Files:** Modify `components/product/distributor-listing-card.tsx`

- [ ] **Step 1: Implement**

The card already has a `handleVisit` that opens `listing.url`. Add a prop
`hasDestination?: boolean` (default false) and change the Visit button's label
text and `accessibilityLabel` when it is true:

```tsx
            <Text
              style={{
                color: colors.primary,
                fontWeight: "600",
                fontSize: 13,
              }}
            >
              {hasDestination ? "Visit · exact shipping" : "Visit"}
            </Text>
```

and:

```tsx
            accessibilityLabel={
              hasDestination
                ? "Visit distributor website for exact shipping"
                : "Visit distributor website"
            }
```

Add `hasDestination?: boolean` to `DistributorListingCardProps` and destructure
it. Then in `components/product/distributor-listing-section.tsx`, pass
`hasDestination={destination != null}` to each `<DistributorListingCard>`.

- [ ] **Step 2: Verify it compiles**

Run: `pnpm check`
Expected: 0 type errors.

- [ ] **Step 3: Run the guard test**

Run: `pnpm exec vitest run tests/estimated-shipping-guards.test.ts`
Expected: PASS (the `exact shipping` string is now present).

- [ ] **Step 4: Commit**

```bash
git add components/product/distributor-listing-card.tsx components/product/distributor-listing-section.tsx
git commit -m "feat(destination): Visit · exact shipping CTA"
```

---

### Task 4: Full verification + docs

**Files:** `todo.md`

- [ ] **Step 1: Run the full gate**

Run: `pnpm verify`
Expected: exit 0.

- [ ] **Step 2: Document**

Add a `todo.md` phase entry (next number 1116): the estimate labelling, the
`formatEstimate` helper, the "Visit · exact shipping" CTA, and the note that
crowd-sourced exact-rate correction and per-distributor shipping scraping are
deferred.

- [ ] **Step 3: Commit**

```bash
git add todo.md
git commit -m "docs: estimated shipping + exact-rate CTA (Phase 1116)"
```

---

## Self-Review

- **Spec coverage:** estimate labelling + note (Task 2), `formatEstimate` (Task 1), "Visit · exact shipping" CTA (Task 3), verify + docs (Task 4). Crowd-sourced correction and calculator scraping are out of scope per the spec.
- **Placeholders:** none.
- **Type consistency:** `formatEstimate(amount, currency): string`; `hasDestination?: boolean` on the card props; `destination != null` passed from the section. The guard test asserts the two strings the implementation adds.
- **No engine change:** `lib/landed-cost.ts` is untouched; ranking is unchanged.
