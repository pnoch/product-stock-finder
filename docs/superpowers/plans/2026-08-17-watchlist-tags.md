# Watchlist Tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add colored, many-per-product tags to the watchlist with a tag picker sheet, a manage sheet, and an OR-semantics tag filter chip row.

**Architecture:** Products carry `tags?: string[]` (tag ids) and sync via the existing `watchlist` collection; tag definitions (`TagDefinition { id, name, color }`) live in `AppSettings.tagDefinitions` and sync via the existing `settings` collection. Pure tag helpers live in a new `lib/tags.ts`; storage mutations in `lib/storage.ts`; two new sheet components; the watchlist screen wires the filter bar, card tag button + chips, and both sheets. No backend/schema changes.

**Tech Stack:** Expo SDK 54 / RN 0.81 / TypeScript 5.9 (strict), NativeWind, vitest, AsyncStorage.

**Spec:** `docs/superpowers/specs/2026-08-17-watchlist-tags-design.md`

---

### Task 1: Data model types

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Add the `TagDefinition` interface and the two new fields**

Add after the `PriceSnapshot` interface (near the top of the file):

```ts
export interface TagDefinition {
  id: string;
  name: string;
  color: string;
}
```

In `Product`, add `tags?: string[];` after `isWatched`:

```ts
export interface Product {
  id: string;
  name: string;
  modelNumber: string;
  brand: string;
  category: string;
  description: string;
  imageUrl?: string;
  addedAt: string;
  lastRefreshed?: string; // ISO date string — set when listings are refreshed
  isWatched: boolean;
  listings: DistributorListing[];
  tags?: string[];
}
```

In `AppSettings`, add `tagDefinitions?: Record<string, TagDefinition>;` after `webNotificationsEnabled`:

```ts
export interface AppSettings {
  theme: "light" | "dark" | "auto";
  displayCurrency: string;
  checkInterval: "manual" | "hourly" | "daily";
  notificationsEnabled: boolean;
  stockAlerts: boolean;
  priceAlerts: boolean;
  enabledDistributors?: string[];
  lastScrapeTime?: string;
  shippingRegion?: string;
  digestFrequency?: "off" | "daily" | "weekly";
  webNotificationsEnabled?: boolean;
  tagDefinitions?: Record<string, TagDefinition>;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm check`
Expected: 0 errors (additive type-only change).

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add TagDefinition and tags fields to Product/AppSettings"
```

---

### Task 2: `lib/tags.ts` pure helpers (TDD)

**Files:**
- Create: `lib/tags.ts`
- Test: `tests/tags.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/tags.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  TAG_PALETTE,
  generateTagId,
  getTagById,
  matchesTagFilter,
  nextTagColor,
  tagColor,
} from "../lib/tags";
import { Product, TagDefinition } from "../lib/types";

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    name: "Test Product",
    modelNumber: "TP-1",
    brand: "Test",
    category: "Switch",
    description: "",
    addedAt: "2026-01-01T00:00:00.000Z",
    isWatched: true,
    listings: [],
    ...overrides,
  };
}

function makeDefs(...tags: TagDefinition[]): Record<string, TagDefinition> {
  return Object.fromEntries(tags.map((t) => [t.id, t]));
}

describe("nextTagColor", () => {
  it("returns the first unused palette color", () => {
    const d = makeDefs({ id: "a", name: "A", color: TAG_PALETTE[0] });
    expect(nextTagColor(d)).toBe(TAG_PALETTE[1]);
  });

  it("returns the first palette color when none are used", () => {
    expect(nextTagColor({})).toBe(TAG_PALETTE[0]);
  });

  it("cycles to the next color when all palette colors are used", () => {
    const all = TAG_PALETTE.map((color, i) => ({
      id: `t${i}`,
      name: `T${i}`,
      color,
    }));
    expect(nextTagColor(makeDefs(...all))).toBe(TAG_PALETTE[0]);
  });
});

describe("getTagById", () => {
  it("returns the definition for an existing id", () => {
    const d = makeDefs({ id: "a", name: "A", color: "#00C896" });
    expect(getTagById(d, "a")?.name).toBe("A");
  });

  it("returns undefined for an unknown id", () => {
    expect(getTagById({}, "nope")).toBeUndefined();
  });
});

describe("tagColor", () => {
  it("returns the tag color for an existing id", () => {
    const d = makeDefs({ id: "a", name: "A", color: "#00C896" });
    expect(tagColor(d, "a")).toBe("#00C896");
  });

  it("returns the first palette color for an unknown id", () => {
    expect(tagColor({}, "nope")).toBe(TAG_PALETTE[0]);
  });
});

describe("matchesTagFilter", () => {
  it("matches everything when no tags are selected", () => {
    expect(matchesTagFilter(makeProduct(), [])).toBe(true);
    expect(matchesTagFilter(makeProduct({ tags: ["a"] }), [])).toBe(true);
  });

  it("matches when the product has any selected tag (OR)", () => {
    expect(matchesTagFilter(makeProduct({ tags: ["b"] }), ["a", "b"])).toBe(true);
  });

  it("does not match when the product has none of the selected tags", () => {
    expect(matchesTagFilter(makeProduct({ tags: ["c"] }), ["a", "b"])).toBe(false);
  });

  it("does not match a product with no tags", () => {
    expect(matchesTagFilter(makeProduct(), ["a"])).toBe(false);
  });

  it("silently ignores orphaned tag ids in the filter selection", () => {
    const p = makeProduct({ tags: ["a"] });
    expect(matchesTagFilter(p, ["a", "missing"])).toBe(true);
    expect(matchesTagFilter(p, ["missing"])).toBe(false);
  });
});

describe("generateTagId", () => {
  it("returns a non-empty string", () => {
    expect(generateTagId()).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/tags.test.ts`
Expected: FAIL — module `../lib/tags` not found.

- [ ] **Step 3: Write the implementation**

Create `lib/tags.ts`:

```ts
import { Product, TagDefinition } from "./types";

export const TAG_PALETTE: string[] = [
  "#0F52BA",
  "#00C896",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#F97316",
  "#6366F1",
  "#64748B",
];

export function getTagById(
  defs: Record<string, TagDefinition>,
  id: string,
): TagDefinition | undefined {
  return defs[id];
}

export function tagColor(
  defs: Record<string, TagDefinition>,
  id: string,
): string {
  return getTagById(defs, id)?.color ?? TAG_PALETTE[0];
}

export function nextTagColor(
  defs: Record<string, TagDefinition>,
): string {
  const used = new Set(Object.values(defs).map((d) => d.color));
  const free = TAG_PALETTE.find((c) => !used.has(c));
  if (free) return free;
  const last = Object.values(defs).at(-1);
  if (!last) return TAG_PALETTE[0];
  const idx = TAG_PALETTE.indexOf(last.color);
  return TAG_PALETTE[(idx + 1) % TAG_PALETTE.length];
}

export function matchesTagFilter(
  product: Product,
  selectedTagIds: string[],
): boolean {
  if (selectedTagIds.length === 0) return true;
  const selected = new Set(selectedTagIds);
  return (product.tags ?? []).some((id) => selected.has(id));
}

export function generateTagId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `tag-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/tags.test.ts`
Expected: PASS (all 13 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/tags.ts tests/tags.test.ts
git commit -m "feat: add tag palette and helper functions"
```

---

### Task 3: Storage tag functions (TDD)

**Files:**
- Modify: `lib/storage.ts`
- Test: `tests/storage.test.ts`

- [ ] **Step 1: Write the failing tests**

In `tests/storage.test.ts`:
- Add `TagDefinition` to the type imports (line ~8).
- Add `getTagDefinitions, saveTagDefinitions, setProductTags, createTag, renameTag, setTagColor, deleteTag` to the single named-export import block (lines ~28-67).
- Append this `describe` block at the end of the file:

```ts
describe("watchlist tags", () => {
  it("returns empty tag definitions by default", async () => {
    expect(await getTagDefinitions()).toEqual({});
  });

  it("creates a tag and persists it", async () => {
    const tag = await createTag("Backhaul", "#00C896");
    expect(tag.id).toBeTruthy();
    expect(tag.name).toBe("Backhaul");
    expect((await getTagDefinitions())[tag.id]).toEqual(tag);
  });

  it("rejects duplicate tag names case-insensitively", async () => {
    await createTag("Backhaul", "#00C896");
    await expect(createTag("backhaul", "#EF4444")).rejects.toThrow();
  });

  it("renames a tag", async () => {
    const tag = await createTag("Backhaul", "#00C896");
    await renameTag(tag.id, "Core");
    expect((await getTagDefinitions())[tag.id].name).toBe("Core");
  });

  it("rejects renaming to an existing name", async () => {
    const a = await createTag("A", "#00C896");
    await createTag("B", "#EF4444");
    await expect(renameTag(a.id, "b")).rejects.toThrow();
  });

  it("changes a tag color", async () => {
    const tag = await createTag("A", "#00C896");
    await setTagColor(tag.id, "#EF4444");
    expect((await getTagDefinitions())[tag.id].color).toBe("#EF4444");
  });

  it("deletes a tag and strips it from products", async () => {
    const tag = await createTag("A", "#00C896");
    await addToWatchlist(makeProduct("p1", []));
    await setProductTags("p1", [tag.id]);
    await deleteTag(tag.id);
    expect(await getTagDefinitions()).toEqual({});
    expect((await getWatchlist())[0].tags ?? []).toEqual([]);
  });

  it("saveTagDefinitions does not clobber other settings", async () => {
    await saveSettings({ ...(await getSettings()), displayCurrency: "EUR" });
    await saveTagDefinitions({ a: { id: "a", name: "A", color: "#00C896" } });
    expect((await getSettings()).displayCurrency).toBe("EUR");
  });

  it("setProductTags updates a product's tags", async () => {
    await addToWatchlist(makeProduct("p1", []));
    await setProductTags("p1", ["a", "b"]);
    expect((await getWatchlist())[0].tags).toEqual(["a", "b"]);
    await setProductTags("p1", []);
    expect((await getWatchlist())[0].tags ?? []).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/storage.test.ts`
Expected: FAIL — `getTagDefinitions` etc. are not exported.

- [ ] **Step 3: Write the implementation**

In `lib/storage.ts`:

Add to the imports (line ~11, after the `DigestSnapshot` import):

```ts
import { generateTagId } from "./tags";
import type { TagDefinition } from "./types";
```

Add a new section after the `Settings` section (after the `saveSettings` function, ~line 245):

```ts
  // ─── Tags ──────────────────────────────────────────────────────────────────

  async function getTagDefinitions(): Promise<Record<string, TagDefinition>> {
    const settings = await getSettings();
    return settings.tagDefinitions ?? {};
  }

  async function saveTagDefinitions(
    defs: Record<string, TagDefinition>,
  ): Promise<void> {
    const settings = await getSettings();
    await saveSettings({ ...settings, tagDefinitions: defs });
  }

  async function setProductTags(
    productId: string,
    tags: string[],
  ): Promise<void> {
    await enqueue(KEYS.WATCHLIST, async () => {
      const list = await getWatchlist();
      const updated = list.map((p) =>
        p.id === productId ? { ...p, tags } : p,
      );
      await saveWatchlist(updated);
      notify("watchlist", productId);
    });
  }

  async function createTag(
    name: string,
    color: string,
  ): Promise<TagDefinition> {
    const trimmed = name.trim();
    const defs = await getTagDefinitions();
    const duplicate = Object.values(defs).some(
      (d) => d.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (duplicate) throw new Error("A tag with that name already exists");
    const tag: TagDefinition = { id: generateTagId(), name: trimmed, color };
    await saveTagDefinitions({ ...defs, [tag.id]: tag });
    return tag;
  }

  async function renameTag(id: string, name: string): Promise<void> {
    const trimmed = name.trim();
    const defs = await getTagDefinitions();
    const existing = defs[id];
    if (!existing) return;
    const duplicate = Object.values(defs).some(
      (d) => d.id !== id && d.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (duplicate) throw new Error("A tag with that name already exists");
    await saveTagDefinitions({ ...defs, [id]: { ...existing, name: trimmed } });
  }

  async function setTagColor(id: string, color: string): Promise<void> {
    const defs = await getTagDefinitions();
    const existing = defs[id];
    if (!existing) return;
    await saveTagDefinitions({ ...defs, [id]: { ...existing, color } });
  }

  async function deleteTag(id: string): Promise<void> {
    const defs = await getTagDefinitions();
    if (!defs[id]) return;
    const rest: Record<string, TagDefinition> = {};
    for (const [key, value] of Object.entries(defs)) {
      if (key !== id) rest[key] = value;
    }
    await saveTagDefinitions(rest);
    await enqueue(KEYS.WATCHLIST, async () => {
      const list = await getWatchlist();
      const updated = list.map((p) =>
        p.tags?.includes(id)
          ? { ...p, tags: (p.tags ?? []).filter((t) => t !== id) }
          : p,
      );
      await saveWatchlist(updated);
      for (const p of updated) notify("watchlist", p.id);
    });
  }
```

Add the seven functions to the `createStorage` return object (after `saveSettings`, ~line 601):

```ts
    getTagDefinitions,
    saveTagDefinitions,
    setProductTags,
    createTag,
    renameTag,
    setTagColor,
    deleteTag,
```

Add the seven functions to the named destructure (after `saveSettings`, ~line 655):

```ts
  getTagDefinitions,
  saveTagDefinitions,
  setProductTags,
  createTag,
  renameTag,
  setTagColor,
  deleteTag,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/storage.test.ts`
Expected: PASS (all existing + 9 new tag tests).

- [ ] **Step 5: Typecheck + lint**

Run: `pnpm check && pnpm lint`
Expected: 0 errors, lint clean.

- [ ] **Step 6: Commit**

```bash
git add lib/storage.ts tests/storage.test.ts
git commit -m "feat: add tag CRUD and product-tag storage functions"
```

---

### Task 4: Icon mapping

**Files:**
- Modify: `components/ui/icon-symbol.tsx`

- [ ] **Step 1: Add the manage icon mapping**

Add to the `MAPPING` object (after `"square.and.pencil": "edit-note"`):

```ts
  "slider.horizontal.3": "tune",
```

- [ ] **Step 2: Typecheck**

Run: `pnpm check`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/ui/icon-symbol.tsx
git commit -m "feat: add slider.horizontal.3 icon mapping"
```

---

### Task 5: Tag picker sheet component

**Files:**
- Create: `components/tag-picker-sheet.tsx`

- [ ] **Step 1: Write the component**

Create `components/tag-picker-sheet.tsx`:

```tsx
import { useEffect, useState } from "react";
import {
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { createTag, getTagDefinitions, setProductTags } from "@/lib/storage";
import { nextTagColor } from "@/lib/tags";
import { Product, TagDefinition } from "@/lib/types";

interface Props {
  visible: boolean;
  product: Product | null;
  onClose: () => void;
  onChanged: () => void;
}

export function TagPickerSheet({ visible, product, onClose, onChanged }: Props) {
  const colors = useColors();
  const [defs, setDefs] = useState<Record<string, TagDefinition>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !product) return;
    void getTagDefinitions().then(setDefs);
    setSelected(product.tags ?? []);
    setNewTagName("");
    setError(null);
  }, [visible, product]);

  if (!product) return null;

  const toggleTag = async (tagId: string) => {
    const next = selected.includes(tagId)
      ? selected.filter((id) => id !== tagId)
      : [...selected, tagId];
    setSelected(next);
    await setProductTags(product.id, next);
    onChanged();
  };

  const handleCreate = async () => {
    const name = newTagName.trim();
    if (!name) return;
    try {
      const current = await getTagDefinitions();
      const tag = await createTag(name, nextTagColor(current));
      const next = [...selected, tag.id];
      setSelected(next);
      await setProductTags(product.id, next);
      setDefs({ ...current, [tag.id]: tag });
      setNewTagName("");
      setError(null);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create tag");
    }
  };

  const tags = Object.values(defs);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      >
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
            maxHeight: "70%",
          }}
        >
          <Text
            style={{
              color: colors.foreground,
              fontSize: 20,
              fontWeight: "700",
              marginBottom: 4,
            }}
          >
            Tags
          </Text>
          <Text
            style={{ color: colors.muted, fontSize: 14, marginBottom: 16 }}
            numberOfLines={1}
          >
            {product.name}
          </Text>
          <ScrollView style={{ maxHeight: 300 }}>
            {tags.length === 0 && (
              <Text style={{ color: colors.muted, fontSize: 14, marginBottom: 12 }}>
                No tags yet — create one below.
              </Text>
            )}
            {tags.map((tag) => {
              const active = selected.includes(tag.id);
              return (
                <TouchableOpacity
                  key={tag.id}
                  onPress={() => void toggleTag(tag.id)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 10,
                  }}
                >
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 5,
                      borderWidth: 2,
                      borderColor: colors.border,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: active ? colors.primary : colors.surface,
                      marginRight: 10,
                    }}
                  >
                    {active && (
                      <IconSymbol name="checkmark" size={14} color="#fff" />
                    )}
                  </View>
                  <View
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: tag.color,
                      marginRight: 8,
                    }}
                  />
                  <Text style={{ color: colors.foreground, fontSize: 15 }}>
                    {tag.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={{ marginTop: 12 }}>
            <TextInput
              value={newTagName}
              onChangeText={setNewTagName}
              placeholder="New tag name"
              placeholderTextColor={colors.muted}
              maxLength={24}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                paddingHorizontal: 16,
                paddingVertical: 12,
                color: colors.foreground,
                fontSize: 15,
              }}
            />
            {error && (
              <Text style={{ color: colors.error, fontSize: 12, marginTop: 6 }}>
                {error}
              </Text>
            )}
            <TouchableOpacity
              onPress={() => void handleCreate()}
              disabled={!newTagName.trim()}
              style={{
                marginTop: 8,
                backgroundColor: colors.primary,
                borderRadius: 14,
                paddingVertical: 12,
                alignItems: "center",
                opacity: newTagName.trim() ? 1 : 0.5,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "600" }}>
                Create tag
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={{ marginTop: 16, alignItems: "center", paddingVertical: 10 }}
          >
            <Text style={{ color: colors.muted, fontWeight: "600" }}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm check`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/tag-picker-sheet.tsx
git commit -m "feat: add tag picker sheet component"
```

---

### Task 6: Tag manage sheet component

**Files:**
- Create: `components/tag-manage-sheet.tsx`

- [ ] **Step 1: Write the component**

Create `components/tag-manage-sheet.tsx`:

```tsx
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { deleteTag, getTagDefinitions, renameTag, setTagColor } from "@/lib/storage";
import { TAG_PALETTE } from "@/lib/tags";
import { TagDefinition } from "@/lib/types";

interface Props {
  visible: boolean;
  onClose: () => void;
  onChanged: () => void;
}

export function TagManageSheet({ visible, onClose, onChanged }: Props) {
  const colors = useColors();
  const [defs, setDefs] = useState<Record<string, TagDefinition>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    void getTagDefinitions().then(setDefs);
    setEditingId(null);
    setEditName("");
    setError(null);
  }, [visible]);

  const refresh = useCallback(async () => {
    setDefs(await getTagDefinitions());
    onChanged();
  }, [onChanged]);

  const handleRename = async (tag: TagDefinition) => {
    if (!editName.trim()) return;
    try {
      await renameTag(tag.id, editName);
      setEditingId(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not rename tag");
    }
  };

  const handleDelete = (tag: TagDefinition) => {
    Alert.alert(
      "Delete Tag",
      `Delete "${tag.name}"? Products keep their other tags.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void deleteTag(tag.id).then(refresh);
          },
        },
      ],
    );
  };

  const handleRecolor = async (tag: TagDefinition, color: string) => {
    await setTagColor(tag.id, color);
    await refresh();
  };

  const tags = Object.values(defs);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      >
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
          }}
        >
          <Text
            style={{
              color: colors.foreground,
              fontSize: 20,
              fontWeight: "700",
              marginBottom: 16,
            }}
          >
            Manage Tags
          </Text>
          {error && (
            <Text style={{ color: colors.error, fontSize: 12, marginBottom: 8 }}>
              {error}
            </Text>
          )}
          {tags.length === 0 && (
            <Text style={{ color: colors.muted, fontSize: 14, marginBottom: 12 }}>
              No tags yet. Tag a product from the watchlist to create one.
            </Text>
          )}
          {tags.map((tag) => (
            <View key={tag.id} style={{ marginBottom: 16 }}>
              {editingId === tag.id ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <TextInput
                    value={editName}
                    onChangeText={setEditName}
                    autoFocus
                    maxLength={24}
                    style={{
                      flex: 1,
                      backgroundColor: colors.surface,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: colors.border,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      color: colors.foreground,
                      fontSize: 15,
                    }}
                  />
                  <TouchableOpacity
                    onPress={() => void handleRename(tag)}
                    style={{ padding: 8 }}
                  >
                    <IconSymbol name="checkmark" size={18} color={colors.success} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setEditingId(null)}
                    style={{ padding: 8 }}
                  >
                    <IconSymbol name="xmark" size={18} color={colors.muted} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: tag.color,
                      marginRight: 8,
                    }}
                  />
                  <Text style={{ flex: 1, color: colors.foreground, fontSize: 15 }}>
                    {tag.name}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setEditingId(tag.id);
                      setEditName(tag.name);
                    }}
                    style={{ padding: 8 }}
                  >
                    <IconSymbol name="pencil" size={16} color={colors.muted} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(tag)}
                    style={{ padding: 8 }}
                  >
                    <IconSymbol name="trash.fill" size={16} color={colors.error} />
                  </TouchableOpacity>
                </View>
              )}
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 8,
                  marginTop: 8,
                }}
              >
                {TAG_PALETTE.map((color) => (
                  <TouchableOpacity
                    key={color}
                    onPress={() => void handleRecolor(tag, color)}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: color,
                      borderWidth: 2,
                      borderColor:
                        tag.color === color ? colors.foreground : "transparent",
                    }}
                  />
                ))}
              </View>
            </View>
          ))}
          <TouchableOpacity
            onPress={onClose}
            style={{ alignItems: "center", paddingVertical: 10 }}
          >
            <Text style={{ color: colors.muted, fontWeight: "600" }}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm check`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/tag-manage-sheet.tsx
git commit -m "feat: add tag manage sheet component"
```

---

### Task 7: Watchlist screen wiring

**Files:**
- Modify: `app/(tabs)/watchlist.tsx`

- [ ] **Step 1: Update imports**

In `app/(tabs)/watchlist.tsx`:

Change the storage import (line 19):

```tsx
import { getSettings, getTagDefinitions, removeFromWatchlist } from "@/lib/storage";
```

Change the types import (line 21):

```tsx
import { Product, TagDefinition } from "@/lib/types";
```

Add after the `region-filter` import (line 29):

```tsx
import { getTagById, matchesTagFilter } from "@/lib/tags";
import { TagPickerSheet } from "@/components/tag-picker-sheet";
import { TagManageSheet } from "@/components/tag-manage-sheet";
```

- [ ] **Step 2: Update `ProductCard`**

Replace the `ProductCard` function signature (lines 98-106):

```tsx
function ProductCard({
  product,
  onPress,
  onDelete,
  onTagPress,
  tagDefinitions,
}: {
  product: Product;
  onPress: () => void;
  onDelete: () => void;
  onTagPress: () => void;
  tagDefinitions: Record<string, TagDefinition>;
}) {
```

Add the tag chips block right after the closing `</View>` of the top row (after line 212, before the bottom-row `View` that starts at line 213):

```tsx
      {(product.tags?.length ?? 0) > 0 && (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 6,
            marginTop: 10,
          }}
        >
          {(product.tags ?? []).slice(0, 3).map((id) => {
            const tag = getTagById(tagDefinitions, id);
            if (!tag) return null;
            return (
              <View
                key={id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: colors.surface,
                  borderRadius: 10,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 3.5,
                    backgroundColor: tag.color,
                    marginRight: 5,
                  }}
                />
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  {tag.name}
                </Text>
              </View>
            );
          })}
          {(product.tags?.length ?? 0) > 3 && (
            <Text
              style={{
                color: colors.muted,
                fontSize: 11,
                alignSelf: "center",
              }}
            >
              +{(product.tags?.length ?? 0) - 3}
            </Text>
          )}
        </View>
      )}
```

Add the tag button in the bottom row, before the trash button (insert before the `TouchableOpacity` that starts at line 242):

```tsx
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            onTagPress();
          }}
          style={{ padding: 4, marginRight: 4 }}
        >
          <IconSymbol
            name="tag.fill"
            size={16}
            color={(product.tags?.length ?? 0) > 0 ? colors.primary : colors.muted}
          />
        </TouchableOpacity>
```

- [ ] **Step 3: Add screen state and filter logic**

In `WatchlistScreen`, after the `regionFilter` state (line 273), add:

```tsx
  const [tagDefinitions, setTagDefinitions] = useState<
    Record<string, TagDefinition>
  >({});
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [pickerProduct, setPickerProduct] = useState<Product | null>(null);
  const [manageVisible, setManageVisible] = useState(false);
```

In `loadData` (lines 276-279), add the tag definitions load:

```tsx
  const loadData = useCallback(async () => {
    const settings = await getSettings();
    setDisplayCurrency(settings?.displayCurrency ?? "USD");
    setTagDefinitions(await getTagDefinitions());
  }, []);
```

Replace `filteredWatchlist` (lines 288-294):

```tsx
  const filteredWatchlist = useMemo(
    () =>
      watchlist.filter(
        (p) =>
          (regionFilter === "all" || productHasRegion(p, regionFilter)) &&
          matchesTagFilter(p, selectedTagIds),
      ),
    [watchlist, regionFilter, selectedTagIds],
  );
```

Add after the `summary` memo (after line 299):

```tsx
  const toggleTagFilter = useCallback((tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId],
    );
  }, []);
```

- [ ] **Step 4: Add the tag filter bar**

Insert the tag filter chip row between the region-filter `View` (ends at line 665) and the `FlatList` (starts at line 667):

```tsx
      {Object.keys(tagDefinitions).length > 0 && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            marginBottom: 8,
            gap: 8,
          }}
        >
          <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {Object.values(tagDefinitions).map((tag) => {
              const active = selectedTagIds.includes(tag.id);
              return (
                <TouchableOpacity
                  key={tag.id}
                  onPress={() => toggleTagFilter(tag.id)}
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
                    {tag.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity
            onPress={() => setManageVisible(true)}
            style={{ padding: 4 }}
          >
            <IconSymbol name="slider.horizontal.3" size={18} color={colors.muted} />
          </TouchableOpacity>
        </View>
      )}
```

- [ ] **Step 5: Update the empty state**

Replace the `ListEmptyComponent`'s conditional title/body/button logic (lines 682-756) with tag-aware versions. Replace the whole `ListEmptyComponent` block:

```tsx
        ListEmptyComponent={
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingTop: 80,
            }}
          >
            <IconSymbol name="list.bullet" size={48} color={colors.muted} />
            <Text
              style={{
                color: colors.foreground,
                fontWeight: "600",
                fontSize: 18,
                marginTop: 16,
              }}
            >
              {regionFilter !== "all" || selectedTagIds.length > 0
                ? "No products match your filters"
                : "No products yet"}
            </Text>
            <Text
              style={{
                color: colors.muted,
                fontSize: 14,
                textAlign: "center",
                marginTop: 8,
              }}
            >
              {regionFilter !== "all" || selectedTagIds.length > 0
                ? "Try clearing your filters or adding products"
                : "Add products to track their availability and prices globally"}
            </Text>
            {regionFilter !== "all" || selectedTagIds.length > 0 ? (
              <TouchableOpacity
                style={{
                  backgroundColor: colors.primary,
                  borderRadius: 20,
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  marginTop: 20,
                }}
                onPress={() => {
                  setRegionFilter("all");
                  setSelectedTagIds([]);
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>
                  Clear Filters
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={{
                  backgroundColor: colors.primary,
                  borderRadius: 20,
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  marginTop: 20,
                }}
                onPress={() => {
                  if (Platform.OS !== "web")
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push("/search");
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>
                  Add Product
                </Text>
              </TouchableOpacity>
            )}
          </View>
        }
```

- [ ] **Step 6: Wire the card render and add the sheets**

Replace the `renderItem` (lines 757-763):

```tsx
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            onPress={() => router.push(`/product/${item.id}`)}
            onDelete={() => handleDelete(item.id, item.name)}
            onTagPress={() => setPickerProduct(item)}
            tagDefinitions={tagDefinitions}
          />
        )}
```

Add the two sheets before the closing `</ScreenContainer>` (after the `FlatList`, line 764):

```tsx
      <TagPickerSheet
        visible={!!pickerProduct}
        product={pickerProduct}
        onClose={() => setPickerProduct(null)}
        onChanged={() => {
          void reload();
          void loadData();
        }}
      />
      <TagManageSheet
        visible={manageVisible}
        onClose={() => setManageVisible(false)}
        onChanged={() => {
          void reload();
          void loadData();
        }}
      />
```

- [ ] **Step 7: Typecheck + lint**

Run: `pnpm check && pnpm lint`
Expected: 0 errors, lint clean.

- [ ] **Step 8: Run the full test suite**

Run: `pnpm test`
Expected: all pass (existing 670 + 14 new tags tests + 9 new storage tests).

- [ ] **Step 9: Commit**

```bash
git add "app/(tabs)/watchlist.tsx"
git commit -m "feat: wire tag filter bar, card tags, and sheets into watchlist"
```

---

### Task 8: Docs + final verification

**Files:**
- Modify: `todo.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Update `todo.md`**

Append a new phase at the end of `todo.md`:

```markdown
## Phase 54: Watchlist Tags (v5.2)

- [x] Colored tags (10-color palette) assignable per product via a tag picker sheet on each watchlist card
- [x] Tag definitions stored in AppSettings.tagDefinitions; product tags on Product.tags — both sync via existing watchlist/settings collections (no backend changes)
- [x] Tag filter chip row on the watchlist screen with OR semantics, combined with the region filter
- [x] Sheet-based tag management: rename, recolor, delete (strips id from products)
- [x] lib/tags.ts helpers + storage CRUD with unit tests
```

- [ ] **Step 2: Update `AGENTS.md`**

In the `AsyncStorage Keys` section, no key change is needed (tags ride inside `app_settings` and `watchlist_products`). In the `Conventions` section, add a bullet under the existing bullets:

```markdown
- **Tags:** Watchlist tags are many-per-product colored labels. Definitions live in
  `AppSettings.tagDefinitions` (synced via the `settings` collection); products carry
  `tags?: string[]` of tag ids (synced via `watchlist`). Palette + helpers in
  `lib/tags.ts`; storage CRUD in `lib/storage.ts`. Rendering/filtering must silently
  ignore orphaned tag ids.
```

- [ ] **Step 3: Final verification**

Run: `pnpm check && pnpm lint && pnpm test`
Expected: 0 errors, lint clean, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add todo.md AGENTS.md
git commit -m "docs: Phase 54 watchlist tags (v5.2) in todo.md and AGENTS.md"
```

---

## Self-Review Notes

- **Spec coverage:** data model (Task 1), palette/helpers (Task 2), storage CRUD + delete-strips-ids + no-clobber (Task 3), icon mapping (Task 4), picker sheet with create + duplicate error (Task 5), manage sheet with rename/recolor/delete (Task 6), filter bar OR semantics + card button + chips + empty state + sheets wiring (Task 7), docs (Task 8). Orphaned-id safety covered in `matchesTagFilter`/`tagColor` tests and the card's `if (!tag) return null`.
- **Placeholder scan:** all steps contain complete code and exact commands.
- **Type consistency:** `TagDefinition`, `getTagDefinitions`, `saveTagDefinitions`, `setProductTags`, `createTag`, `renameTag`, `setTagColor`, `deleteTag`, `TAG_PALETTE`, `nextTagColor`, `getTagById`, `tagColor`, `matchesTagFilter`, `generateTagId` are used with identical names across tasks.