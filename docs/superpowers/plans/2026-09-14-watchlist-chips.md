# Watchlist Insight Chips Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface per-product insights (all-time-low, dropping streak) as chips on watchlist cards.

**Architecture:** Reuse Phase 95's `computeProductInsights` — the watchlist screen computes it once and passes each card its insight via a Map; `ProductCard` renders an optional chip row.

**Tech Stack:** React Native, TypeScript strict.

---

## File Structure

| File | Change |
|------|--------|
| `components/watchlist/product-card.tsx` | +`insight` prop + chip row |
| `app/(tabs)/watchlist.tsx` | memo + Map + pass prop |
| `todo.md` | append Phase 98 |

---

## Task 1: Chips + wiring

**Files:**
- Modify: `components/watchlist/product-card.tsx`
- Modify: `app/(tabs)/watchlist.tsx`
- Modify: `todo.md`

- [ ] **Step 1: Add chip row to ProductCard**

1. Extend props:

```typescript
  insight?: { atAllTimeLow: boolean; dropStreak: number };
```

(destructure alongside the others).

2. After the existing `{validTags.length > 0 && (...)}` block, add:

```tsx
      {insight && (insight.atAllTimeLow || insight.dropStreak >= 2) && (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 6,
            marginTop: validTags.length > 0 ? 6 : 10,
          }}
        >
          {insight.atAllTimeLow && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                backgroundColor: colors.success + "22",
                borderRadius: 8,
                paddingHorizontal: 8,
                paddingVertical: 3,
              }}
            >
              <Text style={{ color: colors.success, fontSize: 10, fontWeight: "700" }}>
                🏅 All-time low
              </Text>
            </View>
          )}
          {insight.dropStreak >= 2 && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                backgroundColor: colors.primary + "22",
                borderRadius: 8,
                paddingHorizontal: 8,
                paddingVertical: 3,
              }}
            >
              <Text style={{ color: colors.primary, fontSize: 10, fontWeight: "700" }}>
                ▼ Dropping ×{insight.dropStreak}
              </Text>
            </View>
          )}
        </View>
      )}
```

(`colors` and `validTags` already exist in scope.)

- [ ] **Step 2: Wire into watchlist.tsx**

1. Import: `import { computeProductInsights } from "@/lib/product-insights";`
2. Memo near the others (after `displayCurrency` is available):

```typescript
  const insightMap = useMemo(() => {
    const result = computeProductInsights(watchlist, displayCurrency);
    return new Map(result.products.map((p) => [p.productId, p] as const));
  }, [watchlist, displayCurrency]);
```

(Verify the screen has `displayCurrency` in scope — it computes `computeWatchlistSummary(watchlist, displayCurrency)` at line ~139, so yes.)

3. In renderItem (~line 474), add prop to `<ProductCard … />`:

```tsx
                insight={
                  insightMap.has(item.id)
                    ? {
                        atAllTimeLow: insightMap.get(item.id)!.atAllTimeLow,
                        dropStreak: insightMap.get(item.id)!.dropStreak,
                      }
                    : undefined
                }
```

- [ ] **Step 3: Verify**

Run: `pnpm check` — 0 errors. Run: `pnpm lint` — no new errors. Run: `pnpm test` — all pass.

- [ ] **Step 4: Update `todo.md` + commit + push**

Append Phase 98 section:

```markdown
## Phase 98: Watchlist Insight Chips (v5.46)

- [x] Surface all-time-low / dropping chips on watchlist cards
```

Then:

```bash
git add components/watchlist/product-card.tsx app/\(tabs\)/watchlist.tsx todo.md && git commit -m "feat: show insight chips on watchlist cards"
git push origin main
```

---

## Summary

| Metric | Value |
|--------|-------|
| Modified | product-card (+chip row), watchlist (+memo/prop) |
| New deps | none |
