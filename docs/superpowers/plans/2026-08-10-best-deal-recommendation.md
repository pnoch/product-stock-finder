# Best Deal Distributor Recommendation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Best Deal" card to the Product Detail screen (mobile + desktop) that recommends the distributor with the lowest total landed cost (price + shipping to the user's region).

**Architecture:** A shared pure utility `lib/best-deal.ts` computes the recommendation from listings, destination region, and display currency. Shipping costs are added as static data per distributor (`shippingCosts` field). A `shippingRegion` setting lets the user pick their destination. Both mobile and desktop Product Detail screens render a Best Deal card.

**Tech Stack:** TypeScript, Expo Router (mobile), React Router (desktop), existing currency + distributor utilities.

---

## File Structure

### New Files
- `lib/best-deal.ts` — shared best-deal utility
- `tests/best-deal.test.ts` — unit tests

### Modified Files
- `lib/types.ts` — add `shippingCosts` to `Distributor`, `shippingRegion` to `AppSettings`
- `lib/distributors.ts` — add `shippingCosts` to each distributor
- `lib/storage.ts` — add `shippingRegion` default to settings
- `app/(tabs)/settings.tsx` — add shipping region selector
- `app/product/[id].tsx` — add Best Deal card
- `desktop/src/pages/ProductDetail.tsx` — add Best Deal card
- `desktop/src/pages/Settings.tsx` — add shipping region selector

---

## Task 1: Add Types and Settings Default

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/storage.ts`

- [ ] **Step 1: Add shippingCosts to Distributor**

In `lib/types.ts`, add `shippingCosts` to the `Distributor` interface (after `notes`):

```typescript
export interface Distributor {
  id: string;
  name: string;
  country: string;
  countryFlag: string;
  region: string;
  website: string;
  paymentMethods: string[];
  notes?: string;
  shippingCosts?: Record<string, number>; // destination region → shipping cost in distributor's currency
}
```

- [ ] **Step 2: Add shippingRegion to AppSettings**

In `lib/types.ts`, add `shippingRegion` to the `AppSettings` interface:

```typescript
export interface AppSettings {
  theme: "light" | "dark" | "auto";
  displayCurrency: string;
  checkInterval: "manual" | "hourly" | "daily";
  notificationsEnabled: boolean;
  stockAlerts: boolean;
  priceAlerts: boolean;
  enabledDistributors?: string[];
  lastScrapeTime?: string;
  shippingRegion?: string;
}
```

- [ ] **Step 3: Add shippingRegion default to settings**

In `lib/storage.ts`, add `shippingRegion: "Asia-Pacific"` to `DEFAULT_SETTINGS`:

```typescript
  const DEFAULT_SETTINGS: AppSettings = {
    theme: "auto",
    displayCurrency: "USD",
    checkInterval: "manual",
    notificationsEnabled: true,
    stockAlerts: true,
    priceAlerts: true,
    shippingRegion: "Asia-Pacific",
  };
```

- [ ] **Step 4: Run typecheck to verify no errors**

Run: `pnpm check`
Expected: PASS (0 TypeScript errors)

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts lib/storage.ts
git commit -m "feat: add shippingCosts to Distributor and shippingRegion to AppSettings"
```

---

## Task 2: Add Shipping Costs to Distributors

**Files:**
- Modify: `lib/distributors.ts`

- [ ] **Step 1: Add shippingCosts to each distributor**

For each of the 25 distributors in `lib/distributors.ts`, add a `shippingCosts` field. Use reasonable static values in the distributor's native currency. Example for Server2U (MYR):

```typescript
{
  id: "server2u-my",
  name: "Server2U",
  country: "Malaysia",
  countryFlag: "🇲🇾",
  region: "Asia-Pacific",
  website: "https://server2u.com",
  paymentMethods: ["Credit Card", "Online Payment"],
  notes: "In-stock, fastest to Thailand",
  shippingCosts: {
    "Asia-Pacific": 15,
    "Europe": 40,
    "North America": 45,
    "Middle East": 35,
    "Africa": 50,
  },
},
```

Add a `shippingCosts` map to ALL 25 distributors. Use these region keys consistently: `"Asia-Pacific"`, `"Europe"`, `"North America"`, `"Middle East"`, `"Africa"`. Use plausible values in each distributor's native currency (e.g. EUR for European distributors, USD for US, MYR for Malaysia, ZAR for South Africa, etc.).

- [ ] **Step 2: Run typecheck to verify no errors**

Run: `pnpm check`
Expected: PASS (0 TypeScript errors)

- [ ] **Step 3: Commit**

```bash
git add lib/distributors.ts
git commit -m "feat: add shipping costs to all distributors"
```

---

## Task 3: Create Shared Best Deal Utility

**Files:**
- Create: `lib/best-deal.ts`
- Test: `tests/best-deal.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/best-deal.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { findBestDeal } from "@/lib/best-deal";
import type { DistributorListing } from "@/lib/types";

function makeListing(overrides: Partial<DistributorListing> = {}): DistributorListing {
  return {
    distributorId: "server2u-my",
    productId: "p1",
    price: 100,
    currency: "USD",
    stockStatus: "in_stock",
    url: "x",
    lastChecked: "2026-01-01",
    priceHistory: [],
    ...overrides,
  };
}

describe("findBestDeal", () => {
  it("returns the lowest total landed cost (price + shipping)", () => {
    const listings = [
      makeListing({ distributorId: "server2u-my", price: 100, currency: "USD" }), // shipping 15 → 115
      makeListing({ distributorId: "linitx-uk", price: 90, currency: "USD" }), // shipping 25 → 115
      makeListing({ distributorId: "interprojekt-pl", price: 80, currency: "USD" }), // shipping 30 → 110
    ];
    const deal = findBestDeal(listings, "Asia-Pacific", "USD");
    expect(deal).not.toBeNull();
    expect(deal!.distributorId).toBe("interprojekt-pl");
    expect(deal!.total).toBeCloseTo(110, 2);
  });

  it("skips out-of-stock listings", () => {
    const listings = [
      makeListing({ distributorId: "server2u-my", price: 100, stockStatus: "out_of_stock" }),
      makeListing({ distributorId: "linitx-uk", price: 90, stockStatus: "in_stock" }),
    ];
    const deal = findBestDeal(listings, "Asia-Pacific", "USD");
    expect(deal!.distributorId).toBe("linitx-uk");
  });

  it("skips listings with no shipping data for the region", () => {
    const listings = [
      makeListing({ distributorId: "server2u-my", price: 100 }), // has shipping
      makeListing({ distributorId: "unknown-dist", price: 50 }), // no distributor → no shipping
    ];
    const deal = findBestDeal(listings, "Asia-Pacific", "USD");
    expect(deal!.distributorId).toBe("server2u-my");
  });

  it("converts price and shipping to display currency", () => {
    const listings = [
      makeListing({ distributorId: "server2u-my", price: 100, currency: "USD" }),
    ];
    // server2u shipping to Asia-Pacific is 15 MYR
    const deal = findBestDeal(listings, "Asia-Pacific", "USD");
    expect(deal!.currency).toBe("USD");
    expect(deal!.price).toBeCloseTo(100, 2);
    expect(deal!.shipping).toBeGreaterThan(0);
    expect(deal!.total).toBeCloseTo(deal!.price + deal!.shipping, 2);
  });

  it("returns null with no in-stock listings", () => {
    const listings = [
      makeListing({ stockStatus: "out_of_stock" }),
      makeListing({ stockStatus: "back_order" }),
    ];
    const deal = findBestDeal(listings, "Asia-Pacific", "USD");
    expect(deal).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/best-deal.test.ts`
Expected: FAIL with "Cannot find module '@/lib/best-deal'"

- [ ] **Step 3: Write minimal implementation**

Create `lib/best-deal.ts`:

```typescript
import type { DistributorListing } from "./types";
import { getDistributorById } from "./distributors";
import { convertPrice } from "./currency";

export interface BestDeal {
  distributorId: string;
  price: number;
  shipping: number;
  total: number;
  currency: string;
}

export function findBestDeal(
  listings: DistributorListing[],
  destinationRegion: string,
  displayCurrency: string,
): BestDeal | null {
  let best: BestDeal | null = null;

  for (const listing of listings) {
    if (listing.stockStatus !== "in_stock" || listing.price <= 0) continue;
    const distributor = getDistributorById(listing.distributorId);
    if (!distributor?.shippingCosts) continue;
    const shippingCost = distributor.shippingCosts[destinationRegion];
    if (shippingCost == null) continue;

    const price = convertPrice(listing.price, listing.currency, displayCurrency);
    const shipping = convertPrice(shippingCost, listing.currency, displayCurrency);
    const total = price + shipping;

    if (!best || total < best.total) {
      best = {
        distributorId: listing.distributorId,
        price,
        shipping,
        total,
        currency: displayCurrency,
      };
    }
  }

  return best;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/best-deal.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/best-deal.ts tests/best-deal.test.ts
git commit -m "feat: add best deal utility with tests"
```

---

## Task 4: Add Shipping Region Selector to Mobile Settings

**Files:**
- Modify: `app/(tabs)/settings.tsx`

- [ ] **Step 1: Add regions array**

In the `SettingsScreen` component, add a `regions` array (near the `currencies` array at line 240):

```typescript
const regions = ["Asia-Pacific", "Europe", "North America", "Middle East", "Africa"];
```

- [ ] **Step 2: Add shipping region selector UI**

Find the Display Currency section (around line 420). After it, add a Shipping Region section with the same chip-row pattern:

```tsx
<View style={{ flexDirection: "row", alignItems: "center", marginTop: 20 }}>
  <IconSymbol name="globe" size={20} color={colors.primary} />
  <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 15, marginLeft: 8 }}>
    Shipping Region
  </Text>
</View>
<View
  style={{
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingLeft: 28,
    marginTop: 8,
  }}
>
  {regions.map((r) => (
    <TouchableOpacity
      key={r}
      onPress={() => updateSetting("shippingRegion", r)}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor:
          (settings.shippingRegion ?? "Asia-Pacific") === r
            ? colors.primary
            : colors.border,
      }}
    >
      <Text
        style={{
          color:
            (settings.shippingRegion ?? "Asia-Pacific") === r
              ? "#fff"
              : colors.foreground,
          fontWeight: "600",
          fontSize: 13,
        }}
      >
        {r}
      </Text>
    </TouchableOpacity>
  ))}
</View>
```

Note: `IconSymbol` is already imported. `updateSetting` is already defined.

- [ ] **Step 3: Run typecheck to verify no errors**

Run: `pnpm check`
Expected: PASS (0 TypeScript errors)

- [ ] **Step 4: Commit**

```bash
git add app/(tabs)/settings.tsx
git commit -m "feat: add shipping region selector to mobile settings"
```

---

## Task 5: Add Best Deal Card to Mobile Product Detail

**Files:**
- Modify: `app/product/[id].tsx`

- [ ] **Step 1: Add import**

Add to the imports in `app/product/[id].tsx`:

```typescript
import { findBestDeal } from "@/lib/best-deal";
```

- [ ] **Step 2: Compute the best deal**

After `bestInStockListing` is defined (around line 596), add:

```typescript
const bestDeal = useMemo(
  () => findBestDeal(visibleListings, shippingRegion, displayCurrency),
  [visibleListings, shippingRegion, displayCurrency],
);
```

Note: `shippingRegion` needs to be loaded from settings. Add it to the state and load it in the same place `displayCurrency` is loaded (in the `useFocusEffect` that calls `getSettings`). Add:

```typescript
const [shippingRegion, setShippingRegion] = useState("Asia-Pacific");
```

And in the settings load, add `setShippingRegion(settings.shippingRegion ?? "Asia-Pacific")`.

- [ ] **Step 3: Render the Best Deal card**

Find where the `BestDistributorCard` is rendered (around line 1246). Add a Best Deal card above it:

```tsx
{bestDeal && (
  <View
    style={{
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    }}
  >
    <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", letterSpacing: 0.5 }}>
      BEST DEAL (incl. shipping to {shippingRegion})
    </Text>
    {(() => {
      const distrib = getDistributorById(bestDeal.distributorId);
      return (
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700", flex: 1 }}>
            {distrib?.countryFlag} {distrib?.name ?? bestDeal.distributorId}
          </Text>
          <Text style={{ color: colors.primary, fontSize: 18, fontWeight: "700" }}>
            {formatPrice(bestDeal.total, bestDeal.currency)}
          </Text>
        </View>
      );
    })()}
    <View style={{ flexDirection: "row", marginTop: 8, gap: 16 }}>
      <Text style={{ color: colors.muted, fontSize: 12 }}>
        Price: {formatPrice(bestDeal.price, bestDeal.currency)}
      </Text>
      <Text style={{ color: colors.muted, fontSize: 12 }}>
        Shipping: {formatPrice(bestDeal.shipping, bestDeal.currency)}
      </Text>
    </View>
  </View>
)}
```

Note: `getDistributorById` and `formatPrice` are already imported.

- [ ] **Step 4: Run typecheck to verify no errors**

Run: `pnpm check`
Expected: PASS (0 TypeScript errors)

- [ ] **Step 5: Commit**

```bash
git add app/product/[id].tsx
git commit -m "feat: add best deal card to mobile product detail"
```

---

## Task 6: Add Shipping Region Selector to Desktop Settings

**Files:**
- Modify: `desktop/src/pages/Settings.tsx`

- [ ] **Step 1: Add shipping region selector**

Find the Display Currency section (around line 88). After it, add a Shipping Region section:

```tsx
{/* Shipping Region Section */}
<div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
  <div className="flex items-center gap-3 mb-4">
    <Globe className="w-5 h-5 text-brand-600 dark:text-brand-400" />
    <h2 className="text-lg font-semibold">Shipping Region</h2>
  </div>
  <select
    value={settings.shippingRegion ?? "Asia-Pacific"}
    onChange={(e) => update({ shippingRegion: e.target.value })}
    className="w-full max-w-xs px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
  >
    {["Asia-Pacific", "Europe", "North America", "Middle East", "Africa"].map((region) => (
      <option key={region} value={region}>
        {region}
      </option>
    ))}
  </select>
</div>
```

Note: `Globe` needs to be imported from `lucide-react`. Add it to the existing lucide import.

- [ ] **Step 2: Run typecheck to verify no errors**

Run: `pnpm --filter desktop check`
Expected: PASS (0 TypeScript errors)

- [ ] **Step 3: Commit**

```bash
git add desktop/src/pages/Settings.tsx
git commit -m "feat: add shipping region selector to desktop settings"
```

---

## Task 7: Add Best Deal Card to Desktop Product Detail

**Files:**
- Modify: `desktop/src/pages/ProductDetail.tsx`

- [ ] **Step 1: Add import**

Add to the imports in `desktop/src/pages/ProductDetail.tsx`:

```typescript
import { findBestDeal } from "../../../lib/best-deal";
```

- [ ] **Step 2: Compute the best deal**

After `bestDistributor` is defined, add:

```typescript
const bestDeal = useMemo(
  () => findBestDeal(visibleListings, shippingRegion, displayCurrency),
  [visibleListings, shippingRegion, displayCurrency],
);
```

Note: `shippingRegion` needs to be loaded from settings. Add it to the state and load it where `displayCurrency` is loaded. Add:

```typescript
const [shippingRegion, setShippingRegion] = useState("Asia-Pacific");
```

And in the settings load, add `setShippingRegion(settings.shippingRegion ?? "Asia-Pacific")`.

- [ ] **Step 3: Render the Best Deal card**

Find where the best-price card is rendered. Add a Best Deal card above it:

```tsx
{bestDeal && (
  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
      Best Deal (incl. shipping to {shippingRegion})
    </p>
    {(() => {
      const distrib = DISTRIBUTORS.find(
        (d) => d.id === bestDeal.distributorId,
      );
      return (
        <div className="flex items-center justify-between mt-2">
          <p className="text-base font-bold">
            {distrib?.countryFlag} {distrib?.name ?? bestDeal.distributorId}
          </p>
          <p className="text-lg font-bold text-brand-600 dark:text-brand-400">
            {formatPrice(bestDeal.total, bestDeal.currency)}
          </p>
        </div>
      );
    })()}
    <div className="flex gap-4 mt-2">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Price: {formatPrice(bestDeal.price, bestDeal.currency)}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Shipping: {formatPrice(bestDeal.shipping, bestDeal.currency)}
      </p>
    </div>
  </div>
)}
```

Note: `DISTRIBUTORS` and `formatPrice` are already imported in the desktop ProductDetail.

- [ ] **Step 4: Run typecheck to verify no errors**

Run: `pnpm --filter desktop check`
Expected: PASS (0 TypeScript errors)

- [ ] **Step 5: Commit**

```bash
git add desktop/src/pages/ProductDetail.tsx
git commit -m "feat: add best deal card to desktop product detail"
```

---

## Task 8: Final Verification

- [ ] **Step 1: Run all checks**

```bash
pnpm check
pnpm lint
pnpm test
pnpm --filter desktop check
pnpm --filter desktop test
```

Expected: All pass

- [ ] **Step 2: Update todo.md**

Add Phase 20 entry for the best deal recommendation.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "docs: add Phase 20 best deal recommendation to todo.md"
```
