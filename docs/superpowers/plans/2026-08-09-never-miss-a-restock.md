# Never Miss a Restock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add global background restock monitoring and a dedicated Restock Watches management screen to both mobile (Expo) and desktop (Tauri) apps.

**Architecture:** A shared `lib/restock.ts` module provides `checkRestocks()`, called from the existing background price-check task and foreground check. A dedicated Restock Watches screen (mobile + desktop) lists active watches with remove buttons. The module reuses existing storage (`getStockWatches`, `removeStockWatch`, `updateStockWatchStatus`) and notification (`scheduleStockAlert`) helpers.

**Tech Stack:** TypeScript, Expo Router (mobile), React Router (desktop), existing storage + notifications.

---

## File Structure

### New Files
- `lib/restock.ts` — shared restock module
- `tests/restock.test.ts` — unit tests
- `app/restock-watches.tsx` — mobile screen
- `desktop/src/pages/RestockWatches.tsx` — desktop screen

### Modified Files
- `lib/background-price-check.ts` — call `checkRestocks()` in background task + foreground
- `app/(tabs)/alerts.tsx` — add navigation entry to Restock Watches
- `desktop/src/App.tsx` — add `/restock-watches` route
- `desktop/src/pages/Alerts.tsx` — add link to Restock Watches

---

## Task 1: Create Shared Restock Module

**Files:**
- Create: `lib/restock.ts`
- Test: `tests/restock.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/restock.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BackOrderReminder } from "../lib/types";

const state = vi.hoisted(() => ({
  watches: [] as BackOrderReminder[],
  watchlist: [] as any[],
  settings: { stockAlerts: true },
  removed: [] as string[],
  updated: [] as { productId: string; distributorId: string; status: string }[],
  scheduled: [] as unknown[],
  permissions: true,
}));

vi.mock("../lib/storage", () => ({
  getStockWatches: vi.fn(async () => state.watches.map((w) => ({ ...w }))),
  getWatchlist: vi.fn(async () => state.watchlist),
  getSettings: vi.fn(async () => ({ ...state.settings })),
  removeStockWatch: vi.fn(async (id: string) => {
    state.removed.push(id);
    state.watches = state.watches.filter((w) => w.id !== id);
  }),
  updateStockWatchStatus: vi.fn(
    async (productId: string, distributorId: string, status: string) => {
      state.updated.push({ productId, distributorId, status });
    },
  ),
}));

vi.mock("../lib/notifications", () => ({
  scheduleStockAlert: vi.fn(async (...args: unknown[]) => {
    state.scheduled.push(args);
    return "notif-id";
  }),
}));

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));

import { checkRestocks } from "../lib/restock";

function makeWatch(overrides: Partial<BackOrderReminder> = {}): BackOrderReminder {
  return {
    id: "w1",
    productId: "p1",
    productName: "Test",
    distributorId: "d1",
    distributorName: "Dist",
    reminderDate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    reminderType: "back_in_stock",
    lastKnownStatus: "back_order",
    ...overrides,
  };
}

describe("checkRestocks", () => {
  beforeEach(() => {
    state.watches = [];
    state.watchlist = [];
    state.removed = [];
    state.updated = [];
    state.scheduled = [];
    state.settings = { stockAlerts: true };
    state.permissions = true;
  });

  it("fires notification and removes watch when listing is in_stock", async () => {
    state.watches = [makeWatch()];
    state.watchlist = [
      {
        id: "p1",
        listings: [
          {
            distributorId: "d1",
            stockStatus: "in_stock",
            price: 100,
            currency: "USD",
          },
        ],
      },
    ];
    await checkRestocks();
    expect(state.scheduled).toHaveLength(1);
    expect(state.removed).toEqual(["w1"]);
  });

  it("does not fire when watch was already in_stock", async () => {
    state.watches = [makeWatch({ lastKnownStatus: "in_stock" })];
    state.watchlist = [
      {
        id: "p1",
        listings: [{ distributorId: "d1", stockStatus: "in_stock" }],
      },
    ];
    await checkRestocks();
    expect(state.scheduled).toHaveLength(0);
    expect(state.removed).toEqual([]);
  });

  it("updates cached status when status changes to non-in-stock", async () => {
    state.watches = [makeWatch()]; // lastKnownStatus = back_order
    state.watchlist = [
      {
        id: "p1",
        listings: [{ distributorId: "d1", stockStatus: "out_of_stock" }],
      },
    ];
    await checkRestocks();
    expect(state.updated).toEqual([
      { productId: "p1", distributorId: "d1", status: "out_of_stock" },
    ]);
    expect(state.removed).toEqual([]);
  });

  it("skips watch with no matching listing", async () => {
    state.watches = [makeWatch()];
    state.watchlist = [
      {
        id: "p1",
        listings: [{ distributorId: "other-dist", stockStatus: "in_stock" }],
      },
    ];
    await checkRestocks();
    expect(state.scheduled).toHaveLength(0);
    expect(state.removed).toEqual([]);
  });

  it("respects stockAlerts toggle (no notification, but removes watch)", async () => {
    state.settings = { stockAlerts: false };
    state.watches = [makeWatch()];
    state.watchlist = [
      {
        id: "p1",
        listings: [{ distributorId: "d1", stockStatus: "in_stock" }],
      },
    ];
    await checkRestocks();
    expect(state.scheduled).toHaveLength(0);
    expect(state.removed).toEqual(["w1"]);
  });

  it("is a no-op with empty watches", async () => {
    await checkRestocks();
    expect(state.scheduled).toHaveLength(0);
    expect(state.removed).toEqual([]);
    expect(state.updated).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/restock.test.ts`
Expected: FAIL with "Cannot find module '../lib/restock'"

- [ ] **Step 3: Write minimal implementation**

Create `lib/restock.ts`:

```typescript
import { Platform } from "react-native";
import {
  getStockWatches,
  getWatchlist,
  getSettings,
  removeStockWatch,
  updateStockWatchStatus,
} from "./storage";
import { scheduleStockAlert } from "./notifications";
import { getDistributorById } from "./distributors";

export async function checkRestocks(): Promise<void> {
  const watches = await getStockWatches();
  if (watches.length === 0) return;

  const settings = await getSettings();
  const watchlist = await getWatchlist();

  for (const watch of watches) {
    const product = watchlist.find((p) => p.id === watch.productId);
    if (!product?.listings?.length) continue;

    const currentListing = product.listings.find(
      (l) => l.distributorId === watch.distributorId,
    );
    if (!currentListing) continue;

    const prevStatus = watch.lastKnownStatus ?? "back_order";
    const newStatus = currentListing.stockStatus;

    if (prevStatus !== "in_stock" && newStatus === "in_stock") {
      // Back in stock — fire notification and remove watch
      if (settings.stockAlerts && Platform.OS !== "web") {
        const distrib = getDistributorById(watch.distributorId);
        await scheduleStockAlert(
          watch.productName,
          distrib?.name ?? watch.distributorName,
          currentListing.price,
          currentListing.currency,
        );
      }
      await removeStockWatch(watch.id);
    } else if (prevStatus !== newStatus) {
      // Status changed to another non-in-stock state — update cache
      await updateStockWatchStatus(watch.productId, watch.distributorId, newStatus);
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/restock.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/restock.ts tests/restock.test.ts
git commit -m "feat: add shared restock check module with tests"
```

---

## Task 2: Wire Restock Check into Background Task

**Files:**
- Modify: `lib/background-price-check.ts`

- [ ] **Step 1: Add import**

Add to the imports in `lib/background-price-check.ts`:

```typescript
import { checkRestocks } from "./restock";
```

- [ ] **Step 2: Call checkRestocks in the background task**

In the `PRICE_CHECK_TASK` definition, after the price-drop alert check (after the `for (const alert of activeAlerts)` loop, before `return BackgroundTask.BackgroundTaskResult.Success`), add:

```typescript
    // Check back-in-stock watches globally
    await checkRestocks();

    return BackgroundTask.BackgroundTaskResult.Success;
```

- [ ] **Step 3: Call checkRestocks in the foreground check**

In `checkPriceDropsNow`, after the price-drop alert loop (at the end of the function), add:

```typescript
  // Check back-in-stock watches globally
  await checkRestocks();
```

- [ ] **Step 4: Run typecheck to verify no errors**

Run: `pnpm check`
Expected: PASS (0 TypeScript errors)

- [ ] **Step 5: Commit**

```bash
git add lib/background-price-check.ts
git commit -m "feat: run restock check in background task and foreground check"
```

---

## Task 3: Create Mobile Restock Watches Screen

**Files:**
- Create: `app/restock-watches.tsx`

- [ ] **Step 1: Create the mobile screen**

Create `app/restock-watches.tsx`:

```tsx
import { useCallback, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { getStockWatches, removeStockWatch } from "@/lib/storage";
import { getDistributorById } from "@/lib/distributors";
import type { BackOrderReminder } from "@/lib/types";

const STATUS_LABELS: Record<string, string> = {
  in_stock: "In Stock",
  back_order: "Back Order",
  out_of_stock: "Out of Stock",
  unknown: "Unknown",
};

export default function RestockWatchesScreen() {
  const colors = useColors();
  const router = useRouter();
  const [watches, setWatches] = useState<BackOrderReminder[]>([]);
  const [loading, setLoading] = useState(true);

  const loadWatches = useCallback(async () => {
    const list = await getStockWatches();
    setWatches(list);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadWatches();
    }, [loadWatches]),
  );

  const handleRemove = useCallback(
    async (id: string) => {
      if (Platform.OS !== "web")
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await removeStockWatch(id);
      setWatches((prev) => prev.filter((w) => w.id !== id));
    },
    [],
  );

  return (
    <ScreenContainer>
      <View style={{ flexDirection: "row", alignItems: "center", padding: 16 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Text style={{ color: colors.primary, fontSize: 16 }}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "700" }}>
          Restock Watches
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
          {watches.length === 0 ? (
            <Text style={{ color: colors.muted, textAlign: "center", marginTop: 40 }}>
              No restock watches. Open a product and tap "Watch for Restock" to add one.
            </Text>
          ) : (
            watches.map((watch) => {
              const distrib = getDistributorById(watch.distributorId);
              return (
                <View
                  key={watch.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.foreground, fontWeight: "500", fontSize: 14 }}>
                      {watch.productName}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      {distrib?.countryFlag} {distrib?.name ?? watch.distributorName}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
                      {STATUS_LABELS[watch.lastKnownStatus ?? "unknown"] ?? "Unknown"}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleRemove(watch.id)}
                    style={{ padding: 8 }}
                  >
                    <Text style={{ color: colors.error, fontSize: 13 }}>Remove</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}
```

Note: `Platform` needs to be imported from `react-native`. Add it to the import list if not present.

- [ ] **Step 2: Run typecheck to verify no errors**

Run: `pnpm check`
Expected: PASS (0 TypeScript errors)

- [ ] **Step 3: Commit**

```bash
git add app/restock-watches.tsx
git commit -m "feat: add mobile restock watches screen"
```

---

## Task 4: Add Mobile Navigation Entry

**Files:**
- Modify: `app/(tabs)/alerts.tsx`

- [ ] **Step 1: Add useRouter import**

Add `useRouter` to the imports (check if already imported; if not, add):

```typescript
import { useRouter } from "expo-router";
```

- [ ] **Step 2: Add router hook**

In the `AlertsScreen` component, add:

```typescript
const router = useRouter();
```

- [ ] **Step 3: Add navigation entry**

Find the header area of the Alerts screen (where the title is rendered). Add a "Restock Watches" button/link near the header:

```tsx
<TouchableOpacity
  onPress={() => router.push("/restock-watches")}
  style={{
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.primary,
  }}
>
  <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>
    Restock Watches
  </Text>
</TouchableOpacity>
```

Place it in the header row, aligned to the right.

- [ ] **Step 4: Run typecheck to verify no errors**

Run: `pnpm check`
Expected: PASS (0 TypeScript errors)

- [ ] **Step 5: Commit**

```bash
git add app/(tabs)/alerts.tsx
git commit -m "feat: add restock watches navigation entry to mobile alerts"
```

---

## Task 5: Create Desktop Restock Watches Screen

**Files:**
- Create: `desktop/src/pages/RestockWatches.tsx`
- Modify: `desktop/src/App.tsx`

- [ ] **Step 1: Create the desktop screen**

Create `desktop/src/pages/RestockWatches.tsx`:

```tsx
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Trash2 } from "lucide-react";
import { storage } from "../storage";
import { getDistributorById } from "../../../lib/distributors";
import type { BackOrderReminder } from "../../../lib/types";

const STATUS_LABELS: Record<string, string> = {
  in_stock: "In Stock",
  back_order: "Back Order",
  out_of_stock: "Out of Stock",
  unknown: "Unknown",
};

export function RestockWatches() {
  const navigate = useNavigate();
  const [watches, setWatches] = useState<BackOrderReminder[]>([]);
  const [loading, setLoading] = useState(true);

  const loadWatches = useCallback(async () => {
    const list = await storage.getStockWatches();
    setWatches(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadWatches();
  }, [loadWatches]);

  const handleRemove = useCallback(async (id: string) => {
    await storage.removeStockWatch(id);
    setWatches((prev) => prev.filter((w) => w.id !== id));
  }, []);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center mb-4">
        <button onClick={() => navigate("/alerts")} className="text-blue-600 mr-3">
          ‹ Back
        </button>
        <h1 className="text-2xl font-bold">Restock Watches</h1>
      </div>

      {loading ? (
        <p className="text-center text-gray-500 mt-10">Loading...</p>
      ) : watches.length === 0 ? (
        <p className="text-center text-gray-500 mt-10">
          No restock watches. Open a product and tap "Watch for Restock" to add one.
        </p>
      ) : (
        <div>
          {watches.map((watch) => {
            const distrib = getDistributorById(watch.distributorId);
            return (
              <div
                key={watch.id}
                className="flex items-center py-3 border-b border-gray-200"
              >
                <div className="flex-1">
                  <p className="font-medium text-sm">{watch.productName}</p>
                  <p className="text-xs text-gray-500">
                    {distrib?.countryFlag} {distrib?.name ?? watch.distributorName}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {STATUS_LABELS[watch.lastKnownStatus ?? "unknown"] ?? "Unknown"}
                  </p>
                </div>
                <button
                  onClick={() => handleRemove(watch.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add the route to App.tsx**

In `desktop/src/App.tsx`:
1. Add import: `import { RestockWatches } from "./pages/RestockWatches";`
2. Add route: `<Route path="/restock-watches" element={<RestockWatches />} />`

- [ ] **Step 3: Run typecheck to verify no errors**

Run: `pnpm --filter desktop check`
Expected: PASS (0 TypeScript errors)

- [ ] **Step 4: Commit**

```bash
git add desktop/src/pages/RestockWatches.tsx desktop/src/App.tsx
git commit -m "feat: add desktop restock watches screen"
```

---

## Task 6: Add Desktop Navigation Link

**Files:**
- Modify: `desktop/src/pages/Alerts.tsx`

- [ ] **Step 1: Add useNavigate import**

Add `useNavigate` to the imports (check if already imported):

```typescript
import { useNavigate } from "react-router";
```

- [ ] **Step 2: Add navigate hook**

In the `Alerts` component, add:

```typescript
const navigate = useNavigate();
```

- [ ] **Step 3: Add navigation link**

Find the header of the Alerts page. Add a "Restock Watches" link:

```tsx
<button
  onClick={() => navigate("/restock-watches")}
  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-brand-600 text-white"
>
  Restock Watches
</button>
```

- [ ] **Step 4: Run typecheck to verify no errors**

Run: `pnpm --filter desktop check`
Expected: PASS (0 TypeScript errors)

- [ ] **Step 5: Commit**

```bash
git add desktop/src/pages/Alerts.tsx
git commit -m "feat: add restock watches link to desktop alerts"
```

---

## Task 7: Final Verification

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

Add Phase 19 entry for the never-miss-a-restock feature.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "docs: add Phase 19 never miss a restock to todo.md"
```
