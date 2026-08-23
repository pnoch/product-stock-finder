# Product Detail Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Break `app/product/_components.tsx` (1,507 lines, 7 components) into individual files under `components/product/`.

**Architecture:** Extract 7 components to `components/product/`. The main file becomes a thin barrel re-export or is deleted.

**Tech Stack:** React Native, Expo, TypeScript.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `components/product/product-info-card.tsx` | Product header with brand, stats, currency converter |
| `components/product/action-buttons.tsx` | Set Alert, Refresh, Share, Test, Copy Link, Compare |
| `components/product/distributor-listing-card.tsx` | Single distributor row with price/status |
| `components/product/distributor-listing-section.tsx` | Container with filters, BestDistributor, insight, list |
| `components/product/price-alert-modal.tsx` | Price alert creation bottom-sheet |
| `components/product/reminder-date-picker-modal.tsx` | Date picker bottom-sheet for reminders |
| `components/product/price-chart-modal.tsx` | Full-screen price history chart modal |

---

## Task 1: Extract ProductInfoCard

**Files:**
- Create: `components/product/product-info-card.tsx`
- Modify: `app/product/_components.tsx`

- [ ] **Step 1: Create `components/product/product-info-card.tsx`**

Extract lines 1-256 from `_components.tsx`:
- Interface `ProductInfoCardProps`
- Function `ProductInfoCard`
- Imports: `Text`, `View`, `useColors`, `DistributorListing`, `formatPrice`, `convertPrice`, `getBestPrice`, `IconSymbol`, `formatLastRefreshed`, `getLastRefreshedColor`, `Product`

- [ ] **Step 2: Update `app/product/_components.tsx`**

Remove the ProductInfoCard code and add:
```typescript
export { ProductInfoCard } from "@/components/product/product-info-card";
```

- [ ] **Step 3: Run `pnpm check` — 0 errors**

- [ ] **Step 4: Run `pnpm test` — all pass**

- [ ] **Step 5: Commit**

```bash
git add components/product/product-info-card.tsx app/product/_components.tsx
git commit -m "refactor: extract ProductInfoCard to components/product/"
```

---

## Task 2: Extract ActionButtons

**Files:**
- Create: `components/product/action-buttons.tsx`
- Modify: `app/product/_components.tsx`

- [ ] **Step 1: Create `components/product/action-buttons.tsx`**

Extract lines 258-488 from `_components.tsx`:
- Interface `ActionButtonsProps`
- Function `ActionButtons`
- Imports: `Text`, `View`, `TouchableOpacity`, `ActivityIndicator`, `Platform`, `Haptics`, `useColors`, `IconSymbol`, `showAlert`

- [ ] **Step 2: Update `app/product/_components.tsx`**

Remove the ActionButtons code and add:
```typescript
export { ActionButtons } from "@/components/product/action-buttons";
```

- [ ] **Step 3: Run `pnpm check` — 0 errors**

- [ ] **Step 4: Run `pnpm test` — all pass**

- [ ] **Step 5: Commit**

```bash
git add components/product/action-buttons.tsx app/product/_components.tsx
git commit -m "refactor: extract ActionButtons to components/product/"
```

---

## Task 3: Extract DistributorListingCard

**Files:**
- Create: `components/product/distributor-listing-card.tsx`
- Modify: `app/product/_components.tsx`

- [ ] **Step 1: Create `components/product/distributor-listing-card.tsx`**

Extract lines 490-731 from `_components.tsx`:
- Interface `DistributorListingCardProps`
- Function `DistributorListingCard`
- Imports: `Text`, `View`, `TouchableOpacity`, `Platform`, `Haptics`, `useColors`, `DistributorListing`, `formatPrice`, `convertPrice`, `getDistributorById`, `formatLastRefreshed`, `getLastRefreshedColor`, `IconSymbol`, `StockBadge`, `PriceSparkline`, `openListingUrl`

- [ ] **Step 2: Update `app/product/_components.tsx`**

Remove the DistributorListingCard code and add:
```typescript
export { DistributorListingCard } from "@/components/product/distributor-listing-card";
```

- [ ] **Step 3: Run `pnpm check` — 0 errors**

- [ ] **Step 4: Run `pnpm test` — all pass**

- [ ] **Step 5: Commit**

```bash
git add components/product/distributor-listing-card.tsx app/product/_components.tsx
git commit -m "refactor: extract DistributorListingCard to components/product/"
```

---

## Task 4: Extract DistributorListingSection

**Files:**
- Create: `components/product/distributor-listing-section.tsx`
- Modify: `app/product/_components.tsx`

- [ ] **Step 1: Create `components/product/distributor-listing-section.tsx`**

Extract lines 733-1007 from `_components.tsx`:
- Interface `DistributorListingSectionProps`
- Function `DistributorListingSection`
- Imports: `Text`, `View`, `TouchableOpacity`, `useColors`, `DistributorListing`, `formatPrice`, `getDistributorById`, `BestDistributorCard`, `IconSymbol`, `Product`, `BestDeal`
- Internal import: `DistributorListingCard` from `./distributor-listing-card`

- [ ] **Step 2: Update `app/product/_components.tsx`**

Remove the DistributorListingSection code and add:
```typescript
export { DistributorListingSection } from "@/components/product/distributor-listing-section";
```

- [ ] **Step 3: Run `pnpm check` — 0 errors**

- [ ] **Step 4: Run `pnpm test` — all pass**

- [ ] **Step 5: Commit**

```bash
git add components/product/distributor-listing-section.tsx app/product/_components.tsx
git commit -m "refactor: extract DistributorListingSection to components/product/"
```

---

## Task 5: Extract PriceAlertModal

**Files:**
- Create: `components/product/price-alert-modal.tsx`
- Modify: `app/product/_components.tsx`

- [ ] **Step 1: Create `components/product/price-alert-modal.tsx`**

Extract lines 1009-1153 from `_components.tsx`:
- Interface `PriceAlertModalProps`
- Function `PriceAlertModal`
- Imports: `Text`, `View`, `TouchableOpacity`, `TextInput`, `Modal`, `useColors`, `EXCHANGE_RATES`, `IconSymbol`

- [ ] **Step 2: Update `app/product/_components.tsx`**

Remove the PriceAlertModal code and add:
```typescript
export { PriceAlertModal } from "@/components/product/price-alert-modal";
```

- [ ] **Step 3: Run `pnpm check` — 0 errors**

- [ ] **Step 4: Run `pnpm test` — all pass**

- [ ] **Step 5: Commit**

```bash
git add components/product/price-alert-modal.tsx app/product/_components.tsx
git commit -m "refactor: extract PriceAlertModal to components/product/"
```

---

## Task 6: Extract ReminderDatePickerModal

**Files:**
- Create: `components/product/reminder-date-picker-modal.tsx`
- Modify: `app/product/_components.tsx`

- [ ] **Step 1: Create `components/product/reminder-date-picker-modal.tsx`**

Extract lines 1155-1323 from `_components.tsx`:
- Interface `ReminderDatePickerModalProps`
- Function `ReminderDatePickerModal`
- Imports: `Text`, `View`, `TouchableOpacity`, `Modal`, `Platform`, `useColors`, `DistributorListing`, `getDistributorById`, `IconSymbol`, `DateTimePicker`

- [ ] **Step 2: Update `app/product/_components.tsx`**

Remove the ReminderDatePickerModal code and add:
```typescript
export { ReminderDatePickerModal } from "@/components/product/reminder-date-picker-modal";
```

- [ ] **Step 3: Run `pnpm check` — 0 errors**

- [ ] **Step 4: Run `pnpm test` — all pass**

- [ ] **Step 5: Commit**

```bash
git add components/product/reminder-date-picker-modal.tsx app/product/_components.tsx
git commit -m "refactor: extract ReminderDatePickerModal to components/product/"
```

---

## Task 7: Extract PriceChartModal + Final Cleanup + Push

**Files:**
- Create: `components/product/price-chart-modal.tsx`
- Modify: `app/product/_components.tsx`
- Modify: `app/product/[id].tsx` (update imports if needed)
- Modify: `todo.md`

- [ ] **Step 1: Create `components/product/price-chart-modal.tsx`**

Extract lines 1325-1507 from `_components.tsx`:
- Interface `PriceChartModalProps`
- Function `PriceChartModal`
- Imports: `Text`, `View`, `TouchableOpacity`, `Modal`, `useColors`, `DistributorListing`, `formatPrice`, `getDistributorById`, `IconSymbol`, `PriceHistoryChart`

- [ ] **Step 2: Update `app/product/_components.tsx`**

Remove the PriceChartModal code. The file should now be either:
- A thin barrel re-export file (~10 lines), or
- Deleted entirely if `[id].tsx` imports directly from `components/product/`

- [ ] **Step 3: Update imports in `app/product/[id].tsx`**

If `_components.tsx` is deleted, update `[id].tsx` to import from `@/components/product/*` directly.

- [ ] **Step 4: Update `todo.md`**

Append Phase 74 section:
```
## Phase 74: Product Detail Sub-Components Refactor (v5.22)

- [x] Extract ProductInfoCard to components/product/
- [x] Extract ActionButtons to components/product/
- [x] Extract DistributorListingCard to components/product/
- [x] Extract DistributorListingSection to components/product/
- [x] Extract PriceAlertModal to components/product/
- [x] Extract ReminderDatePickerModal to components/product/
- [x] Extract PriceChartModal to components/product/
- [x] Clean up barrel re-exports
```

- [ ] **Step 5: Run `pnpm check` — 0 errors**

- [ ] **Step 6: Run `pnpm test` — all pass**

- [ ] **Step 7: Run `wc -l app/product/_components.tsx` — should be ~0-10 lines**

- [ ] **Step 8: Commit and push**

```bash
git add components/product/ app/product/_components.tsx app/product/\[id\].tsx todo.md
git commit -m "refactor: extract PriceChartModal, cleanup product detail sub-components"
git push origin main
```

---

## Summary

| File | Before | After |
|------|--------|-------|
| `app/product/_components.tsx` | 1,507 | ~10 (barrel) or deleted |
| New: `components/product/` (7 files) | — | ~1,385 |
| **Net** | 1,507 | ~1,395 |

**Key metrics:**
- `_components.tsx`: 99% reduction
- 7 new component files
- Same decomposition pattern as watchlist/alerts/settings/compare/search
