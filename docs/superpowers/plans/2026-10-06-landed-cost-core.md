# Landed-Cost Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compute the true landed cost of a listing delivered to a user's country — price + per-country shipping + per-distributor store tax + optional import estimate — so results can be ranked by what the buyer actually pays.

**Architecture:** A pure `lib/landed-cost.ts` over three data sources: per-country shipping on `Distributor` (region fallback), a `taxMode` on `Distributor` (export-exempt / origin / destination / none), and a destination duty/VAT table in `shared/src/duty.ts`. New `AppSettings` fields carry the destination and tax preferences. No UI in this plan.

**Tech Stack:** TypeScript, vitest.

**Spec:** `docs/superpowers/specs/2026-10-06-global-stock-radar-repositioning-design.md`

---

## File Structure

- Modify `lib/types.ts` — `Distributor.taxMode`; `AppSettings` destination fields.
- Modify `shared/src/distributors.ts` — `taxMode` on each distributor.
- Create `shared/src/duty.ts` — destination VAT/GST + duty estimate table.
- Create `lib/landed-cost.ts` — `resolveShipping`, `computeLandedCost`.
- Tests: `tests/landed-cost.test.ts`, `tests/duty.test.ts`.

**Follow-on plans (not here):** onboarding "Where do you ship to?", the results filter bar, repositioned copy, catalog expansion.

---

### Task 1: Distributor `taxMode` + AppSettings destination fields

**Files:** Modify `lib/types.ts`; Modify `shared/src/distributors.ts`; Test `tests/distributors.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/distributors.test.ts`:

```ts
import { DISTRIBUTORS } from "../shared/src/distributors";

describe("distributor taxMode", () => {
  it("every distributor declares a valid taxMode", () => {
    const valid = new Set(["export-exempt", "origin", "destination", "none"]);
    for (const d of DISTRIBUTORS) {
      expect(valid.has(d.taxMode), `${d.id} taxMode=${d.taxMode}`).toBe(true);
    }
  });

  it("at least one distributor is export-exempt", () => {
    expect(DISTRIBUTORS.some((d) => d.taxMode === "export-exempt")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/distributors.test.ts`
Expected: FAIL — `taxMode` is undefined.

- [ ] **Step 3: Implement**

In `lib/types.ts`, add to `Distributor`:

```ts
  /**
   * How the store taxes an international order:
   * - "export-exempt": sells internationally without tax (price is ex-VAT).
   * - "origin": charges its own country's VAT (uses the listing's taxRate).
   * - "destination": collects destination VAT/GST at checkout.
   * - "none": no tax anywhere.
   */
  taxMode: "export-exempt" | "origin" | "destination" | "none";
```

In `lib/types.ts`, add to `AppSettings`:

```ts
  /** ISO-3166 alpha-2 country the user ships to (landed-cost destination). */
  shipToCountry?: string;
  /** Business/reseller with a VAT/EORI number: omit all tax from landed cost. */
  taxExempt?: boolean;
  /** Add the destination duty/VAT estimate to the displayed total (default off). */
  includeImportEstimate?: boolean;
```

In `shared/src/distributors.ts`, add `taxMode` to every distributor. Default most to `"origin"`; set `"export-exempt"` for the stores that ship internationally ex-VAT (e.g. the EU exporters like Getic, and any store whose notes say "ships worldwide ex-VAT"), and `"none"` for zero-VAT jurisdictions (e.g. UAE, Malaysia). Example for the first entry:

```ts
    taxMode: "none", // Malaysia — no VAT
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/distributors.test.ts && pnpm check`
Expected: PASS; 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts shared/src/distributors.ts tests/distributors.test.ts
git commit -m "feat(landed-cost): distributor taxMode + destination settings"
```

---

### Task 2: Destination duty/VAT table

**Files:** Create `shared/src/duty.ts`; Test `tests/duty.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/duty.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { estimateImportDuty } from "../shared/src/duty";

describe("estimateImportDuty", () => {
  it("returns a VAT rate for a known country", () => {
    const est = estimateImportDuty(100, "Networking Switch", "TH");
    expect(est).not.toBeNull();
    expect(est!.vatRate).toBeGreaterThan(0);
    expect(est!.dutyRate).toBeGreaterThanOrEqual(0);
  });

  it("returns null for an unknown country", () => {
    expect(estimateImportDuty(100, "Networking Switch", "ZZ")).toBeNull();
  });

  it("returns zero VAT for a zero-VAT country", () => {
    const est = estimateImportDuty(100, "Networking Switch", "US");
    expect(est!.vatRate).toBe(0);
  });

  it("never returns a negative rate", () => {
    for (const cc of ["TH", "DE", "GB", "AU", "US", "MY"]) {
      const est = estimateImportDuty(100, "Router", cc);
      if (est) {
        expect(est.vatRate).toBeGreaterThanOrEqual(0);
        expect(est.dutyRate).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/duty.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `shared/src/duty.ts`:

```ts
// Coarse destination import estimate: VAT/GST plus a category duty rate. This
// is an ESTIMATE for ranking and expectation-setting, not a customs quote.
// Rates are curated, not authoritative; refine with real user feedback.

const COUNTRY_VAT: Record<string, number> = {
  TH: 0.07,
  SG: 0.09,
  MY: 0.1,
  AU: 0.1,
  NZ: 0.15,
  GB: 0.2,
  DE: 0.19,
  FR: 0.2,
  GR: 0.24,
  PL: 0.23,
  CZ: 0.21,
  CA: 0.13,
  ZA: 0.15,
  AE: 0.05,
  US: 0,
  HK: 0,
};

// Category → duty rate. Networking/electronics are commonly low or zero under
// ITA; a coarse default covers the rest.
const CATEGORY_DUTY: Record<string, number> = {
  "Networking Switch": 0,
  Router: 0,
  "Network Switch": 0,
  Server: 0,
  Storage: 0,
  "Single Board Computer": 0,
  default: 0.05,
};

export interface ImportEstimate {
  vatRate: number;
  dutyRate: number;
}

export function estimateImportDuty(
  _price: number,
  category: string,
  countryCode: string,
): ImportEstimate | null {
  if (!Object.prototype.hasOwnProperty.call(COUNTRY_VAT, countryCode)) {
    return null;
  }
  const vatRate = COUNTRY_VAT[countryCode]!;
  const dutyRate =
    CATEGORY_DUTY[category] ?? CATEGORY_DUTY.default!;
  return { vatRate, dutyRate };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/duty.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add shared/src/duty.ts tests/duty.test.ts
git commit -m "feat(landed-cost): destination duty/VAT estimate table"
```

---

### Task 3: `resolveShipping` (per-country with region fallback)

**Files:** Create `lib/landed-cost.ts`; Test `tests/landed-cost.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/landed-cost.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolveShipping } from "../lib/landed-cost";
import type { Distributor } from "../lib/types";

function dist(overrides: Partial<Distributor> = {}): Distributor {
  return {
    id: "d1",
    name: "D1",
    currency: "USD",
    country: "Malaysia",
    countryCode: "MY",
    region: "Asia-Pacific",
    website: "https://d1.test",
    paymentMethods: [],
    taxMode: "none",
    shippingCosts: { TH: 38, "Asia-Pacific": 15, Europe: 40 },
    ...overrides,
  } as Distributor;
}

describe("resolveShipping", () => {
  it("prefers an explicit country rate", () => {
    expect(resolveShipping(dist(), "TH")).toBe(38);
  });

  it("falls back to the distributor's region for the country", () => {
    // SG has no explicit rate; SG is in Asia-Pacific.
    expect(resolveShipping(dist(), "SG")).toBe(15);
  });

  it("returns null when neither country nor region is known", () => {
    expect(resolveShipping(dist({ shippingCosts: {} }), "TH")).toBeNull();
  });

  it("returns null when the distributor has no shipping table", () => {
    expect(resolveShipping(dist({ shippingCosts: undefined }), "TH")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/landed-cost.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `lib/landed-cost.ts`:

```ts
import type { Distributor } from "./types";
import { getDistributorById } from "@shared/distributors";

// Country → region, so a country without an explicit shipping rate falls back
// to its distributor region. Covers the countries the app's distributors ship
// to; unknown countries fall through to null.
const COUNTRY_REGION: Record<string, string> = {
  TH: "Asia-Pacific",
  SG: "Asia-Pacific",
  MY: "Asia-Pacific",
  AU: "Asia-Pacific",
  NZ: "Asia-Pacific",
  JP: "Asia-Pacific",
  KR: "Asia-Pacific",
  IN: "Asia-Pacific",
  GB: "Europe",
  DE: "Europe",
  FR: "Europe",
  GR: "Europe",
  PL: "Europe",
  CZ: "Europe",
  US: "North America",
  CA: "North America",
  AE: "Middle East",
  ZA: "Africa",
};

export function regionForCountry(countryCode: string): string | null {
  return COUNTRY_REGION[countryCode] ?? null;
}

/**
 * Shipping cost in the distributor's native currency for a destination country.
 * Explicit country rate first, then the distributor's region rate, else null.
 */
export function resolveShipping(
  distributor: Distributor,
  countryCode: string,
): number | null {
  const table = distributor.shippingCosts;
  if (!table) return null;
  if (Object.prototype.hasOwnProperty.call(table, countryCode)) {
    return table[countryCode]!;
  }
  const region = regionForCountry(countryCode);
  if (region && Object.prototype.hasOwnProperty.call(table, region)) {
    return table[region]!;
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/landed-cost.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/landed-cost.ts tests/landed-cost.test.ts
git commit -m "feat(landed-cost): resolveShipping with per-country + region fallback"
```

---

### Task 4: `computeLandedCost`

**Files:** Modify `lib/landed-cost.ts`; Test `tests/landed-cost.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/landed-cost.test.ts`:

```ts
import { computeLandedCost } from "../lib/landed-cost";
import type { DistributorListing } from "../lib/types";

function listing(overrides: Partial<DistributorListing> = {}): DistributorListing {
  return {
    distributorId: "d1",
    productId: "p1",
    price: 100,
    currency: "USD",
    stockStatus: "in_stock",
    url: "",
    lastChecked: "2026-01-01T00:00:00.000Z",
    priceHistory: [],
    ...overrides,
  } as DistributorListing;
}

const dest = { countryCode: "TH", currency: "USD" };

describe("computeLandedCost", () => {
  it("adds shipping for an export-exempt store and no store tax", () => {
    const d = dist({ taxMode: "export-exempt" });
    const r = computeLandedCost(listing(), d, dest, {});
    expect(r).not.toBeNull();
    expect(r!.shipping).toBe(38);
    expect(r!.storeTax).toBe(0);
    expect(r!.total).toBe(138);
  });

  it("adds the listing taxRate for an origin-tax store", () => {
    const d = dist({ taxMode: "origin" });
    const r = computeLandedCost(listing({ taxRate: 0.24 }), d, dest, {});
    expect(r!.storeTax).toBeCloseTo(24, 5);
    expect(r!.total).toBeCloseTo(162, 5);
  });

  it("adds destination VAT for a destination-tax store", () => {
    const d = dist({ taxMode: "destination" });
    const r = computeLandedCost(listing(), d, dest, {});
    // TH VAT 7% on 100 = 7
    expect(r!.storeTax).toBeCloseTo(7, 5);
  });

  it("adds nothing for a none-tax store", () => {
    const d = dist({ taxMode: "none" });
    const r = computeLandedCost(listing(), d, dest, {});
    expect(r!.storeTax).toBe(0);
  });

  it("zeroes all tax when the buyer is tax-exempt", () => {
    const d = dist({ taxMode: "origin" });
    const r = computeLandedCost(listing({ taxRate: 0.24 }), d, dest, {
      taxExempt: true,
    });
    expect(r!.storeTax).toBe(0);
    expect(r!.importEstimate).toBe(0);
    expect(r!.total).toBe(138);
  });

  it("includes the import estimate only when opted in", () => {
    const d = dist({ taxMode: "export-exempt" });
    const off = computeLandedCost(listing(), d, dest, {});
    expect(off!.importEstimate).toBe(0);
    const on = computeLandedCost(listing(), d, dest, {
      includeImportEstimate: true,
    });
    // TH VAT 7% on (100 + 38) = 9.66
    expect(on!.importEstimate).toBeCloseTo(9.66, 2);
    expect(on!.total).toBeCloseTo(147.66, 2);
  });

  it("returns null when shipping is unknown", () => {
    const d = dist({ shippingCosts: {} });
    expect(computeLandedCost(listing(), d, dest, {})).toBeNull();
  });

  it("converts a non-USD listing into the destination currency", () => {
    const d = dist({ currency: "EUR", taxMode: "none" });
    const r = computeLandedCost(
      listing({ price: 100, currency: "EUR" }),
      d,
      { countryCode: "TH", currency: "USD" },
      {},
    );
    expect(r).not.toBeNull();
    expect(r!.currency).toBe("USD");
    expect(r!.price).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/landed-cost.test.ts`
Expected: FAIL — `computeLandedCost` is not exported.

- [ ] **Step 3: Implement**

Append to `lib/landed-cost.ts`:

```ts
import type { DistributorListing } from "./types";
import { convertPrice } from "./currency";
import { estimateImportDuty } from "@shared/duty";

export interface LandedCost {
  distributorId: string;
  price: number;
  shipping: number;
  storeTax: number;
  importEstimate: number;
  total: number;
  currency: string;
  isEstimate: boolean;
}

export interface Destination {
  countryCode: string;
  currency: string;
}

export interface LandedCostOptions {
  taxExempt?: boolean;
  includeImportEstimate?: boolean;
  category?: string;
}

/**
 * True cost to the buyer's door: converted price + shipping + the store's tax
 * (per its taxMode) + an optional destination import estimate. Returns null when
 * shipping is unknown, so the UI can show "shipping unknown" rather than a wrong
 * number.
 */
export function computeLandedCost(
  listing: DistributorListing,
  distributor: Distributor,
  destination: Destination,
  options: LandedCostOptions,
): LandedCost | null {
  const shippingNative = resolveShipping(distributor, destination.countryCode);
  if (shippingNative === null) return null;

  const price = convertPrice(listing.price, listing.currency, destination.currency);
  if (price === null) return null;
  const shipping = convertPrice(
    shippingNative,
    distributor.currency,
    destination.currency,
  );
  if (shipping === null) return null;

  const taxExempt = options.taxExempt === true;

  let storeTax = 0;
  if (!taxExempt) {
    if (distributor.taxMode === "origin") {
      const rate =
        typeof listing.taxRate === "number" && Number.isFinite(listing.taxRate)
          ? listing.taxRate
          : 0;
      storeTax = price * rate;
    } else if (distributor.taxMode === "destination") {
      const est = estimateImportDuty(price, options.category ?? "", destination.countryCode);
      storeTax = est ? price * est.vatRate : 0;
    }
  }

  let importEstimate = 0;
  if (!taxExempt && options.includeImportEstimate === true) {
    const est = estimateImportDuty(price, options.category ?? "", destination.countryCode);
    if (est) {
      const base = price + shipping;
      importEstimate = base * (est.vatRate + est.dutyRate);
    }
  }

  return {
    distributorId: distributor.id,
    price,
    shipping,
    storeTax,
    importEstimate,
    total: price + shipping + storeTax + importEstimate,
    currency: destination.currency,
    isEstimate: true,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/landed-cost.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/landed-cost.ts tests/landed-cost.test.ts
git commit -m "feat(landed-cost): computeLandedCost with taxMode + optional import estimate"
```

---

### Task 5: Rank listings by landed cost

**Files:** Modify `lib/landed-cost.ts`; Test `tests/landed-cost.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/landed-cost.test.ts`:

```ts
import { rankByLandedCost } from "../lib/landed-cost";
import { getDistributorById } from "../shared/src/distributors";

describe("rankByLandedCost", () => {
  it("sorts by total landed cost ascending and drops unknown-shipping rows", () => {
    const cheap = listing({ distributorId: "server2u-my", price: 100 });
    const dear = listing({ distributorId: "server2u-my", price: 300 });
    const ranked = rankByLandedCost([dear, cheap], dest, {});
    expect(ranked).toHaveLength(2);
    expect(ranked[0]!.price).toBeLessThan(ranked[1]!.price);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/landed-cost.test.ts`
Expected: FAIL — `rankByLandedCost` is not exported.

- [ ] **Step 3: Implement**

Append to `lib/landed-cost.ts`:

```ts
/**
 * Landed-cost-ranked listings for a destination. Listings whose distributor is
 * unknown or whose shipping is unknown are dropped (they cannot be ranked
 * fairly). Ties break by distributor id for determinism.
 */
export function rankByLandedCost(
  listings: DistributorListing[],
  destination: Destination,
  options: LandedCostOptions,
): LandedCost[] {
  const out: LandedCost[] = [];
  for (const listing of listings) {
    const distributor = getDistributorById(listing.distributorId);
    if (!distributor) continue;
    const cost = computeLandedCost(listing, distributor, destination, options);
    if (cost) out.push(cost);
  }
  return out.sort(
    (a, b) =>
      a.total - b.total ||
      a.distributorId.localeCompare(b.distributorId),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/landed-cost.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/landed-cost.ts tests/landed-cost.test.ts
git commit -m "feat(landed-cost): rankByLandedCost"
```

---

### Task 6: Full verification + docs

**Files:** `todo.md`

- [ ] **Step 1: Run the full gate**

Run: `pnpm verify`
Expected: exit 0.

- [ ] **Step 2: Document**

Add a `todo.md` phase entry (next number 1114): the landed-cost core (`taxMode`, `resolveShipping`, `duty.ts`, `computeLandedCost`, `rankByLandedCost`), the destination settings, and the note that the UI/onboarding/filter bar and catalog expansion are follow-on plans.

- [ ] **Step 3: Commit**

```bash
git add todo.md
git commit -m "docs: landed-cost core (Phase 1114)"
```

---

## Self-Review

- **Spec coverage:** `taxMode` + settings (Task 1), duty table (Task 2), per-country shipping with region fallback (Task 3), `computeLandedCost` with all four tax modes + tax-exempt + optional import estimate (Task 4), ranking (Task 5), verify + docs (Task 6). The UI/onboarding/filter bar and catalog expansion are explicitly follow-on plans per the spec's sequencing.
- **Placeholders:** none.
- **Type consistency:** `Distributor.taxMode` union; `Destination { countryCode, currency }`; `LandedCostOptions { taxExempt?, includeImportEstimate?, category? }`; `LandedCost { price, shipping, storeTax, importEstimate, total, currency, isEstimate }`; `resolveShipping`/`computeLandedCost`/`rankByLandedCost` used consistently.
- **Note:** Task 1 sets `taxMode` per distributor by hand (a product/data judgment); the test only asserts the field is present and valid, plus at least one `export-exempt`.
