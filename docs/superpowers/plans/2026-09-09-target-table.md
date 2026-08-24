# Distributor Target Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Comparison table on product detail: each distributor's current price vs its scoped alert target, with Δ% and quick-set buttons opening the pre-scoped alert modal.

**Architecture:** Two pure helpers extend `lib/alert-scope.ts` (TDD); a self-contained `TargetTableCard` renders rows from listings + alerts; product detail loads alerts and wires `onSetTarget` to the existing Phase 86 modal (pre-scoped).

**Tech Stack:** React Native, TypeScript strict, vitest.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `lib/alert-scope.ts` | +`scopedAlertFor`, +`productWideAlert` |
| `tests/alert-scope.test.ts` | extend |
| `components/product/target-table-card.tsx` | comparison table card |
| `app/product/[id].tsx` | load alerts, render card, handler |

---

## Task 1: Helpers (TDD) + card + wiring

**Files:**
- Modify: `lib/alert-scope.ts`
- Test: `tests/alert-scope.test.ts`
- Create: `components/product/target-table-card.tsx`
- Modify: `app/product/[id].tsx`
- Modify: `todo.md`

- [ ] **Step 1: Extend `tests/alert-scope.test.ts`**

Add imports (`scopedAlertFor`, `productWideAlert`, and `PriceAlert` type) plus:

```typescript
import { scopedAlertFor, productWideAlert } from "../lib/alert-scope";
import type { PriceAlert } from "../lib/types";

function alert(overrides: Partial<PriceAlert> & { id: string }): PriceAlert {
  return {
    productId: "p1",
    targetPrice: 100,
    currency: "USD",
    isActive: true,
    createdAt: "2026-01-01",
    ...overrides,
  } as PriceAlert;
}

describe("scopedAlertFor", () => {
  const alerts = [
    alert({ id: "a1", distributorId: "d1" }),
    alert({ id: "a2", distributorId: "d2", isActive: false }),
    alert({ id: "a3", distributorId: "d2", triggeredAt: "2026-02-01" }),
    alert({ id: "a4", productId: "OTHER", distributorId: "d2" }),
  ];

  it("returns the active untriggered scoped alert", () => {
    expect(scopedAlertFor(alerts, "p1", "d1")?.id).toBe("a1");
  });

  it("ignores inactive or triggered alerts", () => {
    expect(scopedAlertFor(alerts, "p1", "d2")).toBeNull();
  });

  it("ignores other products and missing scope", () => {
    expect(scopedAlertFor(alerts, "p1", "zzz")).toBeNull();
    expect(productWideAlert(alerts, "p1")).toBeNull();
  });
});

describe("productWideAlert", () => {
  it("returns the active unscoped alert for the product", () => {
    const alerts = [
      alert({ id: "w1", distributorId: undefined }),
      alert({ id: "w2", distributorId: "d1" }),
    ];
    expect(productWideAlert(alerts, "p1")?.id).toBe("w1");
  });
});
```

- [ ] **Step 2: Run test to verify new cases fail**

Run: `pnpm vitest run tests/alert-scope.test.ts` — FAIL on new describes.

- [ ] **Step 3: Implement in `lib/alert-scope.ts`**

Append (with `import type { PriceAlert } from "./types";`):

```typescript
export function scopedAlertFor(
  alerts: PriceAlert[],
  productId: string,
  distributorId: string,
): PriceAlert | null {
  const match = alerts.find(
    (a) =>
      a.productId === productId &&
      a.distributorId === distributorId &&
      a.isActive &&
      !a.triggeredAt,
  );
  return match ?? null;
}

export function productWideAlert(
  alerts: PriceAlert[],
  productId: string,
): PriceAlert | null {
  const match = alerts.find(
    (a) => a.productId === productId && !a.distributorId && a.isActive && !a.triggeredAt,
  );
  return match ?? null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/alert-scope.test.ts` — PASS.

- [ ] **Step 5: Create `components/product/target-table-card.tsx`**

```typescript
import { Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { formatPrice, convertPrice, hasExchangeRate } from "@/lib/currency";
import { getDistributorById } from "@/lib/distributors";
import {
  listingsForAlert,
  scopedAlertFor,
  productWideAlert,
} from "@/lib/alert-scope";
import type { DistributorListing, PriceAlert } from "@/lib/types";

interface TargetRow {
  listing: DistributorListing;
  alert: PriceAlert | null;
}

export function TargetTableCard({
  listings,
  alerts,
  productId,
  onSetTarget,
}: {
  listings: DistributorListing[];
  alerts: PriceAlert[];
  productId: string;
  onSetTarget: (distributorId: string) => void;
}) {
  const colors = useColors();

  const rows: TargetRow[] = listings.map((listing) => ({
    listing,
    alert: scopedAlertFor(alerts, productId, listing.distributorId),
  }));
  const wide = productWideAlert(alerts, productId);
  if (rows.length === 0) return null;

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginBottom: 16,
        backgroundColor: colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 16,
      }}
    >
      <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 8 }}>
        Distributor Targets
      </Text>

      {rows.map(({ listing, alert }) => {
        const dist = getDistributorById(listing.distributorId);
        const hasFx =
          hasExchangeRate(listing.currency) && hasExchangeRate(alert!.currency);
        const deltaPct =
          alert && hasFx
            ? Math.round(
                ((convertPrice(listing.price, listing.currency, alert.currency) -
                  alert.targetPrice) /
                  alert.targetPrice) *
                  100,
              )
            : null;
        const met = deltaPct !== null && deltaPct <= 0;
        return (
          <View
            key={listing.distributorId}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 7,
              gap: 8,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Text style={{ fontSize: 13 }}>{dist?.countryFlag ?? ""}</Text>
            <View style={{ flex: 1 }}>
              <Text
                style={{ color: colors.foreground, fontSize: 12, fontWeight: "500" }}
                numberOfLines={1}
              >
                {dist?.name ?? listing.distributorId}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                {formatPrice(listing.price, listing.currency)}
                {alert
                  ? ` · target ${formatPrice(alert.targetPrice, alert.currency)}`
                  : ""}
              </Text>
            </View>
            {alert && deltaPct !== null ? (
              <Text
                style={{
                  color: met ? colors.success : colors.error,
                  fontSize: 12,
                  fontWeight: "700",
                }}
              >
                {deltaPct > 0 ? "+" : ""}
                {deltaPct}%
              </Text>
            ) : (
              <TouchableOpacity
                onPress={() => onSetTarget(listing.distributorId)}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.primary + "22",
                }}
              >
                <Text style={{ color: colors.primary, fontSize: 15, fontWeight: "700" }}>
                  +
                </Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}

      {wide && (
        <View style={{ flexDirection: "row", paddingTop: 8, gap: 6 }}>
          <Text style={{ color: colors.muted, fontSize: 11 }}>
            Any distributor · target{" "}
            {formatPrice(wide.targetPrice, wide.currency)}
          </Text>
        </View>
      )}

      {!wide && rows.every((r) => !r.alert) && (
        <Text style={{ color: colors.muted, fontSize: 11, marginTop: 8 }}>
          Set per-distributor targets with + to compare them here.
        </Text>
      )}
    </View>
  );
}
```

Note: drop unused imports if any (`listingsForAlert` listed above is NOT used — do not import it). The delta compares in the ALERT's currency.

- [ ] **Step 6: Wire into `app/product/[id].tsx`**

1. Import `getAlerts` from `@/lib/storage` (add to existing storage import list) and:
```typescript
import { TargetTableCard } from "@/components/product/target-table-card";
import { scopedAlertFor as _scope } from "@/lib/alert-scope"; // NOT needed — remove; only TargetTableCard import required.
```
Final: only add the TargetTableCard import.

2. State: `const [alerts, setAlerts] = useState<PriceAlert[]>([]);` (ensure `PriceAlert` type imported — it is, from handleSetAlert usage).

3. In `loadData`, add: `void getAlerts().then(setAlerts);`

4. Handler near handleShare:

```typescript
  const handleSetTarget = useCallback(
    (distributorId: string) => {
      setAlertDistributorId(distributorId);
      setAlertDirection("drop");
      setAlertPrice("");
      setAlertModalVisible(true);
    },
    [],
  );
```

5. Render between `<ActionButtons … />` and `<DistributorListingSection … />`:

```tsx
        <TargetTableCard
          listings={listings}
          alerts={alerts}
          productId={id}
          onSetTarget={handleSetTarget}
        />
```

- [ ] **Step 7: Verify**

Run: `pnpm check` — 0 errors. Run: `pnpm lint` — no new errors. Run: `pnpm test` — all pass.

- [ ] **Step 8: Update `todo.md` + commit + push**

Append Phase 93 section:

```markdown
## Phase 93: Distributor Target Table (v5.41)

- [x] Add scopedAlertFor/productWideAlert helpers with tests
- [x] Add target comparison table card on product detail
- [x] Quick-set buttons open pre-scoped alert modal
```

Then:

```bash
git add lib/alert-scope.ts tests/alert-scope.test.ts components/product/target-table-card.tsx app/product/\[id\].tsx todo.md && git commit -m "feat: add distributor target table"
git push origin main
```

---

## Summary

| Metric | Value |
|--------|-------|
| New helpers | `scopedAlertFor`, `productWideAlert` (+5 test cases) |
| New component | `target-table-card.tsx` (~150 lines) |
| Modified | product detail screen |
