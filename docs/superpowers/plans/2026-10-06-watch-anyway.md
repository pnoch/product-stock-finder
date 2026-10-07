# Watch-Anyway When Out of Stock — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the restock watch available on the product itself — a header button and an actionable empty state — so a user can watch a part that is out of stock everywhere.

**Architecture:** Extract `toggleAnyWatch` in `app/product/[id].tsx`; add a watch button to `DetailHeader`; add a "Watch anyway" button to the listing section's empty state. All reuse the Phase-1125 `scope: "any"` watch.

**Tech Stack:** TypeScript, React Native / Expo, vitest.

**Spec:** `docs/superpowers/specs/2026-10-06-watch-anyway-design.md`

---

## File Structure

- Modify `app/product/[id].tsx` — extract `toggleAnyWatch`, pass new props.
- Modify `components/product/detail-header.tsx` — the watch button.
- Modify `components/product/distributor-listing-section.tsx` — the empty-state button.
- Tests: `tests/detail-header-watch.test.tsx`, `tests/listing-empty-watch.test.tsx`.

---

### Task 1: Extract `toggleAnyWatch`

**Files:** Modify `app/product/[id].tsx`

- [ ] **Step 1: Implement**

Add a standalone `toggleAnyWatch` callback (near `handleToggleStockWatch`, ~line 358). It creates/removes the `scope: "any"` watch and is callable without the scope dialog:

```ts
  const toggleAnyWatch = useCallback(async () => {
    if (!id || togglingWatch) return;
    setTogglingWatch(true);
    try {
      if (stockWatches["*"]) {
        const watches = await getStockWatches();
        const watch = watches.find(
          (w) => w.productId === id && w.distributorId === "*",
        );
        if (watch) {
          if (watch.notificationId) await cancelNotification(watch.notificationId);
          await removeStockWatch(watch.id);
        }
        setStockWatches((prev) => ({ ...prev, "*": false }));
        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        showToast("Stopped watching all distributors", "info");
      } else {
        const granted = await ensureNotificationPermission();
        if (!granted) {
          if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          showAlert(
            "Permission Denied",
            Platform.OS === "web"
              ? "Please allow notifications in your browser to watch for restocks."
              : "Please enable notifications to watch for restocks.",
          );
          return;
        }
        await addStockWatch({
          id: `${id}-any`,
          productId: id,
          productName: product?.name ?? "",
          distributorId: "*",
          distributorName: "Any distributor",
          reminderDate: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          reminderType: "back_in_stock",
          scope: "any",
          lastKnownStatusByDistributor: Object.fromEntries(
            listings.map((l) => [l.distributorId, l.stockStatus]),
          ),
        });
        setStockWatches((prev) => ({ ...prev, "*": true }));
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast("Watching all distributors — you'll be notified when it's back in stock", "success");
      }
    } catch {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAlert("Couldn't update watch", "Please try again.");
    } finally {
      setTogglingWatch(false);
    }
  }, [id, product, listings, stockWatches, togglingWatch, showToast]);
```

Then make `handleToggleStockWatch`'s `createAnyWatch` call the same body (replace its inline `addStockWatch(...)` block with `await toggleAnyWatch();` — but note `toggleAnyWatch` guards on `togglingWatch`, which the dialog holds true; instead, extract the create body into a shared `createAnyWatchRecord()` helper that both call, OR have `handleToggleStockWatch`'s "Any distributor" button simply call `toggleAnyWatch()` after releasing the guard). Simplest correct approach: the dialog's "Any distributor" `onPress` sets `setTogglingWatch(false)` then `void toggleAnyWatch()`.

- [ ] **Step 2: Verify it compiles**

Run: `pnpm check`
Expected: 0 type errors.

- [ ] **Step 3: Commit**

```bash
git add app/product/\[id\].tsx
git commit -m "refactor(product): extract toggleAnyWatch"
```

---

### Task 2: Header watch button

**Files:** Modify `components/product/detail-header.tsx`; Test `tests/detail-header-watch.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/detail-header-watch.test.tsx` (mirror the jsdom harness in `tests/availability-card.test.tsx`):

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
    Animated: {
      View: ({ children, ...r }: any) => React.createElement("div", r, children),
    },
  };
});
vi.mock("@/hooks/use-colors", () => ({
  useColors: () => ({ foreground: "#111", muted: "#888", primary: "#0F52BA", success: "#0a0", border: "#ddd", surface: "#fff" }),
}));
vi.mock("@/components/stock-badge", () => ({ StockBadge: () => null }));

import { DetailHeader } from "../components/product/detail-header";

const product = { id: "p1", name: "CRS804", brand: "MikroTik", category: "Router", modelNumber: "CRS804-4DDQ-hRM", listings: [] } as never;

afterEach(cleanup);

describe("DetailHeader watch button", () => {
  it("shows Watch for restock when not watching and calls onToggleWatch", () => {
    const onToggleWatch = vi.fn();
    render(<DetailHeader product={product} bestDeal={null} watchingAny={false} onToggleWatch={onToggleWatch} />);
    const btn = screen.getByText(/Watch for restock/i);
    fireEvent.click(btn);
    expect(onToggleWatch).toHaveBeenCalledTimes(1);
  });

  it("shows Watching when watchingAny is true", () => {
    render(<DetailHeader product={product} bestDeal={null} watchingAny={true} onToggleWatch={() => {}} />);
    expect(screen.getByText(/Watching/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/detail-header-watch.test.tsx`
Expected: FAIL — `DetailHeader` has no `watchingAny`/`onToggleWatch` props.

- [ ] **Step 3: Implement**

In `components/product/detail-header.tsx`, add props `watchingAny: boolean` and `onToggleWatch: () => void`, and render a button below the model line (always visible):

```tsx
      <Pressable
        onPress={onToggleWatch}
        accessibilityRole="button"
        accessibilityLabel={watchingAny ? "Stop watching all distributors" : "Watch for restock across all distributors"}
        style={{
          marginTop: 10,
          alignSelf: "flex-start",
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 12,
          paddingVertical: 7,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: watchingAny ? colors.success : colors.primary,
        }}
      >
        <IconSymbol name={watchingAny ? "bell.fill" : "bell"} size={14} color={watchingAny ? colors.success : colors.primary} />
        <Text style={{ color: watchingAny ? colors.success : colors.primary, fontWeight: "600", fontSize: 13 }}>
          {watchingAny ? "Watching — tap to stop" : "Watch for restock"}
        </Text>
      </Pressable>
```

Import `Pressable` from `react-native` and `IconSymbol` from `@/components/ui/icon-symbol` (verify `bell`/`bell.fill` are mapped; if `bell.fill` is missing, add it to `components/ui/icon-symbol.tsx`).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/detail-header-watch.test.tsx && pnpm check`
Expected: PASS (2 tests); 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add components/product/detail-header.tsx tests/detail-header-watch.test.tsx
git commit -m "feat(product): header watch-for-restock button"
```

---

### Task 3: Empty-state "Watch anyway" + wire the header

**Files:** Modify `components/product/distributor-listing-section.tsx`, `app/product/[id].tsx`; Test `tests/listing-empty-watch.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/listing-empty-watch.test.tsx` (mirror the jsdom harness; mock `react-native` with `View`/`Text`/`Pressable`/`ScrollView`, `@/hooks/use-colors`, `@/components/stock-badge`, `@/components/ui/icon-symbol`, `expo-haptics`):

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
    ScrollView: ({ children, ...r }: any) => React.createElement("div", r, children),
    Platform: { OS: "ios" },
  };
});
vi.mock("@/hooks/use-colors", () => ({
  useColors: () => ({ foreground: "#111", muted: "#888", primary: "#0F52BA", success: "#0a0", border: "#ddd", surface: "#fff", warning: "#fa0", error: "#f00" }),
}));
vi.mock("@/components/stock-badge", () => ({ StockBadge: () => null }));
vi.mock("@/components/ui/icon-symbol", () => ({ IconSymbol: () => null }));
vi.mock("expo-haptics", () => ({ impactAsync: vi.fn(), notificationAsync: vi.fn(), ImpactFeedbackStyle: { Light: "light" }, NotificationFeedbackType: { Success: "success", Error: "error" } }));

import { DistributorListingSection } from "../components/product/distributor-listing-section";

const baseProps = {
  sortedListings: [], visibleListings: [], bestInStockListing: null,
  product: { id: "p1", name: "CRS804", listings: [] },
  insight: null, insightLoading: false, regionFilter: "All", regions: [],
  shippingRegion: "Asia-Pacific", bestDeal: null, stockWatches: {}, id: "p1",
  displayCurrency: "USD", destination: null, taxExempt: false, includeImportEstimate: false,
  onSelectCountry: () => {}, onToggleTaxExempt: () => {}, onToggleImportEstimate: () => {},
  onSetRegionFilter: () => {}, onSetBestAlert: () => {}, onToggleStockWatch: () => {},
  onOpenChart: () => {},
} as never;

afterEach(cleanup);

describe("listing empty state", () => {
  it("renders Watch anyway and calls onWatchAny", () => {
    const onWatchAny = vi.fn();
    render(<DistributorListingSection {...(baseProps as object)} onWatchAny={onWatchAny} watchingAny={false} />);
    fireEvent.click(screen.getByText(/Watch anyway/i));
    expect(onWatchAny).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/listing-empty-watch.test.tsx`
Expected: FAIL — no "Watch anyway" button.

- [ ] **Step 3: Implement**

In `components/product/distributor-listing-section.tsx`:
- Add props `onWatchAny?: () => void;` and `watchingAny?: boolean;`.
- In the `sortedListings.length === 0` empty state (line ~191), beside the existing "Find prices" button, add:

```tsx
          {onWatchAny && (
            <TouchableOpacity activeOpacity={0.85}
              onPress={onWatchAny}
              style={{
                marginTop: 12,
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: watchingAny ? colors.success : colors.primary,
              }}
              accessibilityLabel={watchingAny ? "Stop watching all distributors" : "Watch for restock across all distributors"}
              accessibilityRole="button"
            >
              <Text style={{ color: watchingAny ? colors.success : colors.primary, fontWeight: "600", fontSize: 13 }}>
                {watchingAny ? "Watching — tap to stop" : "Watch anyway"}
              </Text>
            </TouchableOpacity>
          )}
```

In `app/product/[id].tsx`:
- Pass `watchingAny={!!stockWatches["*"]}` and `onToggleWatch={() => void toggleAnyWatch()}` to `<DetailHeader>` (line ~655).
- Pass `onWatchAny={() => void toggleAnyWatch()}` and `watchingAny={!!stockWatches["*"]}` to `<DistributorListingSection>` (line ~683).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/listing-empty-watch.test.tsx && pnpm check`
Expected: PASS (1 test); 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add components/product/distributor-listing-section.tsx app/product/\[id\].tsx tests/listing-empty-watch.test.tsx
git commit -m "feat(product): Watch anyway empty-state + wire header"
```

---

### Task 4: Full verification + docs

**Files:** `todo.md`

- [ ] **Step 1: Run the full gate**

Run: `pnpm verify`
Expected: exit 0.

- [ ] **Step 2: Document**

Add a `todo.md` phase entry (next number 1127): the header watch button, the empty-state "Watch anyway", the `toggleAnyWatch` refactor, and the note that desktop parity is deferred.

- [ ] **Step 3: Commit**

```bash
git add todo.md
git commit -m "docs: watch-anyway when out of stock (Phase 1127)"
```

---

## Self-Review

- **Spec coverage:** `toggleAnyWatch` (Task 1), header button (Task 2), empty-state button + wiring (Task 3), verify + docs (Task 4). Desktop parity is out of scope per the spec.
- **Placeholders:** none — the callback, the button markup, and the tests are given verbatim.
- **Type consistency:** `toggleAnyWatch(): Promise<void>`; `DetailHeader` props `watchingAny: boolean` + `onToggleWatch: () => void`; section props `onWatchAny?: () => void` + `watchingAny?: boolean`; the `"*"` sentinel and `stockWatches["*"]` state — used consistently.
- **Reuse:** the `scope: "any"` watch, seed map, and server path are all Phase 1125; this plan adds no new data or subsystem.
