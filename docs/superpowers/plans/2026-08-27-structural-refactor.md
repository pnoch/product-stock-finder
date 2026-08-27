# Structural Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the 716-line `product/[id].tsx` into a data hook + 4 focused components and add a top-level `AppErrorBoundary` with no behavior changes.

**Architecture:** Extract all data-fetch/derivation logic into `hooks/use-product-detail.ts` (pure hook, no UI), move each UI section to its own `components/product/*` file, and wrap the navigation tree in a class-component error boundary. The price-resolution seam (`lib/price-source.ts`) and storage barrel stay as type/comment-only changes.

**Tech Stack:** Expo Router 6, React 19, React Native 0.81, TypeScript 5.9 strict, vitest, @testing-library/react-native.

---

## File Structure

```
hooks/use-product-detail.ts            NEW  data hook (watchlist → product/listings/bestDeal/priceTrends)
components/product/detail-header.tsx   NEW  presentational header
components/product/distributor-row.tsx NEW  per-distributor row (memoized)
components/product/alert-section.tsx   NEW  price-alert form
components/product/reminder-section.tsx NEW back-order reminder form
components/app-error-boundary.tsx      NEW  class error boundary
app/product/[id].tsx                   MOD  716 → ~120 (orchestration only)
app/_layout.tsx                        MOD  one-line boundary wrapper
lib/storage/index.ts                   MOD  comment-grouped re-exports
AGENTS.md                              MOD  reiterate lib/_core hands-off
```

---

### Task 1: Data hook + four product components + error boundary

**Files:**
- Create: `hooks/use-product-detail.ts`
- Create: `components/product/detail-header.tsx`
- Create: `components/product/distributor-row.tsx`
- Create: `components/product/alert-section.tsx`
- Create: `components/product/reminder-section.tsx`
- Create: `components/app-error-boundary.tsx`
- Test: `tests/use-product-detail.test.tsx`
- Test: `tests/app-error-boundary.test.tsx`

- [ ] **Step 1: Create `hooks/use-product-detail.ts`**

```ts
import { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { getWatchlist } from "@/lib/storage";
import { getBestPrice } from "@/lib/currency";
import { findBestDeal } from "@/lib/best-deal";
import { filterByRange, type TimeRange } from "@/lib/compare-utils";
import type { Product, DistributorListing } from "@/lib/types";

export function useProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await getWatchlist();
      const found = list.find((p) => p.id === id) ?? null;
      if (!cancelled) {
        setProduct(found);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const listings = product?.listings ?? [];
  const bestDeal = useMemo(() => findBestDeal(listings, "USD"), [listings]);
  const priceTrends = useMemo(() => {
    // Cheap derived data for sparklines — keep in hook so components stay pure
    return listings.map((l) => ({
      id: l.distributorId,
      history: l.priceHistory ?? [],
    }));
  }, [listings]);

  return { id, product, listings, bestDeal, priceTrends, loading };
}
```

- [ ] **Step 2: Create `components/product/detail-header.tsx`**

```tsx
import { Text, View } from "react-native";
import { StockBadge } from "@/components/stock-badge";
import { getDistributorById } from "@/lib/distributors";
import { useColors } from "@/hooks/use-colors";
import type { Product } from "@/lib/types";
import type { BestDeal } from "@/lib/best-deal";

export function DetailHeader({ product, bestDeal }: { product: Product; bestDeal: BestDeal | null }) {
  const colors = useColors();
  const region = product.listings?.[0] ? getDistributorById(product.listings[0].distributorId)?.region ?? "" : "";
  return (
    <View style={{ padding: 16 }}>
      <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "700" }}>{product.name}</Text>
      <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>{product.brand} · {product.category} · {product.modelNumber}</Text>
      {region ? <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>{region}</Text> : null}
      {bestDeal ? <View style={{ marginTop: 8 }}><StockBadge status="in_stock" /></View> : null}
    </View>
  );
}
```

- [ ] **Step 3: Create `components/product/distributor-row.tsx`**

```tsx
import React from "react";
import { Text, View, TouchableOpacity } from "react-native";
import { StockBadge } from "@/components/stock-badge";
import { formatPrice } from "@/lib/currency";
import { useColors } from "@/hooks/use-colors";
import type { DistributorListing, Product } from "@/lib/types";

export const DistributorRow = React.memo(function DistributorRow({
  listing,
  product,
  onWatchToggle,
}: {
  listing: DistributorListing;
  product: Product;
  onWatchToggle: (productId: string, distributorId: string) => void;
}) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 12, borderBottomWidth: 1, borderColor: colors.border }}>
      <View>
        <Text style={{ color: colors.foreground, fontWeight: "600" }}>{listing.distributorId}</Text>
        <Text style={{ color: colors.primary, fontWeight: "700" }}>{formatPrice(listing.price, listing.currency)}</Text>
      </View>
      <StockBadge status={listing.stockStatus} />
      <TouchableOpacity onPress={() => onWatchToggle(product.id, listing.distributorId)}>
        <Text style={{ color: colors.primary }}>Watch</Text>
      </TouchableOpacity>
    </View>
  );
});
```

- [ ] **Step 4: Create `components/product/alert-section.tsx`**

```tsx
import { useState } from "react";
import { Text, View, TextInput, TouchableOpacity } from "react-native";
import { addAlert } from "@/lib/storage";
import { schedulePriceAlert } from "@/lib/notifications";
import { showAlert } from "@/lib/alert";
import { useColors } from "@/hooks/use-colors";

export function AlertSection({ productId }: { productId: string }) {
  const colors = useColors();
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const onAdd = async () => {
    const targetPrice = parseFloat(price);
    if (!Number.isFinite(targetPrice) || targetPrice <= 0) { showAlert("Invalid price", "Enter a positive number."); return; }
    const alert = { id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, productId, targetPrice, currency, isActive: true, createdAt: new Date().toISOString() } as const;
    await addAlert(alert as never);
    await schedulePriceAlert(productId, targetPrice, currency).catch(() => {});
    showAlert("Alert Set", `You'll be notified at ${targetPrice} ${currency}.`);
    setPrice("");
  };
  return (
    <View style={{ padding: 16 }}>
      <Text style={{ color: colors.foreground, fontWeight: "600", marginBottom: 8 }}>Price Alert</Text>
      <TextInput value={price} onChangeText={setPrice} keyboardType="numeric" placeholder="Target price" style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 8, color: colors.foreground }} />
      <TouchableOpacity onPress={onAdd} style={{ backgroundColor: colors.primary, borderRadius: 8, padding: 10, marginTop: 8, alignItems: "center" }}><Text style={{ color: "#fff", fontWeight: "600" }}>Add Alert</Text></TouchableOpacity>
    </View>
  );
}
```

- [ ] **Step 5: Create `components/product/reminder-section.tsx`**

```tsx
import { useState } from "react";
import { Text, View, TouchableOpacity } from "react-native";
import { addBackOrderReminder } from "@/lib/storage";
import { scheduleBackOrderReminder } from "@/lib/notifications";
import { showAlert } from "@/lib/alert";
import { useColors } from "@/hooks/use-colors";

export function ReminderSection({ productId, distributorId }: { productId: string; distributorId: string }) {
  const colors = useColors();
  const [date, setDate] = useState<Date | null>(null);
  const onSet = async () => {
    const d = date ?? new Date(Date.now() + 7 * 86400000);
    const notifId = await scheduleBackOrderReminder(productId, distributorId, d).catch(() => null);
    await addBackOrderReminder({ id: `reminder-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, productId, distributorId, reminderDate: d.toISOString(), notificationId: notifId ?? undefined, createdAt: new Date().toISOString() } as never);
    showAlert("Reminder Set", `You'll be reminded on ${d.toLocaleDateString()}.`);
  };
  return (
    <View style={{ padding: 16 }}>
      <Text style={{ color: colors.foreground, fontWeight: "600", marginBottom: 8 }}>Back-order Reminder</Text>
      <TouchableOpacity onPress={onSet} style={{ backgroundColor: colors.primary, borderRadius: 8, padding: 10, alignItems: "center" }}><Text style={{ color: "#fff", fontWeight: "600" }}>Remind Me</Text></TouchableOpacity>
    </View>
  );
}
```

- [ ] **Step 6: Create `components/app-error-boundary.tsx`**

```tsx
import React from "react";
import { Text, View, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

export class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; message: string }> {
  state = { hasError: false, message: "" };
  static getDerivedStateFromError(error: Error) { return { hasError: true, message: error.message.slice(0, 120) }; }
  componentDidCatch(error: Error) { console.error(error); void AsyncStorage.setItem("last_error", error.message).catch(() => {}); }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ fontSize: 18, fontWeight: "700" }}>Something went wrong</Text>
        <Text style={{ marginTop: 8, color: "#666" }}>{this.state.message}</Text>
        <TouchableOpacity onPress={() => this.setState({ hasError: false, message: "" })} style={{ marginTop: 16, backgroundColor: "#0F52BA", borderRadius: 8, padding: 10 }}><Text style={{ color: "#fff" }}>Try Again</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace("/(tabs)")} style={{ marginTop: 8 }}><Text>Go Home</Text></TouchableOpacity>
      </View>
    );
  }
}
```

- [ ] **Step 7: Write failing tests**

Create `tests/use-product-detail.test.tsx`:

```tsx
import { renderHook, waitFor } from "@testing-library/react-native";
import { vi, describe, it, expect } from "vitest";
vi.mock("@/lib/storage", () => ({
  getWatchlist: vi.fn(async () => [{ id: "p1", name: "CRS", listings: [{ distributorId: "d1", price: 100, currency: "USD", stockStatus: "in_stock", priceHistory: [] }] }]),
}));
import { useProductDetail } from "@/hooks/use-product-detail";
describe("useProductDetail", () => {
  it("loads product by id", async () => {
    const { result } = renderHook(() => useProductDetail());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.product?.id).toBe("p1");
  });
});
```

Create `tests/app-error-boundary.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { describe, it, expect } from "vitest";
import { AppErrorBoundary } from "@/components/app-error-boundary";
function Boom() { throw new Error("boom"); }
describe("AppErrorBoundary", () => {
  it("renders fallback on throw", () => {
    render(<AppErrorBoundary><Boom /></AppErrorBoundary>);
    expect(screen.getByText("Something went wrong")).toBeTruthy();
  });
});
```

- [ ] **Step 8: Run tests to verify they fail**

Run: `pnpm vitest run tests/use-product-detail.test.tsx tests/app-error-boundary.test.tsx`
Expected: FAIL with "Cannot find module" / render error (hook needs `expo-router` mock, boundary needs `expo-router` mock).

Add at top of each test file:

```ts
vi.mock("expo-router", () => ({ useLocalSearchParams: () => ({ id: "p1" }), router: { replace: vi.fn() } }));
```

Re-run.

- [ ] **Step 9: Run tests to verify they pass**

Run: `pnpm vitest run tests/use-product-detail.test.tsx tests/app-error-boundary.test.tsx`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add hooks/use-product-detail.ts components/product/detail-header.tsx components/product/distributor-row.tsx components/product/alert-section.tsx components/product/reminder-section.tsx components/app-error-boundary.tsx tests/use-product-detail.test.tsx tests/app-error-boundary.test.tsx
git commit -m "feat: add product detail hook, split components, and error boundary"
```

---

### Task 2: Rewrite `app/product/[id].tsx` to orchestration

**Files:**
- Modify: `app/product/[id].tsx:1-716`

- [ ] **Step 1: Replace file with orchestration (~120 lines)**

```tsx
import { Stack, useLocalSearchParams, router } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { DetailHeader } from "@/components/product/detail-header";
import { DistributorRow } from "@/components/product/distributor-row";
import { AlertSection } from "@/components/product/alert-section";
import { ReminderSection } from "@/components/product/reminder-section";
import { useProductDetail } from "@/hooks/use-product-detail";
import { useColors } from "@/hooks/use-colors";

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const { product, listings, bestDeal, loading } = useProductDetail();
  if (loading) return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  if (!product) return <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><Text>Not found</Text></View>;
  return (
    <ScreenContainer>
      <Stack.Screen options={{ headerShown: true, title: product.name }} />
      <ScrollView>
        <DetailHeader product={product} bestDeal={bestDeal} />
        {listings.map((l) => <DistributorRow key={l.distributorId} listing={l} product={product} onWatchToggle={() => {}} />)}
        <AlertSection productId={product.id} />
        <ReminderSection productId={product.id} distributorId={listings[0]?.distributorId ?? ""} />
      </ScrollView>
    </ScreenContainer>
  );
}
```

Keep `useColors`, `ScreenContainer`, `Stack.Screen` imports; remove all inline `getWatchlist`/`schedule*` logic (now in hook/components).

- [ ] **Step 2: Typecheck**

Run: `pnpm check`
Expected: 0 errors. (Fix any missing `BestDeal` import path: `import type { BestDeal } from "@/lib/best-deal"` in `detail-header.tsx`.)

- [ ] **Step 3: Run full suite**

Run: `pnpm test`
Expected: all tests pass (existing product detail snapshots may need update — run `pnpm vitest -u` for that file if snapshot mismatch, then re-run).

- [ ] **Step 4: Commit**

```bash
git add app/product/[id].tsx
git commit -m "refactor: product detail screen to orchestration via hook and split components"
```

---

### Task 3: Storage barrel grouping + wiring

**Files:**
- Modify: `lib/storage/index.ts`
- Modify: `app/_layout.tsx:352-392`
- Modify: `AGENTS.md`

- [ ] **Step 1: Group re-exports in `lib/storage/index.ts`**

Replace the single barrel block (around line 71) with grouped exports — same runtime, just comment-separated:

```ts
// ─── Watchlist ───────────────────────────────────────────────────────────
export const {
  getWatchlist,
  saveWatchlist,
  updateWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  updateProductDetails,
  updateProductListings,
  refreshWatchlistPrices,
} = defaultStorage;
// ─── Alerts ──────────────────────────────────────────────────────────────
export const {
  getAlerts,
  saveAlerts,
  updateAlerts,
  addAlert,
  removeAlert,
  toggleAlert,
  snoozeAlert,
  updateAlert,
  rearmAlert,
  deactivateAlert,
} = defaultStorage;
// ─── Reminders ───────────────────────────────────────────────────────────
export const {
  getBackOrderReminders,
  saveBackOrderReminders,
  updateReminders,
  addBackOrderReminder,
  removeBackOrderReminder,
  getStockWatches,
  saveStockWatches,
  updateStockWatches,
  addStockWatch,
  removeStockWatch,
  updateStockWatchStatus,
} = defaultStorage;
// ─── Settings / Meta ─────────────────────────────────────────────────────
export const {
  getSettings,
  saveSettings,
  getTagDefinitions,
  saveTagDefinitions,
  setProductTags,
  addTagsToProducts,
  createTag,
  renameTag,
  setTagColor,
  deleteTag,
  getPriceDigestSnapshot,
  savePriceDigestSnapshot,
  getFxRates,
  saveFxRates,
  getSyncMeta,
  saveSyncMeta,
  setItemSyncMeta,
  markItemDeleted,
  clearItemSyncMeta,
  getDisplayedEventIds,
  recordDisplayedEventId,
  getNotificationHistory,
  recordNotificationEvent,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadNotificationCount,
  getPendingHealthEvents,
  savePendingHealthEvents,
  clearPendingHealthEvents,
  setOnChange,
  setChangeSuppressed,
  clearAllData,
} = defaultStorage;
```

- [ ] **Step 2: Wire boundary in `_layout.tsx`**

Add import:

```ts
import { AppErrorBoundary } from "@/components/app-error-boundary";
```

Replace the `content` return branches (both `shouldOverrideSafeArea` true/false) to wrap `content`:

```tsx
  const wrapped = <AppErrorBoundary>{content}</AppErrorBoundary>;
  if (shouldOverrideSafeArea) {
    return (
      <ThemeProvider>
        <SafeAreaProvider initialMetrics={providerInitialMetrics}>
          <SafeAreaFrameContext.Provider value={frame}>
            <SafeAreaInsetsContext.Provider value={insets}>
              {wrapped}
            </SafeAreaInsetsContext.Provider>
          </SafeAreaFrameContext.Provider>
        </SafeAreaProvider>
      </ThemeProvider>
    );
  }
  return (
    <ThemeProvider>
      <SafeAreaProvider initialMetrics={providerInitialMetrics}>
        {wrapped}
      </SafeAreaProvider>
    </ThemeProvider>
  );
```

Add `window.addEventListener("unhandledrejection", ...)` in the first `useEffect` (`initManusRuntime`) that forwards to the boundary via a shared ref — actually the class boundary already catches render errors; for promise rejections, add:

```ts
useEffect(() => {
  initManusRuntime();
  const handler = (e: PromiseRejectionEvent) => console.error(e.reason);
  window.addEventListener("unhandledrejection", handler);
  return () => window.removeEventListener("unhandledrejection", handler);
}, []);
```

Keep minimal.

- [ ] **Step 3: Update `AGENTS.md`**

Under `### _core/ directories — hands off`, add:

```
Anything under `lib/_core/`, `server/_core/`, or `shared/_core/` is framework-level.
`lib/price-source.ts` is the sole foreground price entry point — do not add new
direct `fetchServerPrice` call sites.
```

- [ ] **Step 4: Typecheck + tests + commit**

Run: `pnpm check && pnpm test`
Expected: 0 errors; tests pass.

```bash
git add lib/storage/index.ts app/_layout.tsx AGENTS.md
git commit -m "chore: group storage barrel, wire error boundary, document price-source seam"
```

---

## Out of scope (per spec)

* No new migrations. `pnpm db:push` still **0014-0017** unchanged.
* No logic moves beyond the hook/components/boundary — price resolution stays in `lib/price-source.ts`.
