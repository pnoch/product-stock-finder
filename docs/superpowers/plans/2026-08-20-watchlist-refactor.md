# Watchlist Screen Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Break `app/(tabs)/watchlist.tsx` (1,240 lines) into focused, single-responsibility components. No behavior changes — pure structural refactoring.

**Architecture:** Extract 7 sub-components + move the existing ProductCard to its own file. Main screen becomes a ~440-line composition root.

**Tech Stack:** React Native, Expo Router, NativeWind, TypeScript

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `components/watchlist/product-card.tsx` | Product card with image, price, tags, actions |
| Create | `components/watchlist/summary-card.tsx` | Total value + status count cards |
| Create | `components/watchlist/watchlist-header.tsx` | Normal + selection mode header bar |
| Create | `components/watchlist/search-bar.tsx` | Search input with clear button |
| Create | `components/watchlist/progress-bar.tsx` | Thin progress bar during checks |
| Create | `components/watchlist/sort-group-bar.tsx` | Sort pill + group toggles + sort menu |
| Create | `components/watchlist/region-filter-row.tsx` | Region filter pills |
| Create | `components/watchlist/empty-state.tsx` | Empty/no-matches state with CTA |
| Modify | `app/(tabs)/watchlist.tsx` | Slim down to composition root (~440 lines) |

---

### Task 1: Extract ProductCard to components/

**Files:**
- Create: `components/watchlist/product-card.tsx`
- Modify: `app/(tabs)/watchlist.tsx`

- [ ] **Step 1: Read `app/(tabs)/watchlist.tsx` to find the ProductCard component (lines ~62-312)**

- [ ] **Step 2: Create `components/watchlist/product-card.tsx`**

Move the entire `ProductCard` function to its own file with proper imports. The component handles its own image fetching internally (1 useState + 1 useEffect).

Required imports:
```typescript
import { useState, useEffect } from "react";
import { Text, View, TouchableOpacity, Image, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/use-colors";
import { Product } from "@/lib/types";
import { formatPrice, convertPrice, getBestPrice } from "@/lib/currency";
import { StockBadge } from "@/components/stock-badge";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { fetchProductImage } from "@/lib/server-images";
import { formatLastRefreshed } from "@/lib/last-refreshed";
```

- [ ] **Step 3: Remove ProductCard from `app/(tabs)/watchlist.tsx` and add import**

```typescript
import { ProductCard } from "@/components/watchlist/product-card";
```

- [ ] **Step 4: Run typecheck + tests**

Run: `pnpm check && pnpm test`
Expected: 0 errors, all pass

- [ ] **Step 5: Commit**

```bash
git add components/watchlist/product-card.tsx app/\(tabs\)/watchlist.tsx
git commit -m "refactor: extract ProductCard to components/watchlist/"
```

---

### Task 2: Extract SummaryCard, SearchBar, ProgressBar

**Files:**
- Create: `components/watchlist/summary-card.tsx`
- Create: `components/watchlist/search-bar.tsx`
- Create: `components/watchlist/progress-bar.tsx`

- [ ] **Step 1: Read the relevant sections from `app/(tabs)/watchlist.tsx`**
- SummaryCard: lines ~722-823
- SearchBar: lines ~825-866
- ProgressBar: lines ~868-881

- [ ] **Step 2: Create all 3 components**

Each should be a pure presentational component with explicit props. Read the exact JSX from the file to extract. Use `SettingRow`-style layout or plain View/Text as appropriate.

For SummaryCard: Takes `summary`, `displayCurrency`, `statusFilter`, `onStatusToggle`.
For SearchBar: Takes `query`, `onQueryChange`.
For ProgressBar: Takes `progress`, `visible`.

- [ ] **Step 3: Update `app/(tabs)/watchlist.tsx`**

Remove the inline JSX for these 3 sections and replace with imported components.

- [ ] **Step 4: Run typecheck + tests**

Run: `pnpm check && pnpm test`
Expected: 0 errors, all pass

- [ ] **Step 5: Commit**

```bash
git add components/watchlist/summary-card.tsx components/watchlist/search-bar.tsx components/watchlist/progress-bar.tsx app/\(tabs\)/watchlist.tsx
git commit -m "refactor: extract SummaryCard, SearchBar, ProgressBar to components/watchlist/"
```

---

### Task 3: Extract WatchlistHeader

**Files:**
- Create: `components/watchlist/watchlist-header.tsx`

- [ ] **Step 1: Read lines ~535-720 from `app/(tabs)/watchlist.tsx`**

This is a ternary that renders either selection mode or normal mode.

- [ ] **Step 2: Create the component**

Props: `mode` ("normal" | "selection"), `selectedCount`, `watchlistLength`, `isRefreshingAny`, `checking`, `onAnalysis`, `onRefresh`, `onCheckNow`, `onAdd`, `onBulkDelete`, `onBulkTag`, `onExitSelection`.

- [ ] **Step 3: Update `app/(tabs)/watchlist.tsx`**

Remove the header JSX and replace with `<WatchlistHeader ... />`.

- [ ] **Step 4: Run typecheck + tests**

Run: `pnpm check && pnpm test`
Expected: 0 errors, all pass

- [ ] **Step 5: Commit**

```bash
git add components/watchlist/watchlist-header.tsx app/\(tabs\)/watchlist.tsx
git commit -m "refactor: extract WatchlistHeader to components/watchlist/"
```

---

### Task 4: Extract SortGroupBar, RegionFilterRow, EmptyState

**Files:**
- Create: `components/watchlist/sort-group-bar.tsx`
- Create: `components/watchlist/region-filter-row.tsx`
- Create: `components/watchlist/empty-state.tsx`

- [ ] **Step 1: Read the relevant sections**
- SortGroupBar + Sort Menu: lines ~883-999
- RegionFilterRow: lines ~1001-1037
- EmptyState: lines ~1066-1149

- [ ] **Step 2: Create all 3 components**

For SortGroupBar: Takes `sortMode`, `groupMode`, `sortMenuOpen`, `onSortModeChange`, `onGroupModeChange`, `onSortMenuToggle`.
For RegionFilterRow: Takes `regions`, `regionFilter`, `onRegionChange`.
For EmptyState: Takes `query`, `statusFilter`, `regionFilter`, `selectedTagIds`, `onClearFilters`, `onAddProduct`.

- [ ] **Step 3: Update `app/(tabs)/watchlist.tsx`**

Remove the inline JSX for these 3 sections and replace with imported components.

- [ ] **Step 4: Run typecheck + tests**

Run: `pnpm check && pnpm test`
Expected: 0 errors, all pass

- [ ] **Step 5: Commit**

```bash
git add components/watchlist/sort-group-bar.tsx components/watchlist/region-filter-row.tsx components/watchlist/empty-state.tsx app/\(tabs\)/watchlist.tsx
git commit -m "refactor: extract SortGroupBar, RegionFilterRow, EmptyState to components/watchlist/"
```

---

### Task 5: Refactor main watchlist.tsx to composition root

**Files:**
- Modify: `app/(tabs)/watchlist.tsx`

- [ ] **Step 1: Rewrite the main component**

Ensure all state, callbacks, derived state remain. Replace all remaining inline JSX with imported sub-components. The SectionList renderSectionHeader should stay inline (it uses `tagDefinitions` and `groupMode` directly).

- [ ] **Step 2: Run typecheck + tests**

Run: `pnpm check && pnpm test`
Expected: 0 errors, all pass

- [ ] **Step 3: Verify line count**

Run: `wc -l app/\(tabs\)/watchlist.tsx`
Expected: ~440 lines (down from 1,240)

- [ ] **Step 4: Commit**

```bash
git add app/\(tabs\)/watchlist.tsx
git commit -m "refactor: slim watchlist.tsx to composition root"
```

---

### Task 6: Update todo.md + final verification

- [ ] **Step 1: Update todo.md**

Append Phase 70 section:
```markdown

## Phase 70: Watchlist Screen Refactor (v5.18)

- [x] Extract ProductCard to components/watchlist/
- [x] Extract SummaryCard, SearchBar, ProgressBar
- [x] Extract WatchlistHeader
- [x] Extract SortGroupBar, RegionFilterRow, EmptyState
- [x] Refactor main component to composition root
```

- [ ] **Step 2: Full verification**

Run: `pnpm check && pnpm lint && pnpm test`
Expected: 0 TypeScript errors, lint clean, all tests pass

- [ ] **Step 3: Commit**

```bash
git add todo.md
git commit -m "refactor: Phase 70 docs"
```

- [ ] **Step 4: Push**

```bash
git push origin main
```
