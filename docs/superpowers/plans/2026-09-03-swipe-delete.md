# Swipe-to-Delete + Undo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Swipe-left-to-delete on watchlist cards with a 5-second undo snackbar (no confirm dialog on the swipe path).

**Architecture:** New `SwipeableCard` wrapper using react-native-gesture-handler's `Swipeable` (root view already exists); watchlist screen captures the full Product before removal and shows an inline undo bar that restores via `addToWatchlist`.

**Tech Stack:** react-native-gesture-handler (already installed), React Native, TypeScript strict.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `components/watchlist/swipeable-card.tsx` | Swipeable wrapper with delete action |
| `app/(tabs)/watchlist.tsx` | Wrap cards, swipe-delete handler, undo snackbar |

---

## Task 1: SwipeableCard + wiring + push

**Files:**
- Create: `components/watchlist/swipeable-card.tsx`
- Modify: `app/(tabs)/watchlist.tsx`
- Modify: `todo.md`

- [ ] **Step 1: Create `components/watchlist/swipeable-card.tsx`**

```typescript
import { useRef } from "react";
import { Text, View } from "react-native";
import { RectButton, Swipeable } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

export function SwipeableCard({
  children,
  onDelete,
}: {
  children: React.ReactNode;
  onDelete: () => void;
}) {
  const colors = useColors();
  const swipeableRef = useRef<Swipeable>(null);

  const renderRightActions = () => (
    <RectButton
      onPress={() => {
        if (Platform.OS !== "web")
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        swipeableRef.current?.close();
        onDelete();
      }}
      style={{
        width: 88,
        marginLeft: 8,
        borderRadius: 16,
        backgroundColor: colors.error,
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
      }}
    >
      <IconSymbol name="trash.fill" size={20} color="#fff" />
      <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>
        Remove
      </Text>
    </RectButton>
  );

  return (
    <View>
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        rightThreshold={40}
      >
        {children}
      </Swipeable>
    </View>
  );
}
```

Note: verify `trash.fill` has an Android/web mapping in `components/ui/icon-symbol.tsx`; add one if missing. Check the exact import path/naming (`Swipeable` vs `ReanimatedSwipeable`) against the installed gesture-handler version — classic `Swipeable` exists in v2 without reanimated.

- [ ] **Step 2: Wire into `app/(tabs)/watchlist.tsx`**

1. Add imports:

```typescript
import { SwipeableCard } from "@/components/watchlist/swipeable-card";
```

(`addToWatchlist`, `removeFromWatchlist` are already imported — verify.)

2. Add snackbar state + timer ref near the other state:

```typescript
  const [undoProduct, setUndoProduct] = useState<Product | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
```

(Ensure `useRef` is imported from react; ensure `Product` type is imported.)

3. Add handlers near `handleDelete`:

```typescript
  const showUndoBar = useCallback((product: Product) => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndoProduct(product);
    undoTimer.current = setTimeout(() => setUndoProduct(null), 5000);
  }, []);

  const handleSwipeDelete = useCallback(
    async (product: Product) => {
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      await removeFromWatchlist(product.id);
      await reload();
      showUndoBar(product);
    },
    [reload, showUndoBar],
  );

  const handleUndo = useCallback(async () => {
    if (!undoProduct) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndoProduct(null);
    await addToWatchlist(undoProduct);
    await reload();
  }, [undoProduct, reload]);
```

(Check whether the screen uses `reload` or another refresh function name — match what `handleDelete` uses at line ~220.)

4. Wrap the card in `renderItem` (~line 434):

```tsx
        renderItem={({ item }) => (
          <SwipeableCard onDelete={() => handleSwipeDelete(item)}>
            <ProductCard
              ...existing props unchanged...
            />
          </SwipeableCard>
        )}
```

5. Render the undo snackbar just before the closing fragment of the screen's return (after the SectionList / other overlays, e.g. after `<TagPickerSheet … />`):

```tsx
      {undoProduct && (
        <View
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 16,
            backgroundColor: colors.foreground,
            borderRadius: 14,
            paddingHorizontal: 16,
            paddingVertical: 12,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            shadowColor: "#000",
            shadowOpacity: 0.25,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
            elevation: 6,
          }}
        >
          <Text
            style={{ color: colors.background, fontSize: 13, flex: 1 }}
            numberOfLines={1}
          >
            Removed {undoProduct.name}
          </Text>
          <TouchableOpacity onPress={handleUndo}>
            <Text
              style={{
                color: colors.primary,
                fontSize: 13,
                fontWeight: "700",
              }}
            >
              Undo
            </Text>
          </TouchableOpacity>
        </View>
      )}
```

(Verify `colors` is in scope in that component — it is via `useColors()`.)

6. Cleanup on unmount — add where appropriate:

```typescript
  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);
```

**Step 3: Verify**

1. Run `pnpm check` — 0 errors
2. Run `pnpm lint` — no new errors
3. Run `pnpm test` — all pass

**Step 4: Update `todo.md`**

Append Phase 87 section at the end:

```markdown
## Phase 87: Swipe-to-Delete + Undo (v5.35)

- [x] Add SwipeableCard wrapper (gesture-handler Swipeable, red Remove action)
- [x] Wire swipe-delete into watchlist cards (no confirm on swipe path)
- [x] Add 5-second undo snackbar restoring the full product
```

**Step 5: Commit and push**

```bash
git add components/watchlist/swipeable-card.tsx app/\(tabs\)/watchlist.tsx todo.md && git commit -m "feat: swipe-to-delete with undo on watchlist"
git push origin main
```

---

## Summary

| Metric | Value |
|--------|-------|
| New component | `swipeable-card.tsx` (~55 lines) |
| Modified | `watchlist.tsx` (wrapper + handler + snackbar) |
| New deps | none |
