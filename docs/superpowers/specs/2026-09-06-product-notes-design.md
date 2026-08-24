# Product Notes — Design Spec

**Date:** 2026-09-06
**Goal:** Let users attach a private note to any watchlist product, editable on the product detail screen.

## Module (lib/product-notes.ts)

Device-local (not synced — server schema change deferred). Standalone injectable module, key `product_notes`, shape `{ [productId]: string }`:

```typescript
export interface KeyValueStore { getItem/setItem/removeItem }

export async function getProductNote(productId: string, store = AsyncStorage): Promise<string>
export async function saveProductNote(productId: string, note: string, store = AsyncStorage): Promise<void>
```

Rules: `saveProductNote` trims; empty/whitespace note removes the entry; missing → ""; corrupt JSON → {} tolerance. The legacy `product_notes` key is already cleared by `clearAllData`.

## UI (components/product/notes-card.tsx)

Card on product detail between ProductInfoCard and the distributor section:
- View mode: saved note text, or muted "Add a private note…" placeholder; pencil icon right.
- Tap anywhere → edit mode: multiline TextInput (autoFocus, maxLength 500), Save + Cancel buttons.
- Save: trim → `saveProductNote` → haptic → back to view mode.
- Cancel: revert to stored value.
- Component owns its editing state; receives `{ productId }` only and loads/saves via the module (self-contained).

## Testing

`tests/product-notes.test.ts` with in-memory store: round-trip save/get; trim on save; empty note removes entry; missing product → ""; corrupt JSON tolerated.

## File Summary

| File | New/Modify |
|------|-----------|
| `lib/product-notes.ts` | new (~55 lines) |
| `tests/product-notes.test.ts` | new |
| `components/product/notes-card.tsx` | new (~110 lines) |
| `app/product/[id].tsx` | modify (render card) |
| `todo.md` | append Phase 90 |
