# Multi-Tag Filtering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Any/All (OR/AND) multi-tag filtering with dynamic per-tag counts to the watchlist and Add Product screens, plus tag assignment while adding products.

**Architecture:** Extend the existing `lib/watchlist-org.ts` filter pipeline with a `tagMatchMode` field and a `countTagMatches` helper; extract the watchlist's inline tag chip row into a shared `components/tag-filter-row.tsx` reused by both screens; extend `TagPickerSheet` with an `onApply` mode for tagging products not yet in storage.

**Tech Stack:** TypeScript 5.9 (strict), React 19, React Native 0.81, Expo Router 6, vitest, `@testing-library/react` (jsdom, hooks only).

---

## Background / Conventions

- `lib/watchlist-org.ts` exports `WatchlistFilters` (`region`, `tagIds`, `status`, `query`), `filterWatchlist`, `productStatus`, `productRegion`, `sortWatchlist`, `groupWatchlist`. `filterWatchlist` currently uses `matchesTagFilter` (OR-only) from `lib/tags.ts`.
- `lib/tags.ts` exports `matchesTagFilter(product, selectedTagIds)` using `.some()`.
- `components/tag-picker-sheet.tsx` is a bottom-sheet that reads `product.tags` on open and persists every toggle via `setProductTags(product.id, next)`.
- `app/(tabs)/watchlist.tsx` has an inline tag chip row at lines ~1059-1116 (chips + a manage button opening `TagManageSheet`).
- `app/search.tsx` lists `PRODUCT_CATALOG` / `searchCatalog(query)` results; `addToWatchlist(product)` adds; catalog items are `Omit<Product, "addedAt" | "isWatched" | "listings">`.
- `lib/storage.ts` exports `getWatchlist`, `addToWatchlist`, `setProductTags`, `getTagDefinitions`, `addTagsToProducts`.
- Icons: `tag.fill` (→ "local-offer") and `slider.horizontal.3` (→ "tune") are already mapped in `components/ui/icon-symbol.tsx`.
- **Test infra note:** RN components (`View`/`Text`/`TouchableOpacity`) cannot render in this vitest setup (parse error on `react-native`). All new logic is tested as pure functions; UI behavior is verified via the browser smoke test in Task 8. Do not attempt `render(<TagFilterRow/>)` in vitest.

---

## File Structure

- Modify: `lib/tags.ts` (add `matchesTagFilterMode`)
- Modify: `lib/watchlist-org.ts` (add `tagMatchMode` to `WatchlistFilters`, `countTagMatches`)
- Modify: `tests/tags.test.ts` (new tests)
- Modify: `tests/watchlist-org.test.ts` (update `baseFilters`, new tests)
- Create: `components/tag-filter-row.tsx` (shared chip row)
- Modify: `components/tag-picker-sheet.tsx` (add `onApply` mode)
- Modify: `app/(tabs)/watchlist.tsx` (use `TagFilterRow`, `tagMatchMode`, counts)
- Modify: `app/search.tsx` (tag filter row + tag assignment)
- Modify: `todo.md`, `AGENTS.md` (Task 8)

---

### Task 1: `matchesTagFilterMode` in `lib/tags.ts`

**Files:**
- Modify: `lib/tags.ts:40-47`
- Test: `tests/tags.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/tags.test.ts` (after the existing `matchesTagFilter` describe block, before `generateTagId`):

```ts
describe("matchesTagFilterMode", () => {
  it("matches everything when no tags are selected", () => {
    expect(matchesTagFilterMode(makeProduct(), [], "any")).toBe(true);
    expect(matchesTagFilterMode(makeProduct(), [], "all")).toBe(true);
    expect(matchesTagFilterMode(makeProduct({ tags: ["a"] }), [], "all")).toBe(
      true,
    );
  });

  it("OR mode matches when the product has any selected tag", () => {
    const p = makeProduct({ tags: ["b"] });
    expect(matchesTagFilterMode(p, ["a", "b"], "any")).toBe(true);
    expect(matchesTagFilterMode(p, ["a", "c"], "any")).toBe(false);
  });

  it("AND mode matches only when the product has every selected tag", () => {
    const p = makeProduct({ tags: ["a", "b"] });
    expect(matchesTagFilterMode(p, ["a", "b"], "all")).toBe(true);
    expect(matchesTagFilterMode(p, ["a", "c"], "all")).toBe(false);
    expect(matchesTagFilterMode(p, ["a"], "all")).toBe(true);
  });

  it("AND mode requires at least one selected tag to match", () => {
    expect(matchesTagFilterMode(makeProduct({ tags: ["a"] }), ["a"], "all")).toBe(
      true,
    );
    expect(matchesTagFilterMode(makeProduct({ tags: ["a"] }), ["b"], "all")).toBe(
      false,
    );
  });

  it("silently ignores orphaned tag ids in both modes", () => {
    const p = makeProduct({ tags: ["a"] });
    expect(matchesTagFilterMode(p, ["a", "missing"], "any")).toBe(true);
    expect(matchesTagFilterMode(p, ["a", "missing"], "all")).toBe(true);
    expect(matchesTagFilterMode(p, ["missing"], "all")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/tags.test.ts`
Expected: FAIL — `matchesTagFilterMode is not a function`.

- [ ] **Step 3: Add the import to the test file**

Update the import at the top of `tests/tags.test.ts`:

```ts
import {
  TAG_PALETTE,
  generateTagId,
  getTagById,
  matchesTagFilter,
  matchesTagFilterMode,
  nextTagColor,
  tagColor,
} from "../lib/tags";
```

- [ ] **Step 4: Implement `matchesTagFilterMode`**

In `lib/tags.ts`, replace the `matchesTagFilter` function (lines 40-47) with:

```ts
export function matchesTagFilterMode(
  product: Product,
  selectedTagIds: string[],
  mode: "any" | "all",
): boolean {
  if (selectedTagIds.length === 0) return true;
  const tags = product.tags ?? [];
  if (mode === "all") return selectedTagIds.every((id) => tags.includes(id));
  const selected = new Set(selectedTagIds);
  return tags.some((id) => selected.has(id));
}

export function matchesTagFilter(
  product: Product,
  selectedTagIds: string[],
): boolean {
  return matchesTagFilterMode(product, selectedTagIds, "any");
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/tags.test.ts`
Expected: PASS (all suites, including existing `matchesTagFilter`).

- [ ] **Step 6: Commit**

```bash
git add lib/tags.ts tests/tags.test.ts
git commit -m "feat: add matchesTagFilterMode for OR/AND tag matching"
```

---

### Task 2: `tagMatchMode` + `countTagMatches` in `lib/watchlist-org.ts`

**Files:**
- Modify: `lib/watchlist-org.ts:17-22, 88-107`
- Test: `tests/watchlist-org.test.ts`

- [ ] **Step 1: Write the failing tests**

In `tests/watchlist-org.test.ts`:
1. Update `baseFilters` (line 53-58) to include the new required field:

```ts
const baseFilters: WatchlistFilters = {
  region: "all",
  tagIds: [],
  tagMatchMode: "any",
  status: "all",
  query: "",
};
```

2. Add `countTagMatches` to the import (line 3-10):

```ts
import {
  countTagMatches,
  filterWatchlist,
  groupWatchlist,
  priceDropPercent,
  productRegion,
  productStatus,
  sortWatchlist,
  type WatchlistFilters,
} from "../lib/watchlist-org";
```

3. Append a new describe block after the `filterWatchlist` describe block (after line 172):

```ts
describe("filterWatchlist tag modes", () => {
  const both = makeProduct(
    { id: "x", name: "X", modelNumber: "X-1", tags: ["t1", "t2"] },
    [makeListing("server2u-my")],
  );
  const onlyT1 = makeProduct(
    { id: "y", name: "Y", modelNumber: "Y-1", tags: ["t1"] },
    [makeListing("server2u-my")],
  );
  const none = makeProduct({ id: "z", name: "Z", modelNumber: "Z-1" }, [
    makeListing("server2u-my"),
  ]);
  const list = [both, onlyT1, none];

  it("OR mode matches products with any selected tag", () => {
    expect(
      filterWatchlist(list, { ...baseFilters, tagIds: ["t1", "t2"] }).map(
        (p) => p.id,
      ),
    ).toEqual(["x", "y"]);
  });

  it("AND mode matches only products with every selected tag", () => {
    expect(
      filterWatchlist(list, {
        ...baseFilters,
        tagIds: ["t1", "t2"],
        tagMatchMode: "all",
      }).map((p) => p.id),
    ).toEqual(["x"]);
  });

  it("AND mode with a single tag matches like OR", () => {
    expect(
      filterWatchlist(list, {
        ...baseFilters,
        tagIds: ["t1"],
        tagMatchMode: "all",
      }).map((p) => p.id),
    ).toEqual(["x", "y"]);
  });

  it("AND mode combines with other filters", () => {
    expect(
      filterWatchlist(list, {
        ...baseFilters,
        tagIds: ["t1", "t2"],
        tagMatchMode: "all",
        status: "in_stock",
      }).map((p) => p.id),
    ).toEqual(["x"]);
  });
});

describe("countTagMatches", () => {
  const inStockT1 = makeProduct(
    { id: "a", name: "Alpha", modelNumber: "A-1", tags: ["t1", "t2"] },
    [makeListing("server2u-my", { stockStatus: "in_stock" })],
  );
  const backOrderT2 = makeProduct(
    { id: "b", name: "Beta", modelNumber: "B-1", tags: ["t2"] },
    [makeListing("server2u-my", { stockStatus: "back_order" })],
  );
  const outT1 = makeProduct(
    { id: "c", name: "Gamma", modelNumber: "C-1", tags: ["t1"] },
    [makeListing("server2u-my", { stockStatus: "out_of_stock" })],
  );
  const untagged = makeProduct({ id: "d", name: "Delta", modelNumber: "D-1" }, [
    makeListing("server2u-my", { stockStatus: "in_stock" }),
  ]);
  const list = [inStockT1, backOrderT2, outT1, untagged];

  it("counts products per tag across the whole list", () => {
    expect(
      countTagMatches(list, { region: "all", status: "all", query: "" }),
    ).toEqual({ t1: 2, t2: 2 });
  });

  it("respects the status filter", () => {
    expect(
      countTagMatches(list, { region: "all", status: "in_stock", query: "" }),
    ).toEqual({ t1: 1, t2: 1 });
  });

  it("respects the region filter", () => {
    const eu = makeProduct(
      { id: "e", name: "Epsilon", modelNumber: "E-1", tags: ["t1"] },
      [makeListing("linitx-uk")],
    );
    expect(
      countTagMatches([...list, eu], { region: "Europe", status: "all", query: "" }),
    ).toEqual({ t1: 1 });
  });

  it("respects the query filter", () => {
    expect(
      countTagMatches(list, { region: "all", status: "all", query: "BETA" }),
    ).toEqual({ t2: 1 });
  });

  it("returns an empty object when nothing matches", () => {
    expect(
      countTagMatches(list, { region: "all", status: "all", query: "zzz" }),
    ).toEqual({});
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/watchlist-org.test.ts`
Expected: FAIL — `tagMatchMode` missing in `WatchlistFilters` type / `countTagMatches is not a function`.

- [ ] **Step 3: Update `WatchlistFilters` and `filterWatchlist`**

In `lib/watchlist-org.ts`:

1. Update the import from `./tags` (line 11):

```ts
import { matchesTagFilterMode } from "./tags";
```

2. Add `tagMatchMode` to the interface (lines 17-22):

```ts
export interface WatchlistFilters {
  region: string;
  tagIds: string[];
  tagMatchMode: "any" | "all";
  status: StatusFilter;
  query: string;
}
```

3. Update `filterWatchlist` (line 96):

```ts
    if (!matchesTagFilterMode(p, filters.tagIds, filters.tagMatchMode))
      return false;
```

- [ ] **Step 4: Implement `countTagMatches`**

Append to `lib/watchlist-org.ts` (after `filterWatchlist`, before `sortWatchlist`):

```ts
export function countTagMatches(
  list: Product[],
  filters: Pick<WatchlistFilters, "region" | "status" | "query">,
): Record<string, number> {
  const q = filters.query.trim().toLowerCase();
  const counts: Record<string, number> = {};
  for (const p of list) {
    if (filters.region !== "all" && !productHasRegion(p, filters.region))
      continue;
    if (filters.status !== "all" && productStatus(p) !== filters.status)
      continue;
    if (
      q &&
      !p.name.toLowerCase().includes(q) &&
      !p.modelNumber.toLowerCase().includes(q)
    )
      continue;
    for (const tagId of p.tags ?? []) {
      counts[tagId] = (counts[tagId] ?? 0) + 1;
    }
  }
  return counts;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/watchlist-org.test.ts`
Expected: PASS (all suites).

- [ ] **Step 6: Run typecheck**

Run: `pnpm check`
Expected: 0 errors. (The watchlist screen still passes a `WatchlistFilters` without `tagMatchMode` — fix it in Task 4. If `pnpm check` fails here on `app/(tabs)/watchlist.tsx`, that is expected; proceed to Task 4 before re-running.)

- [ ] **Step 7: Commit**

```bash
git add lib/watchlist-org.ts tests/watchlist-org.test.ts
git commit -m "feat: add tagMatchMode and countTagMatches to watchlist-org"
```

---

### Task 3: `components/tag-filter-row.tsx` (shared chip row)

**Files:**
- Create: `components/tag-filter-row.tsx`

- [ ] **Step 1: Write the component**

Create `components/tag-filter-row.tsx`:

```tsx
import { Text, TouchableOpacity, View } from "react-native";

import { useColors } from "@/hooks/use-colors";
import { TagDefinition } from "@/lib/types";

interface Props {
  tagDefinitions: Record<string, TagDefinition>;
  selectedTagIds: string[];
  tagMatchMode: "any" | "all";
  counts: Record<string, number>;
  onToggleTag: (tagId: string) => void;
  onChangeMode: (mode: "any" | "all") => void;
  onClearAll: () => void;
  onManage?: () => void;
}

export function TagFilterRow({
  tagDefinitions,
  selectedTagIds,
  tagMatchMode,
  counts,
  onToggleTag,
  onChangeMode,
  onClearAll,
  onManage,
}: Props) {
  const colors = useColors();
  const tags = Object.values(tagDefinitions);
  if (tags.length === 0) return null;
  const hasSelection = selectedTagIds.length > 0;
  const showMode = selectedTagIds.length >= 2;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        marginBottom: 8,
        gap: 8,
      }}
    >
      <View
        style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 8 }}
      >
        {tags.map((tag) => {
          const active = selectedTagIds.includes(tag.id);
          return (
            <TouchableOpacity
              key={tag.id}
              onPress={() => onToggleTag(tag.id)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 16,
                backgroundColor: active ? colors.primary : colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: active ? "#fff" : tag.color,
                  marginRight: 6,
                }}
              />
              <Text
                style={{
                  color: active ? "#fff" : colors.foreground,
                  fontSize: 13,
                  fontWeight: "600",
                }}
              >
                {tag.name} · {counts[tag.id] ?? 0}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {showMode && (
        <View
          style={{
            flexDirection: "row",
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: "hidden",
          }}
        >
          {(["any", "all"] as const).map((mode) => {
            const active = tagMatchMode === mode;
            return (
              <TouchableOpacity
                key={mode}
                onPress={() => onChangeMode(mode)}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  backgroundColor: active ? colors.primary : colors.surface,
                }}
              >
                <Text
                  style={{
                    color: active ? "#fff" : colors.foreground,
                    fontSize: 12,
                    fontWeight: "600",
                  }}
                >
                  {mode === "any" ? "Any" : "All"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
      {hasSelection && (
        <TouchableOpacity onPress={onClearAll} style={{ padding: 4 }}>
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>
            Clear
          </Text>
        </TouchableOpacity>
      )}
      {onManage && (
        <TouchableOpacity onPress={onManage} style={{ padding: 4 }}>
          <IconSymbol name="slider.horizontal.3" size={18} color={colors.muted} />
        </TouchableOpacity>
      )}
    </View>
  );
}
```

Note: the `onManage` prop renders the manage icon (already mapped in `components/ui/icon-symbol.tsx`) so the watchlist screen keeps its `TagManageSheet` entry point. The search screen omits it. Add `IconSymbol` to the imports:

```tsx
import { IconSymbol } from "@/components/ui/icon-symbol";
```

- [ ] **Step 2: Typecheck**

Run: `pnpm check`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/tag-filter-row.tsx
git commit -m "feat: shared TagFilterRow component with Any/All toggle and counts"
```

---

### Task 4: Watchlist screen integration

**Files:**
- Modify: `app/(tabs)/watchlist.tsx:396-405, 1059-1116`

- [ ] **Step 1: Add state and imports**

In `app/(tabs)/watchlist.tsx`:

1. Add to the imports (near the existing `filterWatchlist` import at line 48):

```ts
import { countTagMatches } from "@/lib/watchlist-org";
import { TagFilterRow } from "@/components/tag-filter-row";
```

2. Add state near `selectedTagIds` (line 371):

```ts
  const [tagMatchMode, setTagMatchMode] = useState<"any" | "all">("any");
```

- [ ] **Step 2: Pass `tagMatchMode` into `filterWatchlist` and compute counts**

Replace the `filteredWatchlist` useMemo (lines 396-405):

```ts
  const filteredWatchlist = useMemo(
    () =>
      filterWatchlist(watchlist, {
        region: regionFilter,
        tagIds: selectedTagIds,
        tagMatchMode,
        status: statusFilter,
        query,
      }),
    [watchlist, regionFilter, selectedTagIds, tagMatchMode, statusFilter, query],
  );

  const tagCounts = useMemo(
    () =>
      countTagMatches(watchlist, {
        region: regionFilter,
        status: statusFilter,
        query,
      }),
    [watchlist, regionFilter, statusFilter, query],
  );
```

- [ ] **Step 3: Replace the inline chip row with `<TagFilterRow>`**

Replace the block at lines 1059-1116 (the `{Object.keys(tagDefinitions).length > 0 && (...)}` container) with:

```tsx
      <TagFilterRow
        tagDefinitions={tagDefinitions}
        selectedTagIds={selectedTagIds}
        tagMatchMode={tagMatchMode}
        counts={tagCounts}
        onToggleTag={toggleTagFilter}
        onChangeMode={setTagMatchMode}
        onClearAll={() => setSelectedTagIds([])}
        onManage={() => setManageVisible(true)}
      />
```

- [ ] **Step 4: Typecheck and lint**

Run: `pnpm check` then `pnpm lint`
Expected: 0 errors; lint clean (only the pre-existing MODULE_TYPELESS warning).

- [ ] **Step 5: Run watchlist-org and tags tests**

Run: `npx vitest run tests/watchlist-org.test.ts tests/tags.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "app/(tabs)/watchlist.tsx"
git commit -m "feat: watchlist uses TagFilterRow with Any/All mode and dynamic counts"
```

---

### Task 5: `TagPickerSheet` `onApply` mode

**Files:**
- Modify: `components/tag-picker-sheet.tsx`

- [ ] **Step 1: Add the `onApply` prop**

Update the `Props` interface (lines 17-23):

```ts
interface Props {
  visible: boolean;
  product: Product | null;
  onClose: () => void;
  onChanged: () => void;
  onApply?: (tagIds: string[]) => void;
}
```

Update the destructure (lines 25-31):

```ts
export function TagPickerSheet({
  visible,
  product,
  onClose,
  onChanged,
  onApply,
}: Props) {
```

- [ ] **Step 2: Gate persistence on `onApply`**

In `toggleTag` (lines 48-55), skip persistence when `onApply` is set:

```ts
  const toggleTag = async (tagId: string) => {
    const next = selected.includes(tagId)
      ? selected.filter((id) => id !== tagId)
      : [...selected, tagId];
    setSelected(next);
    if (onApply) return;
    await setProductTags(product.id, next);
    onChanged();
  };
```

In `handleCreate` (lines 57-73), skip persistence when `onApply` is set:

```ts
  const handleCreate = async () => {
    const name = newTagName.trim();
    if (!name) return;
    try {
      const current = await getTagDefinitions();
      const tag = await createTag(name, nextTagColor(current));
      const next = [...selected, tag.id];
      setSelected(next);
      setDefs({ ...current, [tag.id]: tag });
      setNewTagName("");
      setError(null);
      if (onApply) return;
      await setProductTags(product.id, next);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create tag");
    }
  };
```

- [ ] **Step 3: Wire the Done button**

Replace the Done button `onPress` (line 210):

```ts
          <TouchableOpacity
            onPress={() => {
              if (onApply) onApply(selected);
              onClose();
            }}
            style={{ marginTop: 16, alignItems: "center", paddingVertical: 10 }}
          >
            <Text style={{ color: colors.muted, fontWeight: "600" }}>Done</Text>
          </TouchableOpacity>
```

- [ ] **Step 4: Typecheck**

Run: `pnpm check`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add components/tag-picker-sheet.tsx
git commit -m "feat: TagPickerSheet onApply mode for pre-add tag selection"
```

---

### Task 6: Search screen tag filter row

**Files:**
- Modify: `app/search.tsx`

- [ ] **Step 1: Add imports and state**

In `app/search.tsx`:

1. Add imports:

```ts
import { countTagMatches, filterWatchlist } from "@/lib/watchlist-org";
import { TagFilterRow } from "@/components/tag-filter-row";
import { getTagDefinitions } from "@/lib/storage";
import { TagDefinition } from "@/lib/types";
```

2. Add `useMemo` to the react import (line 1):

```ts
import { useCallback, useEffect, useMemo, useState } from "react";
```

3. Add state (after `trackedIds` at line 49):

```ts
  const [tagDefinitions, setTagDefinitions] = useState<
    Record<string, TagDefinition>
  >({});
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagMatchMode, setTagMatchMode] = useState<"any" | "all">("any");
```

3. Add a `watchlist` state for tag matching (after the above):

```ts
  const [watchlist, setWatchlist] = useState<Product[]>([]);
```

- [ ] **Step 2: Load tag definitions and watchlist on mount**

Replace the existing `useEffect` (lines 85-87):

```ts
  useEffect(() => {
    getWatchlist().then((wl) => {
      setWatchlist(wl);
      setTrackedIds(new Set(wl.map((p) => p.id)));
    });
    getTagDefinitions().then(setTagDefinitions).catch(() => {});
  }, []);
```

- [ ] **Step 3: Filter results by tags and compute counts**

Replace the `results` const (line 51-52):

```ts
  const results =
    query.trim().length > 0 ? searchCatalog(query) : PRODUCT_CATALOG;

  const tagFilteredResults = useMemo(() => {
    if (selectedTagIds.length === 0) return results;
    const matched = filterWatchlist(watchlist, {
      region: "all",
      tagIds: selectedTagIds,
      tagMatchMode,
      status: "all",
      query: "",
    });
    const matchedIds = new Set(matched.map((p) => p.id));
    return results.filter((item) => matchedIds.has(item.id));
  }, [results, watchlist, selectedTagIds, tagMatchMode]);

  const tagCounts = useMemo(
    () =>
      countTagMatches(watchlist, {
        region: "all",
        status: "all",
        query,
      }),
    [watchlist, query],
  );
```

- [ ] **Step 4: Render the tag filter row and use filtered results**

1. After the search bar `View` (closes at line 152), before the results `FlatList` (line 155), insert:

```tsx
      <TagFilterRow
        tagDefinitions={tagDefinitions}
        selectedTagIds={selectedTagIds}
        tagMatchMode={tagMatchMode}
        counts={tagCounts}
        onToggleTag={(id) =>
          setSelectedTagIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
          )
        }
        onChangeMode={setTagMatchMode}
        onClearAll={() => setSelectedTagIds([])}
      />
```

2. Change the `FlatList` `data` prop from `results` to `tagFilteredResults` (line 156).

3. Update the `ListHeaderComponent` count (lines 170-173) to use `tagFilteredResults`:

```tsx
            {query.trim()
              ? `${tagFilteredResults.length} result${tagFilteredResults.length !== 1 ? "s" : ""}`
              : "All Products"}
```

4. Update `ListEmptyComponent` (lines 175-199) to show a tag-specific hint:

```tsx
        ListEmptyComponent={
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
        }
```

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm check` then `pnpm lint`
Expected: 0 errors; lint clean.

- [ ] **Step 6: Commit**

```bash
git add app/search.tsx
git commit -m "feat: search screen tag filter row with dynamic counts"
```

---

### Task 7: Search screen tag assignment

**Files:**
- Modify: `app/search.tsx`

- [ ] **Step 1: Add pending-tags state and picker state**

In `app/search.tsx`, add state (after the `watchlist` state from Task 6):

```ts
  const [pendingTags, setPendingTags] = useState<Record<string, string[]>>({});
  const [pickerItem, setPickerItem] = useState<Product | null>(null);
  const [postAddProduct, setPostAddProduct] = useState<Product | null>(null);
```

Add imports:

```ts
import { TagPickerSheet } from "@/components/tag-picker-sheet";
```

- [ ] **Step 2: Add the tag icon button to each result row**

In the `renderItem` (line 200-282), inside the row `View` before the `+` button (line 259), insert a tag icon button:

```tsx
            <TouchableOpacity
              onPress={() =>
                setPickerItem({
                  ...item,
                  addedAt: "",
                  isWatched: false,
                  listings: [],
                  tags: pendingTags[item.id] ?? [],
                })
              }
              style={{
                marginRight: 8,
                padding: 6,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <IconSymbol name="tag.fill" size={18} color={colors.muted} />
            </TouchableOpacity>
```

- [ ] **Step 3: Apply pending tags on add and open the post-add sheet**

Replace `handleAdd` (lines 54-82):

```ts
  const handleAdd = useCallback(
    async (item: (typeof PRODUCT_CATALOG)[0]) => {
      if (adding) return;
      if (trackedIds.has(item.id)) {
        showAlert(
          "Already Tracked",
          `"${item.name}" is already in your watchlist.`,
        );
        return;
      }
      setAdding(item.id);
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const pending = pendingTags[item.id] ?? [];
      const product: Product = {
        ...item,
        addedAt: new Date().toISOString(),
        isWatched: true,
        listings: [],
        tags: pending,
      };
      try {
        await addToWatchlist(product);
        setTrackedIds((prev) => new Set(prev).add(item.id));
        setPendingTags((prev) => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
        if (pending.length > 0) {
          setPostAddProduct(product);
        } else {
          router.back();
        }
      } finally {
        setAdding(null);
      }
    },
    [router, trackedIds, adding, pendingTags],
  );
```

Note: `addToWatchlist` persists `product.tags` as-is (storage `addToWatchlist` spreads the product), so pending tags are applied by passing them in the product. No separate `setProductTags` call is needed.

- [ ] **Step 4: Render the two `TagPickerSheet` instances**

Before the closing `</ScreenContainer>` (after the `FlatList`, line 283), insert:

```tsx
      <TagPickerSheet
        visible={!!pickerItem}
        product={pickerItem}
        onClose={() => setPickerItem(null)}
        onChanged={() => {}}
        onApply={(tagIds) => {
          if (pickerItem) {
            setPendingTags((prev) => ({ ...prev, [pickerItem.id]: tagIds }));
          }
        }}
      />
      <TagPickerSheet
        visible={!!postAddProduct}
        product={postAddProduct}
        onClose={() => {
          setPostAddProduct(null);
          router.back();
        }}
        onChanged={() => {}}
      />
```

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm check` then `pnpm lint`
Expected: 0 errors; lint clean.

- [ ] **Step 6: Commit**

```bash
git add app/search.tsx
git commit -m "feat: tag assignment on add product screen"
```

---

### Task 8: Final verification + docs

**Files:**
- Modify: `todo.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Run the full verification suite**

Run: `pnpm check`
Expected: 0 TypeScript errors.

Run: `pnpm lint`
Expected: clean (only pre-existing MODULE_TYPELESS warning).

Run: `pnpm test`
Expected: all pass (existing 737 + new tags + watchlist-org tests).

- [ ] **Step 2: Browser smoke test**

With the DB-backed server + HTTPS static server running (see `/tmp/opencode/webpush/run-server-db.sh` and `https-static.cjs`), load the app in headed Chromium and verify:
1. Watchlist tag chips show counts (e.g. `CoreRouter · N`).
2. Selecting 2+ tags reveals the Any/All toggle; switching to All narrows to products with every tag; Clear resets.
3. Selecting a tag with dynamic counts respects the active status/region/search filters.
4. Add Product screen shows the tag filter row; selecting a tag filters the catalog to already-tagged watchlist products.
5. Add Product row tag icon opens the picker; selecting tags then tapping `+` adds the product with those tags and opens the post-add sheet; Done returns.
6. Quick add (no tag icon touched) still adds and returns in one tap.

- [ ] **Step 3: Update `todo.md`**

Append a Phase 56 section:

```markdown
## Phase 56: Multi-Tag Filtering (v5.4)

- [x] matchesTagFilterMode: OR/AND semantics for tag filters (lib/tags.ts)
- [x] tagMatchMode in WatchlistFilters; filterWatchlist supports any/all
- [x] countTagMatches: dynamic per-tag counts respecting region/status/query
- [x] Shared TagFilterRow component (chips + counts + inline Any/All toggle + Clear)
- [x] Watchlist uses TagFilterRow; counts update with active filters
- [x] Add Product screen: tag filter row over the catalog + tag assignment (row icon + post-add sheet)
- [x] Tests: tags OR/AND + watchlist-org tag modes + countTagMatches
```

- [ ] **Step 4: Update `AGENTS.md`**

In the `components/` directory listing, add `TagFilterRow`:

```
components/             Reusable UI (PriceSparkline, ScreenContainer, HapticTab, IconSymbol,
                        notification-center, connection-badge)
```
becomes
```
components/             Reusable UI (PriceSparkline, ScreenContainer, HapticTab, IconSymbol,
                        notification-center, connection-badge, TagFilterRow)
```

- [ ] **Step 5: Commit**

```bash
git add todo.md AGENTS.md
git commit -m "docs: Phase 56 multi-tag filtering (v5.4) in todo.md and AGENTS.md"
```

---

## Self-Review Notes

- **Spec coverage:** `tagMatchMode` in `WatchlistFilters` + `filterWatchlist` any/all (Task 2), `countTagMatches` dynamic counts (Task 2), shared `TagFilterRow` with inline Any/All + Clear (Task 3), watchlist integration (Task 4), search tag filter row (Task 6), search tag assignment row-icon + post-add sheet (Task 7), `TagPickerSheet` `onApply` mode (Task 5), docs (Task 8).
- **Type consistency:** `tagMatchMode: "any" | "all"` defined in `WatchlistFilters` (Task 2) and used identically in `TagFilterRow` props (Task 3), watchlist state (Task 4), search state (Task 6). `countTagMatches(list, { region, status, query })` signature consistent across Tasks 2/4/6. `onApply?: (tagIds: string[]) => void` consistent between Task 5 and Task 7.
- **Test infra deviation:** The spec's `components/tag-filter-row.tsx` render smoke test is not feasible (RN components fail to parse in vitest). Replaced with browser smoke test coverage in Task 8 Step 2; the component is exercised by `pnpm check` (types) and the running app.
- **`addToWatchlist` persistence:** storage's `addToWatchlist` spreads the incoming product, so passing `tags: pending` persists them — no separate `setProductTags` call in `handleAdd`.
- **Icon note:** `TagFilterRow`'s manage button uses a plain `⚙` text glyph instead of `IconSymbol` to avoid an extra icon dependency; `tag.fill` is used for the search row button and is already mapped.