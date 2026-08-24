# Product Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Private per-product notes, editable in a card on the product detail screen.

**Architecture:** Standalone injectable module (`lib/product-notes.ts`, key `product_notes`, map shape) + self-contained `NotesCard` that loads/saves via the module and renders on product detail.

**Tech Stack:** AsyncStorage, React Native, TypeScript strict, vitest.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `lib/product-notes.ts` | get/save with injectable store |
| `tests/product-notes.test.ts` | Module tests (in-memory store) |
| `components/product/notes-card.tsx` | View/edit card |
| `app/product/[id].tsx` | Render card |

---

## Task 1: Module (TDD) + card + wiring

**Files:**
- Create: `lib/product-notes.ts`
- Test: `tests/product-notes.test.ts`
- Create: `components/product/notes-card.tsx`
- Modify: `app/product/[id].tsx`
- Modify: `todo.md`

- [ ] **Step 1: Write failing test `tests/product-notes.test.ts`**

```typescript
import { describe, expect, it } from "vitest";
import {
  getProductNote,
  saveProductNote,
  type KeyValueStore,
} from "../lib/product-notes";

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & {
  data: Map<string, string>;
} {
  const data = new Map(Object.entries(initial));
  return {
    data,
    async getItem(key) {
      return data.get(key) ?? null;
    },
    async setItem(key, value) {
      data.set(key, value);
    },
    async removeItem(key) {
      data.delete(key);
    },
  };
}

describe("product notes", () => {
  it("returns empty string when no note exists", async () => {
    const store = memoryStore();
    expect(await getProductNote("p1", store)).toBe("");
  });

  it("saves and round-trips a note", async () => {
    const store = memoryStore();
    await saveProductNote("p1", "Wait for restock at MikroTik Store", store);
    expect(await getProductNote("p1", store)).toBe(
      "Wait for restock at MikroTik Store",
    );
  });

  it("trims whitespace on save", async () => {
    const store = memoryStore();
    await saveProductNote("p1", "  note  ", store);
    expect(await getProductNote("p1", store)).toBe("note");
  });

  it("removes the entry when saving an empty note", async () => {
    const store = memoryStore();
    await saveProductNote("p1", "note", store);
    await saveProductNote("p1", "   ", store);
    const raw = JSON.parse(store.data.get("product_notes")!);
    expect(raw.p1).toBeUndefined();
    expect(await getProductNote("p1", store)).toBe("");
  });

  it("keeps other products' notes intact", async () => {
    const store = memoryStore();
    await saveProductNote("p1", "one", store);
    await saveProductNote("p2", "two", store);
    expect(await getProductNote("p1", store)).toBe("one");
    expect(await getProductNote("p2", store)).toBe("two");
  });

  it("tolerates corrupt stored JSON", async () => {
    const store = memoryStore({ product_notes: "{not json" });
    expect(await getProductNote("p1", store)).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/product-notes.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Create `lib/product-notes.ts`**

```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "product_notes";

export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

async function readAll(store: KeyValueStore): Promise<Record<string, string>> {
  try {
    const raw = await store.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, string>)
      : {};
  } catch {
    return {};
  }
}

export async function getProductNote(
  productId: string,
  store: KeyValueStore = AsyncStorage,
): Promise<string> {
  const all = await readAll(store);
  return all[productId] ?? "";
}

export async function saveProductNote(
  productId: string,
  note: string,
  store: KeyValueStore = AsyncStorage,
): Promise<void> {
  const all = await readAll(store);
  const trimmed = note.trim();
  if (!trimmed) delete all[productId];
  else all[productId] = trimmed;
  try {
    await store.setItem(KEY, JSON.stringify(all));
  } catch {
    // Best-effort persistence.
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/product-notes.test.ts` — PASS.

- [ ] **Step 5: Create `components/product/notes-card.tsx`**

```typescript
import { useEffect, useState } from "react";
import {
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getProductNote, saveProductNote } from "@/lib/product-notes";

export function NotesCard({ productId }: { productId: string }) {
  const colors = useColors();
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    void getProductNote(productId).then(setNote);
  }, [productId]);

  const startEditing = () => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDraft(note);
    setEditing(true);
  };

  const handleSave = async () => {
    await saveProductNote(productId, draft);
    setNote(draft.trim());
    setEditing(false);
    if (Platform.OS !== "web")
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginBottom: 16,
        backgroundColor: colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 16,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: editing ? 10 : 0,
        }}
      >
        <Text style={{ color: colors.muted, fontSize: 13 }}>My Note</Text>
        {!editing && (
          <TouchableOpacity onPress={startEditing} hitSlop={8}>
            <IconSymbol name="pencil" size={16} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {editing ? (
        <>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            multiline
            autoFocus
            maxLength={500}
            placeholder="Private note (only visible on this device)…"
            placeholderTextColor={colors.muted}
            style={{
              backgroundColor: colors.background,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 12,
              color: colors.foreground,
              fontSize: 14,
              minHeight: 80,
              textAlignVertical: "top",
              marginBottom: 10,
            }}
          />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity
              onPress={() => setEditing(false)}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 12,
                alignItems: "center",
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.muted, fontWeight: "600" }}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 12,
                alignItems: "center",
                backgroundColor: colors.primary,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "600" }}>Save</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <TouchableOpacity onPress={startEditing}>
          {note ? (
            <Text style={{ color: colors.foreground, fontSize: 14, lineHeight: 20 }}>
              {note}
            </Text>
          ) : (
            <Text style={{ color: colors.muted, fontSize: 14 }}>
              Add a private note…
            </Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}
```

ICON CHECK: verify `pencil` has an Android/web mapping in `components/ui/icon-symbol.tsx`; add one (e.g. `"pencil": "edit"`) if missing.

- [ ] **Step 6: Render in `app/product/[id].tsx`**

Inside the ScrollView, directly after `<ProductInfoCard … />` add:

```tsx
        <NotesCard productId={id} />
```

with import `import { NotesCard } from "@/components/product/notes-card";`.

- [ ] **Step 7: Verify**

Run: `pnpm check` — 0 errors. Run: `pnpm lint` — no new errors. Run: `pnpm test` — all pass.

- [ ] **Step 8: Update `todo.md` + commit + push**

Append Phase 90 section:

```markdown
## Phase 90: Product Notes (v5.38)

- [x] Add product-notes module with injectable storage + tests
- [x] Add editable Notes card on product detail
```

Then:

```bash
git add lib/product-notes.ts tests/product-notes.test.ts components/product/notes-card.tsx app/product/\[id\].tsx todo.md && git commit -m "feat: add private product notes"
git push origin main
```

---

## Summary

| Metric | Value |
|--------|-------|
| New module | `lib/product-notes.ts` (~55 lines) |
| New tests | 6 cases |
| New component | `notes-card.tsx` (~150 lines) |
| Modified | product detail screen |
