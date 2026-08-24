# Distributor-Scoped Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users scope a price alert to one distributor, with a picker in the Set Price Alert modal, correct client-side evaluation, and scoped badges in the alerts list.

**Architecture:** Pure `listingsForAlert` helper (TDD) used by the client background check; optional distributor chip row in the existing modal; creation paths set `distributorId`; alerts list shows a badge.

**Tech Stack:** TypeScript strict, vitest, React Native.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `lib/alert-scope.ts` | `listingsForAlert` pure filter |
| `tests/alert-scope.test.ts` | Filter tests |
| `lib/background-tasks/price-check.ts` | Respect scoping in evaluation |
| `components/product/price-alert-modal.tsx` | Distributor chip row |
| `app/product/[id].tsx` | State, wiring, `handleSetBestAlert` bug fix |
| `components/alerts/alert-card.tsx` | Scoped distributor badge |

---

## Task 1: Scope helper (TDD) + client evaluation fix

**Files:**
- Create: `lib/alert-scope.ts`
- Test: `tests/alert-scope.test.ts`
- Modify: `lib/background-tasks/price-check.ts`

- [ ] **Step 1: Write failing test `tests/alert-scope.test.ts`**

```typescript
import { describe, expect, it } from "vitest";
import { listingsForAlert } from "../lib/alert-scope";

const listings = [
  { distributorId: "a", price: 100 },
  { distributorId: "b", price: 90 },
  { distributorId: "a", price: 80 },
] as Array<{ distributorId: string; price: number }>;

describe("listingsForAlert", () => {
  it("returns all listings when unscoped", () => {
    expect(listingsForAlert(listings, undefined)).toHaveLength(3);
    expect(listingsForAlert(listings)).toHaveLength(3);
  });

  it("filters to the scoped distributor", () => {
    const result = listingsForAlert(listings, "a");
    expect(result).toHaveLength(2);
    expect(result.every((l) => l.distributorId === "a")).toBe(true);
  });

  it("returns empty when no listing matches the scope", () => {
    expect(listingsForAlert(listings, "zzz")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/alert-scope.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Create `lib/alert-scope.ts`**

```typescript
// Price alerts may be scoped to a single distributor; evaluation must only
// consider that distributor's listings.
export function listingsForAlert<
  T extends { distributorId: string },
>(listings: T[], distributorId?: string): T[] {
  if (!distributorId) return listings;
  return listings.filter((l) => l.distributorId === distributorId);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/alert-scope.test.ts` — PASS.

- [ ] **Step 5: Fix client evaluation**

In `lib/background-tasks/price-check.ts`, inside `runPriceCheckCore`'s active-alerts loop, find:

```typescript
    const inStockListings = product.listings.filter(
```

and replace with:

```typescript
    const eligibleListings = listingsForAlert(
      product.listings,
      alert.distributorId,
    );
    const inStockListings = eligibleListings.filter(
```

Add import: `import { listingsForAlert } from "../alert-scope";`

- [ ] **Step 6: Verify + commit**

Run: `pnpm check` — 0 errors. Run: `pnpm test` — all pass.

```bash
git add lib/alert-scope.ts tests/alert-scope.test.ts lib/background-tasks/price-check.ts && git commit -m "feat: respect distributor scoping in client alert checks"
```

---

## Task 2: Modal picker + creation wiring + bug fix

**Files:**
- Modify: `components/product/price-alert-modal.tsx`
- Modify: `app/product/[id].tsx`

- [ ] **Step 1: Add chip row to the modal**

In `components/product/price-alert-modal.tsx`:

1. Extend props with:
```typescript
  distributors?: Array<{ id: string; name: string; countryFlag: string }>;
  selectedDistributorId?: string | null;
  onSelectDistributor?: (id: string | null) => void;
```
Destructure them.

2. Render between the suggestion chips block and the target-price `TextInput`:

```tsx
          {distributors && distributors.length > 0 && (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 16,
              }}
            >
              <TouchableOpacity
                onPress={() => {
                  if (Platform.OS !== "web")
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onSelectDistributor?.(null);
                }}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor:
                    selectedDistributorId == null ? colors.primary : colors.border,
                  backgroundColor:
                    selectedDistributorId == null
                      ? colors.primary + "22"
                      : "transparent",
                }}
              >
                <Text
                  style={{
                    color:
                      selectedDistributorId == null ? colors.primary : colors.muted,
                    fontSize: 12,
                    fontWeight: "600",
                  }}
                >
                  All distributors
                </Text>
              </TouchableOpacity>
              {distributors.map((d) => {
                const selected = selectedDistributorId === d.id;
                return (
                  <TouchableOpacity
                    key={d.id}
                    onPress={() => {
                      if (Platform.OS !== "web")
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onSelectDistributor?.(d.id);
                    }}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? colors.primary + "22" : "transparent",
                    }}
                  >
                    <Text
                      style={{
                        color: selected ? colors.primary : colors.muted,
                        fontSize: 12,
                        fontWeight: "600",
                      }}
                    >
                      {d.countryFlag} {d.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
```

- [ ] **Step 2: Wire into `app/product/[id].tsx`**

1. Add state near `alertCurrency`: `const [alertDistributorId, setAlertDistributorId] = useState<string | null>(null);`
2. Compute distributors (near the other memos):

```typescript
  const alertDistributors = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; countryFlag: string }>();
    for (const listing of visibleListings) {
      if (seen.has(listing.distributorId)) continue;
      const dist = getDistributorById(listing.distributorId);
      seen.set(listing.distributorId, {
        id: listing.distributorId,
        name: dist?.name ?? listing.distributorId,
        countryFlag: dist?.countryFlag ?? "",
      });
    }
    return [...seen.values()];
  }, [visibleListings]);
```

(Adapt variable name if `visibleListings` differs at that scope — check what the screen uses.)

3. Reset scope when opening the modal — in the `onSetAlert` callback (`setAlertModalVisible(true)`), also `setAlertDistributorId(null)`.
4. Pass props on `<PriceAlertModal …>`:

```tsx
        distributors={alertDistributors}
        selectedDistributorId={alertDistributorId}
        onSelectDistributor={setAlertDistributorId}
```

5. In `handleSetAlert`, add to the `newAlert` object: `distributorId: alertDistributorId ?? undefined,` and extend deps with `alertDistributorId`. Update the success message to mention the distributor when scoped:

```typescript
    showAlert(
      "Alert Set",
      `You'll be notified when ${alertDistributorId ? `${getDistributorById(alertDistributorId)?.name ?? "that distributor"}'s price` : "the price"} drops below ${formatPrice(price, alertCurrency)}.`,
    );
```

6. **Bug fix** — in `handleSetBestAlert`, add to the `newAlert` object: `distributorId: listing.distributorId,`.

- [ ] **Step 3: Verify + commit**

Run: `pnpm check` — 0 errors. Run: `pnpm lint` — no new errors. Run: `pnpm test` — all pass.

```bash
git add components/product/price-alert-modal.tsx app/product/\[id\].tsx && git commit -m "feat: add distributor picker to price alert modal"
```

---

## Task 3: Alerts list badge + push

**Files:**
- Modify: `components/alerts/alert-card.tsx`
- Modify: `todo.md`

- [ ] **Step 1: Add scoped badge to AlertCard**

In `components/alerts/alert-card.tsx`, under the productName Text (before the Target row), render when scoped:

```tsx
          {alert.distributorId && (
            <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
              {(() => {
                const dist = getDistributorById(alert.distributorId!);
                return dist
                  ? `${dist.countryFlag} ${dist.name}`
                  : alert.distributorId;
              })()}
            </Text>
          )}
```

Add import: `import { getDistributorById } from "@/lib/distributors";`

Also add the same treatment to `triggered-alert-card.tsx` if it renders active-style rows (check its structure; apply identically where the product name is shown).

- [ ] **Step 2: Verify**

Run: `pnpm check` — 0 errors. Run: `pnpm lint` — no new errors. Run: `pnpm test` — all pass.

- [ ] **Step 3: Update `todo.md`**

Append Phase 86 section:

```markdown
## Phase 86: Distributor-Scoped Alerts (v5.34)

- [x] Add listingsForAlert helper with tests
- [x] Fix client alert evaluation to honor distributor scoping
- [x] Add distributor picker chips to Set Price Alert modal
- [x] Fix per-distributor "best alert" button to actually scope its alert
- [x] Show distributor badge on scoped alerts in the alerts list
```

- [ ] **Step 4: Commit and push**

```bash
git add components/alerts/alert-card.tsx components/alerts/triggered-alert-card.tsx todo.md && git commit -m "feat: show distributor badge on scoped alerts"
git push origin main
```

---

## Summary

| Metric | Value |
|--------|-------|
| New module | `lib/alert-scope.ts` (~10 lines) |
| New tests | 3 cases |
| Modified | price-check, modal, product detail (+bug fix), alert cards |
| Server changes | none (already supported) |
