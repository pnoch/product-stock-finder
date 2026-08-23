# Search Screen Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Break `app/search.tsx` (417 lines) into smaller components, reducing it to ~130 lines.

**Architecture:** Extract 4 components + 1 custom hook into `components/search/` and `hooks/`. The main screen becomes a thin composition root with hooks and callbacks.

**Tech Stack:** React Native, Expo, TypeScript, expo-haptics, expo-router, AsyncStorage (via lib/storage.ts), NativeWind/useColors for theming.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `components/search/product-image.tsx` | Product image with loading state |
| `components/search/catalog-product-card.tsx` | Product card with add/tracked/tag buttons |
| `components/search/catalog-search-bar.tsx` | Search input with magnifying glass + clear |
| `components/search/search-empty-state.tsx` | Empty/no-results state |
| `hooks/use-search-data.ts` | loadData + tag filtering memos |
| `app/search.tsx` | Composition root (~130 lines) |

---

## Task 1: Extract ProductImage

**Files:**
- Create: `components/search/product-image.tsx`
- Modify: `app/search.tsx:27-45` (remove inline component, import)

- [ ] **Step 1: Create `components/search/product-image.tsx`**

```typescript
import { useEffect, useState } from "react";
import { Image } from "react-native";
import { fetchProductImage } from "@/lib/server-images";

export function ProductImage({ productId }: { productId: string }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    fetchProductImage(productId).then((res) => {
      if (active && res) setImageUrl(res.imageUrl);
    });
    return () => {
      active = false;
    };
  }, [productId]);
  if (!imageUrl) return null;
  return (
    <Image
      source={{ uri: imageUrl }}
      style={{ width: 48, height: 48, borderRadius: 8, marginRight: 12 }}
    />
  );
}
```

- [ ] **Step 2: Update `app/search.tsx` to use ProductImage**

Remove lines 27-45 (the inline ProductImage component) and add:
```typescript
import { ProductImage } from "@/components/search/product-image";
```

- [ ] **Step 3: Run `pnpm check` — 0 errors**

- [ ] **Step 4: Run `pnpm test` — all pass**

- [ ] **Step 5: Commit**

```bash
git add components/search/product-image.tsx app/search.tsx
git commit -m "refactor: extract ProductImage to components/search/"
```

---

## Task 2: Extract CatalogSearchBar

**Files:**
- Create: `components/search/catalog-search-bar.tsx`
- Modify: `app/search.tsx:174-209` (remove inline JSX, use component)

- [ ] **Step 1: Create `components/search/catalog-search-bar.tsx`**

```typescript
import { Text, View, TouchableOpacity, TextInput } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

interface CatalogSearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
}

export function CatalogSearchBar({ query, onQueryChange }: CatalogSearchBarProps) {
  const colors = useColors();

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginBottom: 16,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.surface,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 8,
      }}
    >
      <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
      <TextInput
        value={query}
        onChangeText={onQueryChange}
        placeholder="Search by model number or brand..."
        placeholderTextColor={colors.muted}
        style={{ flex: 1, color: colors.foreground, fontSize: 15 }}
        autoFocus
        returnKeyType="search"
      />
      {query.length > 0 && (
        <TouchableOpacity onPress={() => onQueryChange("")}>
          <IconSymbol
            name="xmark.circle.fill"
            size={18}
            color={colors.muted}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Update `app/search.tsx` to use CatalogSearchBar**

Remove lines 174-209 (the inline search bar) and replace with:
```typescript
import { CatalogSearchBar } from "@/components/search/catalog-search-bar";

<CatalogSearchBar query={query} onQueryChange={setQuery} />
```

- [ ] **Step 3: Run `pnpm check` — 0 errors**

- [ ] **Step 4: Run `pnpm test` — all pass**

- [ ] **Step 5: Commit**

```bash
git add components/search/catalog-search-bar.tsx app/search.tsx
git commit -m "refactor: extract CatalogSearchBar to components/search/"
```

---

## Task 3: Extract SearchEmptyState

**Files:**
- Create: `components/search/search-empty-state.tsx`
- Modify: `app/search.tsx:250-278` (remove inline JSX, use component)

- [ ] **Step 1: Create `components/search/search-empty-state.tsx`**

```typescript
import { Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

interface SearchEmptyStateProps {
  query: string;
  selectedTagIds: string[];
}

export function SearchEmptyState({ query, selectedTagIds }: SearchEmptyStateProps) {
  const colors = useColors();

  return (
    <View style={{ alignItems: "center", paddingTop: 60 }}>
      <IconSymbol name="magnifyingglass" size={40} color={colors.muted} />
      <Text
        style={{
          color: colors.foreground,
          fontWeight: "600",
          fontSize: 16,
          marginTop: 12,
        }}
      >
        {selectedTagIds.length > 0
          ? "No products match these tags"
          : "No results found"}
      </Text>
      <Text
        style={{
          color: colors.muted,
          fontSize: 14,
          textAlign: "center",
          marginTop: 6,
        }}
      >
        {selectedTagIds.length > 0
          ? "Try a different tag combination"
          : "Try a different model number or brand name"}
      </Text>
    </View>
  );
}
```

- [ ] **Step 2: Update `app/search.tsx` to use SearchEmptyState**

Remove lines 250-278 (the inline empty state) and replace with:
```typescript
import { SearchEmptyState } from "@/components/search/search-empty-state";

// In FlatList ListEmptyComponent:
ListEmptyComponent={<SearchEmptyState query={query} selectedTagIds={selectedTagIds} />}
```

- [ ] **Step 3: Run `pnpm check` — 0 errors**

- [ ] **Step 4: Run `pnpm test` — all pass**

- [ ] **Step 5: Commit**

```bash
git add components/search/search-empty-state.tsx app/search.tsx
git commit -m "refactor: extract SearchEmptyState to components/search/"
```

---

## Task 4: Extract CatalogProductCard

**Files:**
- Create: `components/search/catalog-product-card.tsx`
- Modify: `app/search.tsx:279-383` (remove inline JSX, use component)

- [ ] **Step 1: Create `components/search/catalog-product-card.tsx`**

```typescript
import { Text, View, TouchableOpacity, ActivityIndicator } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ProductImage } from "@/components/search/product-image";
import { Product } from "@/lib/types";

interface CatalogProductCardProps {
  product: Product;
  isTracked: boolean;
  isAdding: boolean;
  onAdd: (item: Product) => void;
  onTagPress: (item: Product) => void;
}

export function CatalogProductCard({
  product,
  isTracked,
  isAdding,
  onAdd,
  onTagPress,
}: CatalogProductCardProps) {
  const colors = useColors();

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: colors.border,
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <ProductImage productId={product.id} />
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text
          style={{
            color: colors.foreground,
            fontWeight: "600",
            fontSize: 15,
          }}
          numberOfLines={2}
        >
          {product.name}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>
          {product.modelNumber}
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: 4,
            gap: 6,
          }}
        >
          <View
            style={{
              backgroundColor: colors.primary + "22",
              borderRadius: 8,
              paddingHorizontal: 8,
              paddingVertical: 2,
            }}
          >
            <Text
              style={{
                color: colors.primary,
                fontSize: 11,
                fontWeight: "600",
              }}
            >
              {product.brand}
            </Text>
          </View>
          <Text style={{ color: colors.muted, fontSize: 11 }}>
            {product.category}
          </Text>
        </View>
      </View>
      {!isTracked && (
        <TouchableOpacity
          onPress={() => onTagPress(product)}
          style={{
            marginRight: 8,
            padding: 6,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <IconSymbol name="tag.fill" size={20} color={colors.muted} />
        </TouchableOpacity>
      )}
      <TouchableOpacity
        onPress={() => onAdd(product)}
        disabled={isAdding || isTracked}
        style={{
          backgroundColor: isTracked ? colors.success : colors.primary,
          borderRadius: 20,
          width: 36,
          height: 36,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {isAdding ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : isTracked ? (
          <IconSymbol name="checkmark" size={20} color="#fff" />
        ) : (
          <IconSymbol name="plus" size={20} color="#fff" />
        )}
      </TouchableOpacity>
    </View>
  );
}
```

- [ ] **Step 2: Update `app/search.tsx` to use CatalogProductCard**

Remove lines 279-383 (the inline product card renderItem) and replace with:
```typescript
import { CatalogProductCard } from "@/components/search/catalog-product-card";

// In FlatList renderItem:
renderItem={({ item }) => (
  <CatalogProductCard
    product={item as Product}
    isTracked={trackedIds.has(item.id)}
    isAdding={adding === item.id}
    onAdd={(p) => handleAdd(p)}
    onTagPress={(p) => setPickerItem({
      ...p,
      addedAt: "",
      isWatched: false,
      listings: [],
      tags: pendingTags[p.id] ?? [],
    })}
  />
)}
```

- [ ] **Step 3: Run `pnpm check` — 0 errors**

- [ ] **Step 4: Run `pnpm test` — all pass**

- [ ] **Step 5: Commit**

```bash
git add components/search/catalog-product-card.tsx app/search.tsx
git commit -m "refactor: extract CatalogProductCard to components/search/"
```

---

## Task 5: Extract useSearchData hook + cleanup

**Files:**
- Create: `hooks/use-search-data.ts`
- Modify: `app/search.tsx` (use hook, remove inline state/callbacks)
- Modify: `todo.md` (add Phase 73)

- [ ] **Step 1: Create `hooks/use-search-data.ts`**

```typescript
import { useCallback, useEffect, useMemo, useState } from "react";
import { searchCatalog, PRODUCT_CATALOG } from "@/lib/catalog";
import { addToWatchlist, getTagDefinitions, getWatchlist } from "@/lib/storage";
import { Product, TagDefinition } from "@/lib/types";
import { filterWatchlist, countTagMatchesByIds } from "@/lib/watchlist-org";

export function useSearchData() {
  const [watchlist, setWatchlist] = useState<Product[]>([]);
  const [trackedIds, setTrackedIds] = useState<Set<string>>(new Set());
  const [tagDefinitions, setTagDefinitions] = useState<
    Record<string, TagDefinition>
  >({});
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagMatchMode, setTagMatchMode] = useState<"any" | "all">("any");

  const loadData = useCallback(() => {
    getWatchlist().then((wl) => {
      setWatchlist(wl);
      setTrackedIds(new Set(wl.map((p) => p.id)));
    });
    getTagDefinitions()
      .then((defs) => {
        setTagDefinitions(defs);
        setSelectedTagIds((prev) => prev.filter((id) => id in defs));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    watchlist,
    trackedIds,
    tagDefinitions,
    selectedTagIds,
    setSelectedTagIds,
    tagMatchMode,
    setTagMatchMode,
    loadData,
  };
}
```

- [ ] **Step 2: Update `app/search.tsx` to use the hook**

Replace the data-loading state and callbacks with:
```typescript
import { useSearchData } from "@/hooks/use-search-data";

const {
  watchlist,
  trackedIds,
  tagDefinitions,
  selectedTagIds,
  setSelectedTagIds,
  tagMatchMode,
  setTagMatchMode,
  loadData,
} = useSearchData();
```

Remove: `useState` for `watchlist`, `trackedIds`, `tagDefinitions`, `selectedTagIds`, `tagMatchMode`. Remove `loadData` callback and its `useEffect`.

- [ ] **Step 3: Update `todo.md`**

Append Phase 73 section:
```
## Phase 73: Search Screen Refactor (v5.21)

- [x] Extract ProductImage to components/search/
- [x] Extract CatalogSearchBar to components/search/
- [x] Extract SearchEmptyState to components/search/
- [x] Extract CatalogProductCard to components/search/
- [x] Extract useSearchData hook to hooks/
- [x] Refactor main component to composition root
```

- [ ] **Step 4: Run `pnpm check` — 0 errors**

- [ ] **Step 5: Run `pnpm test` — all pass**

- [ ] **Step 6: Run `wc -l app/search.tsx` — should be ~130 lines**

- [ ] **Step 7: Commit and push**

```bash
git add app/search.tsx hooks/use-search-data.ts todo.md
git commit -m "refactor: extract useSearchData hook, cleanup search.tsx"
git push origin main
```

---

## Summary

| File | Before | After |
|------|--------|-------|
| `app/search.tsx` | 417 | ~130 |
| New: `components/search/` (4 files) | — | ~190 |
| New: `hooks/use-search-data.ts` | — | ~50 |
| **Net** | 417 | ~370 |

**Key metrics:**
- search.tsx: 69% reduction
- 4 new component files + 1 hook
- Same decomposition pattern as watchlist/alerts/settings/compare
