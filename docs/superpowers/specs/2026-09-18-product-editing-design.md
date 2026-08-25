# Product Editing — Design Spec

**Date:** 2026-09-18
**Goal:** Let users fix a product's details (name, model number, brand, category, description) via an edit sheet on product detail — critical for custom products added with a typo'd model number.

## Storage

`lib/storage/watchlist.ts` + composition + named export:

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
): Promise<void>
```

- enqueue(KEYS.WATCHLIST) pattern; patches only provided fields (trimmed); notifies watchlist per changed product.

## Sheet (components/product/edit-product-sheet.tsx)

Bottom sheet (ManualAddSheet conventions), props `{ visible, onClose, product }`:
- Loads fields from `product` prop; editable TextInputs for name/modelNumber/brand/category/description
- Validation: name + modelNumber non-empty
- Save → `updateProductDetails(product.id, trimmed fields)` → haptic → close
- Hint when modelNumber changed: "Listings will re-match on next refresh"

## Entry

Pencil icon button on `ProductInfoCard` header row (next to category) → new optional prop `onEditDetails` wired from `[id].tsx` to open the sheet. Sheet rendered in `[id].tsx`.

## Testing

No new pure logic; suite green.

## File Summary

| File | New/Modify |
|------|-----------|
| `lib/storage/watchlist.ts` + `index.ts` | +updateProductDetails |
| `components/product/edit-product-sheet.tsx` | new (~140 lines) |
| `components/product/product-info-card.tsx` | +onEditDetails pencil |
| `app/product/[id].tsx` | sheet render + wiring |
| `todo.md` | append Phase 102 |
