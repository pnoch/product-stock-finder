# Buy Last-Mile — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Carry the store URL in restock notifications, add a watchlist Buy button, and add a best-deal Visit CTA — so the app is one tap from the purchase.

**Architecture:** `scheduleStockAlert` gains `url`/`distributorId`; `deliverRestock` passes the first in-stock listing's; the watchlist card gains a Buy button opening `openListingUrl`; the best-deal card gains a Visit CTA.

**Tech Stack:** TypeScript, React Native / Expo, vitest.

**Spec:** `docs/superpowers/specs/2026-10-06-buy-last-mile-design.md`

---

## File Structure

- Modify `lib/notifications.ts` — `scheduleStockAlert` params + `data`.
- Modify `lib/restock.ts` — pass `distributorId`/`url` through `deliverRestock`.
- Modify `components/watchlist/product-card.tsx` — the Buy button.
- Modify `components/product/distributor-listing-section.tsx` — the Visit CTA.
- Tests: `tests/notifications-stock-url.test.ts`, `tests/product-card-buy.test.tsx`, extend `tests/restock-any-scope.test.ts`.

---

### Task 1: Notification payload

**Files:** Modify `lib/notifications.ts`, `lib/restock.ts`; Tests `tests/notifications-stock-url.test.ts`, extend `tests/restock-any-scope.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/notifications-stock-url.test.ts` (mirror the expo-notifications mock in `tests/price-check.test.ts` — read it):

```ts
import { describe, expect, it, vi } from "vitest";
// …mock expo-notifications so scheduleNotificationAsync is a vi.fn…
import { scheduleStockAlert } from "../lib/notifications";

describe("scheduleStockAlert", () => {
  it("carries the store url and distributor id in the payload", async () => {
    await scheduleStockAlert(
      "CRS804",
      "Getic",
      209,
      "USD",
      "p1",
      "getic-gr",
      "https://getic.example/p/crs804",
    );
    const call = (Notifications.scheduleNotificationAsync as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]![0] as {
      content: { data: Record<string, unknown> };
    };
    expect(call.content.data).toMatchObject({
      type: "stock_alert",
      productId: "p1",
      distributorId: "getic-gr",
      url: "https://getic.example/p/crs804",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/notifications-stock-url.test.ts`
Expected: FAIL — the extra args are ignored.

- [ ] **Step 3: Implement**

In `lib/notifications.ts`, extend `scheduleStockAlert`:

```ts
export async function scheduleStockAlert(
  productName: string,
  distributorName: string,
  price: number,
  currency: string,
  productId?: string,
  distributorId?: string,
  url?: string,
): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Back In Stock!",
        body: `${productName} is now available at ${distributorName} for ${currency} ${price.toFixed(2)}`,
        data: { type: "stock_alert", productName, distributorName, productId, distributorId, url },
        sound: "default",
      },
      trigger: immediateTrigger("stock"),
    });
    return id;
  } catch {
    return null;
  }
}
```

In `lib/restock.ts`, thread the listing through `deliverRestock`. Change its signature to accept the triggering listing:

```ts
  async function deliverRestock(
    watch: BackOrderReminder,
    body: string,
    names: string,
    price: number,
    currency: string,
    distributorId?: string,
    url?: string,
  ): Promise<boolean> {
    // …unchanged…
      const id = await scheduleStockAlert(
        watch.productName,
        names,
        price,
        currency,
        watch.productId,
        distributorId,
        url,
      );
    // …unchanged…
  }
```

At the `"any"` call site (~line 128), pass `first.distributorId, first.url`. At the per-distributor call site (~line 175), pass `watch.distributorId, currentListing.url` (read the file to find the exact variable names there).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/notifications-stock-url.test.ts tests/restock-any-scope.test.ts && pnpm check`
Expected: PASS; 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add lib/notifications.ts lib/restock.ts tests/notifications-stock-url.test.ts tests/restock-any-scope.test.ts
git commit -m "feat(buy): carry the store url in restock notifications"
```

---

### Task 2: Watchlist Buy button

**Files:** Modify `components/watchlist/product-card.tsx`; Test `tests/product-card-buy.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/product-card-buy.test.tsx` (mirror the jsdom harness in `tests/availability-card.test.tsx`; mock `react-native` with `View`/`Text`/`Pressable`/`TouchableOpacity`/`Animated`, `@/hooks/use-colors`, `@/components/stock-badge`, `@/components/ui/icon-symbol`, `@/lib/listing-utils`):

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
    Pressable: ({ children, onPress, accessibilityLabel, ...r }: any) =>
      React.createElement("button", { ...r, "aria-label": accessibilityLabel, onClick: onPress }, children),
    TouchableOpacity: ({ children, onPress, accessibilityLabel, ...r }: any) =>
      React.createElement("button", { ...r, "aria-label": accessibilityLabel, onClick: onPress }, children),
    Animated: { View: ({ children, ...r }: any) => React.createElement("div", r, children) },
    Platform: { OS: "ios" },
  };
});
vi.mock("@/hooks/use-colors", () => ({
  useColors: () => ({ foreground: "#111", muted: "#888", primary: "#0F52BA", success: "#0a0", border: "#ddd", surface: "#fff", error: "#f00", warning: "#fa0" }),
}));
vi.mock("@/components/stock-badge", () => ({ StockBadge: () => null }));
vi.mock("@/components/ui/icon-symbol", () => ({ IconSymbol: () => null }));
const openListingUrl = vi.fn(async () => {});
vi.mock("@/lib/listing-utils", () => ({ openListingUrl: (u: string) => openListingUrl(u) }));

import { ProductCard } from "../components/watchlist/product-card";

afterEach(() => {
  cleanup();
  openListingUrl.mockClear();
});

const base = {
  onPress: () => {}, onDelete: () => {}, onTagPress: () => {},
  tagDefinitions: {}, displayCurrency: "USD",
};

const inStock = {
  id: "p1", name: "CRS804", modelNumber: "CRS804-4DDQ-hRM", brand: "MikroTik",
  category: "Networking Switch", isWatched: true, addedAt: "2026-01-01T00:00:00.000Z",
  listings: [{ distributorId: "getic-gr", productId: "p1", price: 209, currency: "USD", stockStatus: "in_stock", url: "https://getic.example/p", lastChecked: "2026-01-01T00:00:00.000Z", priceHistory: [] }],
};

describe("ProductCard buy button", () => {
  it("opens the cheapest in-stock store", () => {
    render(<ProductCard {...(base as any)} product={inStock as any} />);
    fireEvent.click(screen.getByLabelText(/buy/i));
    expect(openListingUrl).toHaveBeenCalledWith("https://getic.example/p");
  });

  it("omits the buy button when nothing is in stock", () => {
    const out = { ...inStock, listings: [{ ...inStock.listings[0], stockStatus: "out_of_stock" }] };
    render(<ProductCard {...(base as any)} product={out as any} />);
    expect(screen.queryByLabelText(/buy/i)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/product-card-buy.test.tsx`
Expected: FAIL — no Buy button.

- [ ] **Step 3: Implement**

In `components/watchlist/product-card.tsx`:
- Import `openListingUrl` from `@/lib/listing-utils`.
- Add the memo:
```ts
  const bestInStockListing = useMemo(() => {
    const inStock = (product.listings ?? []).filter(
      (l) => l.stockStatus === "in_stock" && l.price > 0 && Number.isFinite(l.price),
    );
    if (inStock.length === 0) return null;
    return inStock.reduce((best, l) => (l.price < best.price ? l : best));
  }, [product.listings]);
```
- Render a Buy button near the price/StockBadge (line ~373), only when `bestInStockListing`:
```tsx
          {bestInStockListing && (
            <TouchableOpacity
              activeOpacity={0.85}
              accessibilityLabel={`Buy ${product.name} at the cheapest in-stock store`}
              accessibilityRole="button"
              onPress={(e) => {
                e?.stopPropagation?.();
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                void openListingUrl(bestInStockListing.url);
              }}
              style={{
                flexDirection: "row", alignItems: "center", gap: 4,
                paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14,
                backgroundColor: colors.primary + "22",
              }}
            >
              <IconSymbol name="cart.fill" size={13} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 12 }}>Buy</Text>
            </TouchableOpacity>
          )}
```
(Import `Haptics` from `expo-haptics` and `Platform` from `react-native` if not already imported; verify `cart.fill` is mapped in `icon-symbol.tsx`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/product-card-buy.test.tsx && pnpm check`
Expected: PASS (2 tests); 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add components/watchlist/product-card.tsx tests/product-card-buy.test.tsx
git commit -m "feat(buy): watchlist Buy button"
```

---

### Task 3: Best-deal Visit CTA + full verification + docs

**Files:** Modify `components/product/distributor-listing-section.tsx`; Test `tests/best-deal-visit-guard.test.ts`; `todo.md`

- [ ] **Step 1: Write the failing guard test**

Create `tests/best-deal-visit-guard.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("best-deal visit CTA", () => {
  it("the best-deal card offers a Visit action that opens the listing url", () => {
    const src = readFileSync(
      join(__dirname, "..", "components/product/distributor-listing-section.tsx"),
      "utf8",
    );
    expect(src).toContain("openListingUrl");
    expect(src).toMatch(/Visit store/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/best-deal-visit-guard.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

In `components/product/distributor-listing-section.tsx`:
- Import `openListingUrl` from `@/lib/listing-utils`.
- Inside the `bestDeal` card, after the breakdown, add a Visit button that resolves the best-deal distributor's listing URL:
```tsx
              {(() => {
                const listing = sortedListings.find(
                  (l) => l.distributorId === bestDeal.distributorId && l.url,
                );
                if (!listing) return null;
                return (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    accessibilityLabel="Visit store"
                    accessibilityRole="button"
                    onPress={() => void openListingUrl(listing.url)}
                    style={{
                      marginTop: 10, alignSelf: "flex-start",
                      flexDirection: "row", alignItems: "center", gap: 6,
                      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16,
                      backgroundColor: colors.primary,
                    }}
                  >
                    <IconSymbol name="arrow.up.right.square" size={14} color="#fff" />
                    <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>Visit store</Text>
                  </TouchableOpacity>
                );
              })()}
```
(Verify `TouchableOpacity`, `IconSymbol`, and `arrow.up.right.square` are imported/mapped.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/best-deal-visit-guard.test.ts && pnpm check`
Expected: PASS; 0 type errors.

- [ ] **Step 5: Run the full gate**

Run: `pnpm verify`
Expected: exit 0.

- [ ] **Step 6: Document**

Add a `todo.md` phase entry (next number 1131): the notification URL payload, the watchlist Buy button, the best-deal Visit CTA, and the note that desktop parity + cart/checkout are deferred.

- [ ] **Step 7: Commit**

```bash
git add components/product/distributor-listing-section.tsx tests/best-deal-visit-guard.test.ts todo.md
git commit -m "feat(buy): best-deal Visit CTA + docs (Phase 1131)"
```

---

## Self-Review

- **Spec coverage:** notification payload (Task 1), watchlist Buy (Task 2), best-deal Visit + verify + docs (Task 3). Desktop parity and cart/checkout are out of scope per the spec.
- **Placeholders:** none — the payload, the memo, the buttons, and the tests are given verbatim.
- **Type consistency:** `scheduleStockAlert(..., productId?, distributorId?, url?)`; `deliverRestock(..., distributorId?, url?)`; `bestInStockListing`; `openListingUrl(url)` — used consistently.
- **No dead buttons:** the Buy button renders only with an in-stock listing; the Visit CTA only with a resolvable URL.
