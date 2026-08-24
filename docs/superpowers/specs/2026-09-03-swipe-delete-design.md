# Swipe-to-Delete + Undo — Design Spec

**Date:** 2026-09-03
**Goal:** Add swipe-left-to-delete on watchlist cards with an undo snackbar, replacing confirmation for the swipe path (bulk/selection delete keeps its confirm flow).

## Background

The watchlist SectionList renders `ProductCard` per row (`app/(tabs)/watchlist.tsx` ~line 434); deletion currently goes through `handleDelete(productId, productName)` which shows a confirm dialog then `removeFromWatchlist`. `GestureHandlerRootView` already wraps the app, so react-native-gesture-handler's `Swipeable` needs no new dependency.

## New Component (components/watchlist/swipeable-card.tsx)

```typescript
export function SwipeableCard({
  children,
  onDelete,
}: {
  children: React.ReactNode;
  onDelete: () => void;
})
```

- Wraps children in `Swipeable` from `react-native-gesture-handler`.
- `renderRightActions`: full-height red panel (error color) with trash icon + "Remove" label; tap fires `onDelete`.
- Overshoot/friction defaults; no reanimated requirement (classic Swipeable).

## Wiring (app/(tabs)/watchlist.tsx)

- `renderItem` wraps `<ProductCard>` in `<SwipeableCard onDelete={() => handleSwipeDelete(item)}>`.
- New `handleSwipeDelete(product: Product)`:
  1. Haptic warning.
  2. Capture full product → `removeFromWatchlist(product.id)` → `reload()`.
  3. Show undo snackbar (no confirm dialog).
- Existing `handleDelete` (confirm dialog) remains for selection-mode/bulk delete paths.

## Undo Snackbar

Inline in watchlist.tsx:
- State: `{ product: Product; name: string } | null` + timer ref.
- Rendered as an absolutely-positioned bar at the bottom of the screen (above content): "Removed {name}" + bold "Undo" touchable.
- Undo: clear timer → `addToWatchlist(product)` (full-object restore preserves listings/history/tags) → `reload()` → dismiss.
- Auto-dismiss after 5 seconds; timer cleared on unmount and manual dismissal.

## Behavior Notes

- Web: gesture-handler supports pointer drags; legacy confirm path unchanged elsewhere.
- Sync-safe: remove/add fire normal change notifications.
- No new dependencies; no server changes.

## Testing

No new pure logic; existing suite must pass unchanged. Manual verification: swipe reveals action, delete removes, undo restores with listings intact.

## File Summary

| File | New/Modify |
|------|-----------|
| `components/watchlist/swipeable-card.tsx` | new (~60 lines) |
| `app/(tabs)/watchlist.tsx` | modify (wrapper + snackbar + handler) |
| `todo.md` | append Phase 87 |
