# Desktop Parity Sweep — Thin Wrappers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining desktop parity deltas while preserving the existing shared-source architecture (`@shared/*` consumed by desktop, RN-specific wrappers retained in `lib/`).

**Architecture:** Desktop continues to import pure helpers from `@shared/catalog`, `@shared/currency`, and `@shared/compare-utils`, plus storage-aware helpers from `lib/fx`, while keeping desktop-only shells and RN/native stubs at the Vite boundary. New tests lock import paths, shared-helper behavior, and the three parity screens.

**Tech Stack:** TypeScript 5.9, React 19, React Router 7, Vite 6, Vitest 2.1.9, Testing Library, tRPC v11, Tailwind 4, Expo SDK 54.

---

## File Structure

- Shared behavior remains in:
  - `shared/src/catalog.ts`
  - `shared/src/currency.ts`
  - `shared/src/distributors.ts`
  - `shared/src/fx.ts`
  - `shared/src/trending.ts`
  - `shared/src/compare-utils.ts`
- Platform/API-aware behavior remains in:
  - `lib/catalog.ts`
  - `lib/currency.ts`
  - `lib/distributors.ts`
  - `lib/fx.ts`
  - `lib/trending.ts`
  - `lib/compare-utils.ts`
- Desktop behavior remains in:
  - `desktop/src/pages/Rates.tsx`
  - `desktop/src/pages/Search.tsx`
  - `desktop/src/components/SearchModal.tsx`
  - `desktop/src/pages/Watchlist.tsx`
  - `desktop/src/App.tsx`
  - `desktop/src/components/Sidebar.tsx`
- Boundary/configuration remains in:
  - `desktop/vite.config.ts`
  - `tsconfig.json`
  - `desktop/tsconfig.json`
  - `vitest.config.ts`
  - `desktop/tests/setup.ts`

---

### Task 1: Lock the current shared-source architecture

**Files:**
- Create: `tests/shared-boundary.test.ts`
- Modify: `vitest.config.ts`
- Test: `tests/shared-boundary.test.ts`

- [ ] **Step 1: Write the failing boundary test**

Create `tests/shared-boundary.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

const desktopPages = [
  "desktop/src/pages/Rates.tsx",
  "desktop/src/pages/Search.tsx",
  "desktop/src/pages/Watchlist.tsx",
  "desktop/src/components/SearchModal.tsx",
];

describe("desktop parity architecture", () => {
  it("keeps desktop on shared or lib boundaries", async () => {
    for (const file of desktopPages) {
      const text = await readFile(file, "utf8");
      expect(text).toMatch(/@shared\//);
      expect(text).not.toMatch(/from ["']\.\.\/\.\.\/(shared|catalog|currency|distributors|fx|trending|compare-utils)/);
    }
  });

  it("keeps lib wrappers as re-exports rather than duplicated logic", async () => {
    const catalogWrapper = await readFile("lib/catalog.ts", "utf8");
    expect(catalogWrapper).toContain('export * from "@shared/catalog"');
  });
});
```

- [ ] **Step 2: Run the boundary test and confirm the import failure**

```bash
pnpm exec vitest run tests/shared-boundary.test.ts
```

Expected: the second assertion fails if any remaining desktop page imports a shared module through a root-relative path instead of `@shared/*`.

- [ ] **Step 3: Verify the vitest shared-source aliases**

Confirm `vitest.config.ts` already contains:

```typescript
resolve: {
  alias: {
    "@shared": path.resolve(__dirname, "./shared/src"),
    "@": path.resolve(__dirname, "."),
  },
},
```

Do not duplicate these aliases; only repair them if the checked-out file has drifted.

- [ ] **Step 4: Normalize the remaining relative shared imports**

In the three parity pages/components identified by the failing test, replace imports of the form:

```typescript
import { maybeRefreshFxRates } from "../../../lib/fx";
```

with the established boundary:

```typescript
import { maybeRefreshFxRates } from "@/lib/fx";
```

or:

```typescript
import { maybeRefreshFxRates } from "@shared/fx";
```

Use `@shared/fx` only when no AsyncStorage-backed wrapper is required; otherwise use `@/lib/fx`.

- [ ] **Step 5: Run boundary test and typecheck**

```bash
pnpm exec vitest run tests/shared-boundary.test.ts
pnpm check
```

Expected: both commands exit with code 0.

- [ ] **Step 6: Commit**

```bash
git add tests/shared-boundary.test.ts vitest.config.ts desktop/src/pages/Rates.tsx desktop/src/pages/Search.tsx desktop/src/components/SearchModal.tsx desktop/src/pages/Watchlist.tsx
git commit -m "test: lock desktop shared-source boundary for parity pages"
```

---

### Task 2: Add shared-helper regression coverage for Rates, Search, and Watchlist

**Files:**
- Create: `tests/desktop-parity-shared-helpers.test.ts`
- Modify: `shared/src/catalog.ts`
- Modify: `shared/src/currency.ts`
- Modify: `shared/src/compare-utils.ts`
- Modify: `shared/src/fx.ts`
- Test: `tests/desktop-parity-shared-helpers.test.ts`

- [ ] **Step 1: Write failing shared-helper tests**

Create `tests/desktop-parity-shared-helpers.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  PRODUCT_CATALOG,
  getAllBrands,
  getAllCategories,
  searchCatalog,
} from "@shared/catalog";
import {
  CURRENCY_SYMBOLS,
  EXCHANGE_RATES,
  convertPrice,
  formatPrice,
  getBestPrice,
} from "@shared/currency";
import { cheapestByRegion, filterByRange } from "@shared/compare-utils";
import { FX_TTL_MS } from "@shared/fx";

describe("desktop parity shared helpers", () => {
  it("uses Fuse 0.4 search behavior", () => {
    const results = searchCatalog("CRS804");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].modelNumber).toContain("CRS804");
  });

  it("exposes category and brand taxonomies", () => {
    expect(getAllCategories()).toContain("Router");
    expect(getAllBrands()).toContain("MikroTik");
    expect(PRODUCT_CATALOG.length).toBeGreaterThan(0);
  });

  it("converts and formats prices safely", () => {
    expect(convertPrice(100, "USD", "EUR")).not.toBeNull();
    expect(convertPrice(100, "USD", "UNKNOWN")).toBeNull();
    expect(formatPrice(1181.67, "EUR")).toContain(CURRENCY_SYMBOLS.EUR);
  });

  it("selects best prices only in supported currencies", () => {
    const best = getBestPrice(
      [
        {
          price: 100,
          currency: "USD",
          stockStatus: "in_stock",
        },
        {
          price: 50,
          currency: "UNKNOWN",
          stockStatus: "in_stock",
        },
      ],
      "USD",
    );
    expect(best?.price).toBe(100);
  });

  it("constrains compare ranges to valid data", () => {
    const filtered = filterByRange(
      [
        { date: "2026-01-01T00:00:00.000Z", price: 100, currency: "USD", stockStatus: "in_stock" },
        { date: "not-a-date", price: 200, currency: "USD", stockStatus: "in_stock" },
      ],
      "1W",
    );
    expect(filtered.every((point) => !Number.isNaN(Date.parse(point.date)))).toBe(true);
  });

  it("uses the hourly FX cache window", () => {
    expect(FX_TTL_MS).toBe(60 * 60 * 1000);
    expect(Object.keys(EXCHANGE_RATES)).toContain("USD");
  });

  it("ignores unrecognized listings when choosing regional best prices", () => {
    const best = cheapestByRegion(
      [
        {
          productId: "p1",
          distributorId: "unknown-distributor",
          price: 1,
          currency: "USD",
          stockStatus: "in_stock",
          url: "https://example.com",
          lastChecked: new Date().toISOString(),
          priceHistory: [],
        },
      ],
      "USD",
    );
    expect(best).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the shared-helper tests**

```bash
pnpm exec vitest run tests/desktop-parity-shared-helpers.test.ts
```

Expected: the command exits with code 0 and all seven assertions pass.

- [ ] **Step 3: Preserve the live-rate and storage behavior in `lib/` wrappers**

Do not move `setExchangeRates`, AsyncStorage persistence, `liveRates`, `effectiveRates`, or other side effects into `shared/`. Verify these exports remain in the wrappers:

```bash
grep -R "setExchangeRates\|liveRates\|AsyncStorage" -n lib/currency.ts lib/fx.ts
```

Expected: `lib/currency.ts` still owns mutable live-rate state, and `lib/fx.ts` still owns AsyncStorage persistence.

- [ ] **Step 4: Run root tests**

```bash
pnpm test
```

Expected: the command exits with code 0 and reports every runnable test file as passed.

- [ ] **Step 5: Commit**

```bash
git add tests/desktop-parity-shared-helpers.test.ts shared/src/catalog.ts shared/src/currency.ts shared/src/compare-utils.ts shared/src/fx.ts
git commit -m "test: add shared-helper regression coverage for desktop parity"
```

---

### Task 3: Add desktop Rates, Search, and Watchlist interaction coverage

**Files:**
- Create: `desktop/tests/parity-rates-search-watchlist.test.tsx`
- Modify: `desktop/src/pages/Rates.tsx`
- Modify: `desktop/src/pages/Search.tsx`
- Modify: `desktop/src/components/SearchModal.tsx`
- Modify: `desktop/src/pages/Watchlist.tsx`
- Test: `desktop/tests/parity-rates-search-watchlist.test.tsx`

- [ ] **Step 1: Write failing desktop interaction tests**

Create `desktop/tests/parity-rates-search-watchlist.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { Rates } from "../src/pages/Rates";
import { Search } from "../src/pages/Search";
import { Watchlist } from "../src/pages/Watchlist";

const mockStorage = vi.hoisted(() => ({
  getWatchlist: vi.fn(),
  getSettings: vi.fn(),
  getFxHistory: vi.fn(),
  getDiscoveredProducts: vi.fn(),
  addToWatchlist: vi.fn(),
  removeFromWatchlist: vi.fn(),
}));

vi.mock("../src/storage", () => ({ storage: mockStorage }));

beforeEach(() => {
  mockStorage.getWatchlist.mockResolvedValue([]);
  mockStorage.getSettings.mockResolvedValue({ displayCurrency: "USD" });
  mockStorage.getFxHistory.mockResolvedValue(null);
  mockStorage.getDiscoveredProducts.mockResolvedValue([]);
});

describe("desktop parity pages", () => {
  it("renders the Rates exchange grid and refresh control", async () => {
    render(
      <MemoryRouter>
        <Rates />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText("Exchange Rates")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Refresh rates")).toBeInTheDocument();
  });

  it("supports bulk-select mode on Watchlist", async () => {
    render(
      <MemoryRouter>
        <Watchlist />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByLabelText("Enter bulk select mode"));
    await waitFor(() => {
      expect(screen.getByText("Cancel")).toBeInTheDocument();
    });
  });

  it("searches the shared catalog through the desktop page", async () => {
    render(
      <MemoryRouter>
        <Search />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText("Search products"), {
      target: { value: "CRS804" },
    });
    await waitFor(() => {
      expect(screen.getByText(/result/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run desktop interaction tests**

```bash
pnpm --filter desktop run test -- parity-rates-search-watchlist.test.tsx
```

Expected: failing tests identify missing labels, missing controls, or broken storage mocks before implementation changes.

- [ ] **Step 3: Fix only the uncovered parity behavior**

Keep the existing Rates, Search/SearchModal, and Watchlist UI. Add only behavior required by the failing tests:

```tsx
<button
  type="button"
  onClick={() => setSelectionMode(true)}
  aria-label="Enter bulk select mode"
>
  Select
</button>
```

```tsx
<button
  type="button"
  onClick={onRefresh}
  disabled={refreshing}
  aria-label="Refresh rates"
>
  {refreshing ? "Refreshing" : "Refresh"}
</button>
```

Do not rebuild or restyle completed pages.

- [ ] **Step 4: Re-run the desktop parity suite**

```bash
pnpm --filter desktop run test -- parity-rates-search-watchlist.test.tsx
```

Expected: the command exits with code 0 and all three tests pass.

- [ ] **Step 5: Commit**

```bash
git add desktop/tests/parity-rates-search-watchlist.test.tsx desktop/src/pages/Rates.tsx desktop/src/pages/Search.tsx desktop/src/components/SearchModal.tsx desktop/src/pages/Watchlist.tsx
git commit -m "test: add desktop parity coverage for Rates, Search, and Watchlist"
```

---

### Task 4: Verify desktop and Expo consumers end to end

**Files:**
- Modify: `desktop/src/App.tsx`
- Modify: `desktop/src/components/Sidebar.tsx`
- Modify: `desktop/vite.config.ts`
- Test: `desktop/tests/parity-rates-search-watchlist.test.tsx`

- [ ] **Step 1: Confirm the Rates route and sidebar entry**

Verify:

```tsx
import { Rates } from "./pages/Rates";

<Route path="/rates" element={<Rates />} />
```

and:

```tsx
{ to: "/rates", icon: DollarSign, label: "Rates" },
```

are present in `desktop/src/App.tsx` and `desktop/src/components/Sidebar.tsx`. Add only a missing route/entry using the repository's existing React Router pattern.

- [ ] **Step 2: Preserve web, native, and stub boundaries**

Verify `desktop/vite.config.ts` still contains:

```typescript
{
  find: "@shared",
  replacement: path.resolve(__dirname, "../shared/src"),
},
```

and the existing stubs for:

```typescript
"@react-native-async-storage/async-storage"
"browser.web.ts"
"react-native-stub.ts"
"expo-secure-store-stub.ts"
"expo-linking-stub.ts"
```

Do not add new bundler aliases unless receipt of a failing import requires it.

- [ ] **Step 3: Run all verification commands**

```bash
pnpm check
pnpm test
pnpm --filter desktop run check
pnpm --filter desktop run build
```

Expected: all four commands exit with code 0.

- [ ] **Step 4: Push only when green**

```bash
git push origin main
```

Expected: the remote accepts the already-committed work.

## Self-Review

- Spec coverage: Rates, Search, and Watchlist are covered by Tasks 1-3; import strategy, build verification, and testing requirements from the design are covered by Tasks 1 and 4.
- Placeholder scan: no `TBD`, `TODO`, generic validation, deferred tests, “similar to Task N,” or undefined APIs remain.
- Type consistency: `PRODUCT_CATALOG`, `getAllCategories`, `getAllBrands`, `convertPrice`, `formatPrice`, `getBestPrice`, `filterByRange`, `cheapestByRegion`, `FX_TTL_MS`, `refreshFxRates`, and `fetchTrending` match the current shared and wrapper implementations.
