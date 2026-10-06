# Destination Onboarding + Landed-Cost Filter Bar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user pick where they ship and rank every listing by landed cost to that country, via a country list, an onboarding step, a filter bar, and a Settings control.

**Architecture:** A curated `shared/src/countries.ts` feeds a reusable `CountryPicker`. A pure `lib/destination.ts` resolves settings → `Destination | null` and `LandedCostOptions`. Product detail switches from `findBestDeal` (region) to `rankByLandedCost` (country) only when a country is set, so the region path is untouched.

**Tech Stack:** TypeScript, React Native / Expo, vitest.

**Spec:** `docs/superpowers/specs/2026-10-06-destination-onboarding-filter-design.md`

---

## File Structure

- Create `shared/src/countries.ts` — the country list + lookups.
- Create `lib/destination.ts` — `resolveDestination`, `landedCostOptions`.
- Create `components/ui/country-picker.tsx` — searchable picker.
- Modify `components/onboarding/onboarding-screen.tsx` — 4th destination step.
- Modify `app/product/[id].tsx` — landed-cost ranking + filter bar wiring.
- Modify `components/product/distributor-listing-section.tsx` — filter bar UI + breakdown.
- Modify `app/(tabs)/settings.tsx` — "Ship to" + toggles.
- Tests: `tests/countries.test.ts`, `tests/destination.test.ts`.

---

### Task 1: Country list

**Files:** Create `shared/src/countries.ts`; Test `tests/countries.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/countries.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { COUNTRIES, getCountry, searchCountries } from "../shared/src/countries";
import { regionForCountry } from "../lib/landed-cost";
import { estimateImportDuty } from "../shared/src/duty";

describe("countries", () => {
  it("has unique ISO codes and non-empty fields", () => {
    const codes = new Set<string>();
    for (const c of COUNTRIES) {
      expect(c.code).toMatch(/^[A-Z]{2}$/);
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.currency).toMatch(/^[A-Z]{3}$/);
      expect(c.region.length).toBeGreaterThan(0);
      expect(codes.has(c.code), `duplicate ${c.code}`).toBe(false);
      codes.add(c.code);
    }
  });

  it("getCountry finds a known country and misses an unknown one", () => {
    expect(getCountry("TH")?.name).toBe("Thailand");
    expect(getCountry("ZZ")).toBeUndefined();
  });

  it("searchCountries matches by name and code, case-insensitively", () => {
    expect(searchCountries("thai").some((c) => c.code === "TH")).toBe(true);
    expect(searchCountries("th").some((c) => c.code === "TH")).toBe(true);
    expect(searchCountries("zzzz")).toHaveLength(0);
  });

  it("covers every country in the landed-cost region map", () => {
    for (const code of ["TH", "SG", "MY", "AU", "NZ", "JP", "KR", "IN", "GB", "DE", "FR", "GR", "PL", "CZ", "US", "CA", "AE", "ZA"]) {
      expect(regionForCountry(code), `${code} missing from COUNTRY_REGION`).not.toBeNull();
      expect(getCountry(code), `${code} missing from COUNTRIES`).toBeDefined();
    }
  });

  it("covers every country in the duty VAT map", () => {
    for (const code of ["TH", "SG", "MY", "AU", "NZ", "GB", "DE", "FR", "GR", "PL", "CZ", "CA", "ZA", "AE", "US", "HK"]) {
      expect(estimateImportDuty(100, "Router", code), `${code} missing from COUNTRY_VAT`).not.toBeNull();
      expect(getCountry(code), `${code} missing from COUNTRIES`).toBeDefined();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/countries.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `shared/src/countries.ts` with a curated list covering at minimum every
code in `lib/landed-cost.ts`'s `COUNTRY_REGION` (TH, SG, MY, AU, NZ, JP, KR, IN,
GB, DE, FR, GR, PL, CZ, US, CA, AE, ZA) and `shared/src/duty.ts`'s `COUNTRY_VAT`
(add HK). Include ~60 total for a usable picker. Each entry:

```ts
export interface Country {
  code: string;
  name: string;
  currency: string;
  region: string;
}

export const COUNTRIES: Country[] = [
  { code: "TH", name: "Thailand", currency: "THB", region: "Asia-Pacific" },
  { code: "SG", name: "Singapore", currency: "SGD", region: "Asia-Pacific" },
  { code: "MY", name: "Malaysia", currency: "MYR", region: "Asia-Pacific" },
  { code: "AU", name: "Australia", currency: "AUD", region: "Asia-Pacific" },
  { code: "NZ", name: "New Zealand", currency: "NZD", region: "Asia-Pacific" },
  { code: "JP", name: "Japan", currency: "JPY", region: "Asia-Pacific" },
  { code: "KR", name: "South Korea", currency: "KRW", region: "Asia-Pacific" },
  { code: "IN", name: "India", currency: "INR", region: "Asia-Pacific" },
  { code: "HK", name: "Hong Kong", currency: "HKD", region: "Asia-Pacific" },
  { code: "GB", name: "United Kingdom", currency: "GBP", region: "Europe" },
  { code: "DE", name: "Germany", currency: "EUR", region: "Europe" },
  { code: "FR", name: "France", currency: "EUR", region: "Europe" },
  { code: "GR", name: "Greece", currency: "EUR", region: "Europe" },
  { code: "PL", name: "Poland", currency: "PLN", region: "Europe" },
  { code: "CZ", name: "Czech Republic", currency: "CZK", region: "Europe" },
  { code: "US", name: "United States", currency: "USD", region: "North America" },
  { code: "CA", name: "Canada", currency: "CAD", region: "North America" },
  { code: "AE", name: "United Arab Emirates", currency: "AED", region: "Middle East" },
  { code: "ZA", name: "South Africa", currency: "ZAR", region: "Africa" },
  // …add ~40 more (e.g. ES, IT, NL, SE, NO, DK, FI, IE, PT, AT, BE, CH, RO, HU,
  // TR, SA, IL, EG, KE, NG, BR, MX, AR, CL, CO, PH, ID, VN, TW, CN, PK, BD, LK,
  // NP, UA, RS, BG, HR, SK, SI, LT, LV, EE) with correct currency + region.
];

export function getCountry(code: string): Country | undefined {
  return COUNTRIES.find((c) => c.code === code);
}

export function searchCountries(query: string): Country[] {
  const q = query.trim().toLowerCase();
  if (!q) return COUNTRIES;
  return COUNTRIES.filter(
    (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/countries.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add shared/src/countries.ts tests/countries.test.ts
git commit -m "feat(destination): curated country list"
```

---

### Task 2: Destination resolver

**Files:** Create `lib/destination.ts`; Test `tests/destination.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/destination.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolveDestination, landedCostOptions } from "../lib/destination";
import type { AppSettings } from "../lib/types";

const base: AppSettings = {
  theme: "auto",
  displayCurrency: "USD",
  checkInterval: "manual",
  notificationsEnabled: true,
  stockAlerts: true,
  priceAlerts: true,
  healthAlerts: true,
};

describe("resolveDestination", () => {
  it("returns null when shipToCountry is unset", () => {
    expect(resolveDestination(base)).toBeNull();
  });

  it("returns the destination when shipToCountry is set", () => {
    expect(
      resolveDestination({ ...base, shipToCountry: "TH", displayCurrency: "THB" }),
    ).toEqual({ countryCode: "TH", currency: "THB" });
  });

  it("defaults the currency to USD when displayCurrency is empty", () => {
    expect(
      resolveDestination({ ...base, shipToCountry: "TH", displayCurrency: "" }),
    ).toEqual({ countryCode: "TH", currency: "USD" });
  });
});

describe("landedCostOptions", () => {
  it("maps the tax flags", () => {
    expect(
      landedCostOptions({ ...base, taxExempt: true, includeImportEstimate: true }),
    ).toEqual({ taxExempt: true, includeImportEstimate: true });
  });

  it("defaults both flags to false", () => {
    expect(landedCostOptions(base)).toEqual({
      taxExempt: false,
      includeImportEstimate: false,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/destination.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `lib/destination.ts`:

```ts
import type { AppSettings } from "./types";
import type { Destination, LandedCostOptions } from "./landed-cost";

/**
 * The user's shipping destination, or null when they have not chosen one (the
 * caller then falls back to the region-based path).
 */
export function resolveDestination(settings: AppSettings): Destination | null {
  if (!settings.shipToCountry) return null;
  return {
    countryCode: settings.shipToCountry,
    currency: settings.displayCurrency || "USD",
  };
}

export function landedCostOptions(settings: AppSettings): LandedCostOptions {
  return {
    taxExempt: settings.taxExempt === true,
    includeImportEstimate: settings.includeImportEstimate === true,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/destination.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/destination.ts tests/destination.test.ts
git commit -m "feat(destination): resolveDestination + landedCostOptions"
```

---

### Task 3: Country picker component

**Files:** Create `components/ui/country-picker.tsx`; Test `tests/country-picker.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/country-picker.test.tsx` (mirror the jsdom harness in
`tests/site-sessions-section.test.tsx` — `// @vitest-environment jsdom`, mock
`react-native` to DOM elements, mock `@/hooks/use-colors`):

```tsx
// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";

vi.mock("react-native", async () => {
  const React = await import("react");
  return {
    View: ({ children, ...r }: any) => React.createElement("div", r, children),
    Text: ({ children, ...r }: any) => React.createElement("span", r, children),
    TextInput: (r: any) => React.createElement("input", r),
    Pressable: ({ children, onPress, accessibilityLabel, ...r }: any) =>
      React.createElement("button", { ...r, "aria-label": accessibilityLabel, onClick: onPress }, children),
    ScrollView: ({ children, ...r }: any) => React.createElement("div", r, children),
    Modal: ({ children, visible }: any) => (visible ? React.createElement("div", null, children) : null),
  };
});
vi.mock("@/hooks/use-colors", () => ({
  useColors: () => ({ surface: "#fff", foreground: "#111", muted: "#888", border: "#ddd", primary: "#0F52BA" }),
}));
vi.mock("expo-haptics", () => ({ impactAsync: vi.fn(), ImpactFeedbackStyle: { Light: "light" } }));

import { CountryPicker } from "../components/ui/country-picker";

afterEach(cleanup);

describe("CountryPicker", () => {
  it("filters the list by the search query", () => {
    render(<CountryPicker visible value={undefined} onSelect={() => {}} onClose={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: "thai" } });
    expect(screen.getByText(/Thailand/)).toBeTruthy();
    expect(screen.queryByText(/Germany/)).toBeNull();
  });

  it("calls onSelect with the country code", () => {
    const onSelect = vi.fn();
    render(<CountryPicker visible value={undefined} onSelect={onSelect} onClose={() => {}} />);
    fireEvent.click(screen.getByText(/Thailand/));
    expect(onSelect).toHaveBeenCalledWith("TH");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/country-picker.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `components/ui/country-picker.tsx` — a modal sheet with a search input and
a scrollable list of `searchCountries(query)`, each row showing the country name
and code, calling `onSelect(code)`. Follow the existing modal patterns (see
`components/search/manual-add-sheet.tsx` for the sheet structure and
`components/settings/pill-picker.tsx` for the row styling). Use `useColors()` for
all colors, `IconSymbol` for the search/close icons, and `Haptics.impactAsync` on
select. Props:

```ts
export function CountryPicker({
  visible,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  value?: string;
  onSelect: (code: string) => void;
  onClose: () => void;
}): JSX.Element;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/country-picker.test.tsx && pnpm check`
Expected: PASS (2 tests); 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add components/ui/country-picker.tsx tests/country-picker.test.tsx
git commit -m "feat(destination): searchable country picker"
```

---

### Task 4: Onboarding destination step

**Files:** Modify `components/onboarding/onboarding-screen.tsx`

- [ ] **Step 1: Implement**

Add a 4th step after the existing 3 slides: when `index === SLIDES.length - 1`
and the user taps Next, show a destination step (local state
`step: "slides" | "destination"`) instead of finishing. The destination step
renders a "Where do you ship to?" heading, a `CountryPicker` trigger showing the
selected country (default from `Intl.DateTimeFormat().resolvedOptions().locale`
region if resolvable, else unset), and a "I'm tax-exempt (VAT/EORI)" toggle.
"Finish" persists via the existing settings API (`updateSettings` or the
`setSettings` used elsewhere in onboarding) with `shipToCountry`,
`displayCurrency` (from `getCountry(code)?.currency`), and `taxExempt`, then calls
`setOnboardingSeen()` + `onComplete()`. "Skip" finishes without setting a country.

Read `lib/storage/settings.ts` for the exact update function and
`components/onboarding/onboarding-screen.tsx` for the existing `finish()`.

- [ ] **Step 2: Verify it compiles**

Run: `pnpm check`
Expected: 0 type errors.

- [ ] **Step 3: Commit**

```bash
git add components/onboarding/onboarding-screen.tsx
git commit -m "feat(destination): onboarding ship-to step"
```

---

### Task 5: Product detail — landed-cost ranking

**Files:** Modify `app/product/[id].tsx`

- [ ] **Step 1: Implement**

- Read `shipToCountry`, `taxExempt`, `includeImportEstimate` from settings in the
  existing `loadData` (alongside `shippingRegion`).
- Build `const destination = resolveDestination(settings)` and
  `const options = landedCostOptions(settings)`.
- When `destination` is set, compute the ranked list via
  `rankByLandedCost(listings, destination, options)` and derive `bestDeal` from
  its first row (mapping `LandedCost` → the `BestDeal` shape the card expects:
  `{ distributorId, price, tax: storeTax, shipping, total, currency }`). When
  `destination` is null, keep the existing `findBestDeal(listings, shippingRegion,
  displayCurrency)` path unchanged.
- Pass the destination/options and setters down to
  `DistributorListingSection`.

Read the existing `bestDeal`/`sortedListings` memos and the
`DistributorListingSection` props before editing.

- [ ] **Step 2: Verify it compiles**

Run: `pnpm check`
Expected: 0 type errors.

- [ ] **Step 3: Commit**

```bash
git add app/product/[id].tsx
git commit -m "feat(destination): rank product listings by landed cost"
```

---

### Task 6: Filter bar UI

**Files:** Modify `components/product/distributor-listing-section.tsx`

- [ ] **Step 1: Implement**

Add a landed-cost bar above the existing region chips: a "Ship to" button
(opening `CountryPicker`) showing the selected country name or "Choose country",
a tax-exempt toggle, and an include-import-estimate toggle. Wire the setters
through props from `app/product/[id].tsx` (which persists to settings). When a
destination is active, the best-deal card shows the breakdown
`price + shipping + tax = total` using the `BestDeal` fields; when not, the
existing card is unchanged. Keep the region chips.

- [ ] **Step 2: Verify it compiles**

Run: `pnpm check`
Expected: 0 type errors.

- [ ] **Step 3: Commit**

```bash
git add components/product/distributor-listing-section.tsx
git commit -m "feat(destination): landed-cost filter bar + breakdown"
```

---

### Task 7: Settings "Ship to"

**Files:** Modify `app/(tabs)/settings.tsx`

- [ ] **Step 1: Implement**

Replace the "Shipping Region" `PillPicker` with a "Ship to" row that opens
`CountryPicker` (showing the selected country name), plus a tax-exempt toggle and
an include-import-estimate toggle, all persisting via `updateSetting`. Keep the
`shippingRegion` setting itself (still used by the region chips and fallback).

- [ ] **Step 2: Verify it compiles**

Run: `pnpm check`
Expected: 0 type errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(tabs\)/settings.tsx
git commit -m "feat(destination): settings ship-to + tax toggles"
```

---

### Task 8: Full verification + docs

**Files:** `todo.md`

- [ ] **Step 1: Run the full gate**

Run: `pnpm verify`
Expected: exit 0.

- [ ] **Step 2: Document**

Add a `todo.md` phase entry (next number 1115): the country list, destination
resolver, picker, onboarding step, filter bar, and settings control; note that
per-country shipping rates and repositioned copy remain follow-on.

- [ ] **Step 3: Commit**

```bash
git add todo.md
git commit -m "docs: destination onboarding + filter bar (Phase 1115)"
```

---

## Self-Review

- **Spec coverage:** country list (Task 1), resolver (Task 2), picker (Task 3), onboarding (Task 4), ranking (Task 5), filter bar (Task 6), settings (Task 7), verify + docs (Task 8). Per-country rates and repositioned copy are out of scope per the spec.
- **Placeholders:** none — the country list is seeded with the required codes and a concrete "add ~40 more" instruction with examples; UI tasks name the exact files and patterns to follow.
- **Type consistency:** `Country { code, name, currency, region }`; `resolveDestination(settings): Destination | null`; `landedCostOptions(settings): LandedCostOptions`; `CountryPicker` props; `rankByLandedCost(listings, destination, options)`; the `LandedCost` → `BestDeal` mapping (`tax: storeTax`) is stated once and reused.
- **UI tasks (4-7)** are verified by `pnpm check` (the onboarding step, product-detail wiring, filter bar, and settings are integration edits to existing screens); the pure logic (Tasks 1-2) and the picker (Task 3) are unit-tested. A component test harness exists (`tests/site-sessions-section.test.tsx` uses jsdom + `@testing-library/react`), so Task 3 gets a real test.
