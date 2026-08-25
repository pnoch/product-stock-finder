# Product Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Edit a product's name/model/brand/category/description via a sheet on product detail.

**Architecture:** `updateProductDetails` storage method (patch semantics + notify); self-contained edit sheet pre-filled from the product; pencil entry on ProductInfoCard.

**Tech Stack:** React Native, TypeScript strict.

---

## File Structure

| File | Change |
|------|--------|
| `lib/storage/watchlist.ts` + `index.ts` | +updateProductDetails |
| `components/product/edit-product-sheet.tsx` | new sheet |
| `components/product/product-info-card.tsx` | +onEditDetails pencil |
| `app/product/[id].tsx` | render sheet + wiring |
| `todo.md` | append Phase 102 |

---

## Task 1: Storage + sheet + wiring

**Files:** all of the above + todo.md

- [ ] **Step 1: Storage — `lib/storage/watchlist.ts`**

Add inside `createWatchlistStorage` (after removeFromWatchlist):

```typescript
  async function updateProductDetails(
    productId: string,
    fields: {
      name?: string;
      modelNumber?: string;
      brand?: string;
      category?: string;
      description?: string;
    },
  ): Promise<void> {
    await enqueue(KEYS.WATCHLIST, async () => {
      const list = await getWatchlist();
      const updated = list.map((p) => {
        if (p.id !== productId) return p;
        const next: Product = { ...p };
        if (fields.name?.trim()) next.name = fields.name.trim();
        if (fields.modelNumber?.trim())
          next.modelNumber = fields.modelNumber.trim();
        if (fields.brand !== undefined) next.brand = fields.brand.trim();
        if (fields.category !== undefined)
          next.category = fields.category.trim();
        if (fields.description !== undefined)
          next.description = fields.description.trim();
        return next;
      });
      await saveWatchlist(updated);
      notify("watchlist", productId);
    });
  }
```

Add to returned object; add to `lib/storage/index.ts` composition destructure (`updateProductDetails` from watchlist spread is NOT automatic — check: watchlist methods are destructured explicitly in index, so add there AND to named exports).

- [ ] **Step 2: Create `components/product/edit-product-sheet.tsx`**

Follow ManualAddSheet's modal shell. Props `{ visible, onClose, product }`. Internal draft state initialized from product on open (useEffect on visible). Fields: name/modelNumber/brand/category/description TextInputs (name+model required). Save:

```typescript
  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await updateProductDetails(product.id, {
        name: draft.name,
        modelNumber: draft.modelNumber,
        brand: draft.brand,
        category: draft.category,
        description: draft.description,
      });
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } finally {
      setSaving(false);
    }
  };
```

Show hint when modelNumber differs from original: "Model changed — listings will re-match on next refresh."

- [ ] **Step 3: Entry point**

1. `components/product/product-info-card.tsx`: new optional prop `onEditDetails?: () => void`; when set, render a small pencil TouchableOpacity in the brand/category header row (right side).
2. `app/product/[id].tsx`: state `editSheetVisible`; pass `onEditDetails={() => setEditSheetVisible(true)}` to `<ProductInfoCard>`; render `<EditProductSheet visible={editSheetVisible} onClose={...} product={product} />` near NotesCard.

- [ ] **Step 4: Verify**

Run: `pnpm check` — 0 errors. Run: `pnpm lint` — no new errors. Run: `pnpm test` — all pass.

- [ ] **Step 5: Update `todo.md` + commit + push**

Append Phase 102 section:

```markdown
## Phase 102: Product Editing (v6.2)

- [x] Add updateProductDetails storage method
- [x] Add editable product details sheet
- [x] Pencil entry on ProductInfoCard
```

Then:

```bash
git add lib/storage components/product/edit-product-sheet.tsx components/product/product-info-card.tsx app/product/\[id\].tsx todo.md && git commit -m "feat: add product editing"
git push origin main
```

---

## Summary

| Metric | Value |
|--------|-------|
| New storage method | `updateProductDetails` |
| New component | `edit-product-sheet.tsx` (~140 lines) |
