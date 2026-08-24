# Bulk Watchlist Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Paste a list of model numbers on the Search screen, preview matches against the catalog, and import all new products into the watchlist in one action.

**Architecture:** Pure parsing/matching module (`lib/bulk-import.ts`, TDD) + a bottom-sheet modal (`components/search/bulk-import-modal.tsx`) opened from a header button on `app/search.tsx`. Imports go through existing `addToWatchlist` so sync notifications fire.

**Tech Stack:** Expo Router, React Native, TypeScript strict, vitest.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `lib/bulk-import.ts` | `parseModelInput`, `matchModels` (pure) |
| `tests/bulk-import.test.ts` | Parsing/matching unit tests |
| `components/search/bulk-import-modal.tsx` | Paste sheet + live preview + import |
| `app/search.tsx` | Header button + modal wiring |

---

## Task 1: Parse + match module (TDD)

**Files:**
- Create: `lib/bulk-import.ts`
- Test: `tests/bulk-import.test.ts`

- [ ] **Step 1: Write failing test `tests/bulk-import.test.ts`**

```typescript
import { describe, expect, it } from "vitest";
import { matchModels, parseModelInput } from "../lib/bulk-import";
import { PRODUCT_CATALOG } from "../lib/catalog";

describe("parseModelInput", () => {
  it("splits on newlines, commas, semicolons, and tabs", () => {
    expect(parseModelInput("A\nB,C;D\tE")).toEqual(["A", "B", "C", "D", "E"]);
  });

  it("trims whitespace and drops empties", () => {
    expect(parseModelInput("  A \n\n B \t , , C ")).toEqual(["A", "B", "C"]);
  });

  it("strips one layer of wrapping quotes", () => {
    expect(parseModelInput('"CRS804" \'CCR2216\'')).toEqual([
      "CRS804",
      "CCR2216",
    ]);
  });

  it("dedupes case-insensitively keeping first occurrence", () => {
    expect(parseModelInput("crs804 CRS804 Crs804 other")).toEqual([
      "crs804",
      "other",
    ]);
  });

  it("returns empty array for whitespace-only input", () => {
    expect(parseModelInput("   \n\t  ")).toEqual([]);
  });
});

describe("matchModels", () => {
  it("matches model numbers case-insensitively preserving input order", () => {
    const { matched, unmatched } = matchModels(
      ["crs518-16xs-2xq", "NOPE-123"],
      PRODUCT_CATALOG,
    );
    expect(matched).toHaveLength(1);
    expect(matched[0].modelNumber).toBe("CRS518-16XS-2XQ");
    expect(unmatched).toEqual(["NOPE-123"]);
  });

  it("does not substring-match", () => {
    const { matched } = matchModels(["CRS804"], PRODUCT_CATALOG);
    // Catalog contains "CRS804-4DDQ-hRM" — plain "CRS804" must NOT match.
    expect(matched).toHaveLength(0);
  });

  it("dedupes duplicate matches", () => {
    const real = PRODUCT_CATALOG[0].modelNumber;
    const { matched } = matchModels(
      [real, real.toLowerCase()],
      PRODUCT_CATALOG,
    );
    expect(matched).toHaveLength(1);
  });
});
```

Note: if `PRODUCT_CATALOG[0].modelNumber` differs from `"CRS804-4DDQ-hRM"` adjust assertion 1 accordingly (check `lib/catalog.ts`).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/bulk-import.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Create `lib/bulk-import.ts`**

```typescript
import { PRODUCT_CATALOG } from "./catalog";

export type CatalogProduct = (typeof PRODUCT_CATALOG)[0];

// Splits pasted input on newlines/commas/semicolons/tabs, trims whitespace,
// strips one layer of wrapping quotes, drops empties, dedupes case-insensitively.
export function parseModelInput(text: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of text.split(/[\n,;\t]/)) {
    let entry = raw.trim();
    if (
      (entry.startsWith('"') && entry.endsWith('"') && entry.length >= 2) ||
      (entry.startsWith("'") && entry.endsWith("'") && entry.length >= 2)
    ) {
      entry = entry.slice(1, -1);
    }
    entry = entry.trim();
    if (!entry) continue;
    const key = entry.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(entry);
  }
  return result;
}

export interface MatchResult {
  matched: CatalogProduct[];
  unmatched: string[];
}

// Case-insensitive exact modelNumber equality — no substring matching.
export function matchModels(
  models: string[],
  catalog: CatalogProduct[] = PRODUCT_CATALOG,
): MatchResult {
  const byModel = new Map(
    catalog.map((p) => [p.modelNumber.toLowerCase(), p] as const),
  );
  const matched: CatalogProduct[] = [];
  const matchedKeys = new Set<string>();
  const unmatched: string[] = [];
  for (const model of models) {
    const hit = byModel.get(model.toLowerCase());
    if (hit) {
      const key = hit.id;
      if (!matchedKeys.has(key)) {
        matchedKeys.add(key);
        matched.push(hit);
      }
    } else {
      unmatched.push(model);
    }
  }
  return { matched, unmatched };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/bulk-import.test.ts` — PASS.
Run: `pnpm check` — 0 errors. Run: `pnpm test` — all pass.

- [ ] **Step 5: Commit**

```bash
git add lib/bulk-import.ts tests/bulk-import.test.ts && git commit -m "feat: add bulk import parse/match module"
```

---

## Task 2: Modal + search screen wiring + push

**Files:**
- Create: `components/search/bulk-import-modal.tsx`
- Modify: `app/search.tsx`
- Modify: `todo.md`

- [ ] **Step 1: Create `components/search/bulk-import-modal.tsx`**

Follow the bottom-sheet conventions used by `components/tag-picker-sheet.tsx` (RN `Modal`, transparent backdrop, rounded top sheet):

```typescript
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { showAlert } from "@/lib/alert";
import { addToWatchlist } from "@/lib/storage";
import { matchModels, parseModelInput } from "@/lib/bulk-import";

const PREVIEW_LIMIT = 5;

export function BulkImportModal({
  visible,
  onClose,
  trackedIds,
  onImported,
}: {
  visible: boolean;
  onClose: () => void;
  trackedIds: Set<string>;
  onImported?: () => void;
}) {
  const colors = useColors();
  const [text, setText] = useState("");
  const [importing, setImporting] = useState(false);

  const preview = useMemo(() => matchModels(parseModelInput(text)), [text]);
  const newProducts = preview.matched.filter((p) => !trackedIds.has(p.id));
  const alreadyTracked = preview.matched.length - newProducts.length;
  const canImport = !importing && newProducts.length > 0;

  const handleImport = async () => {
    if (!canImport) return;
    if (Platform.OS !== "web")
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setImporting(true);
    try {
      for (const product of newProducts) {
        await addToWatchlist(product);
      }
      const unmatchedNote =
        preview.unmatched.length > 0
          ? `\n${preview.unmatched.length} not found in catalog.`
          : "";
      showAlert(
        "Import Complete",
        `${newProducts.length} added · ${alreadyTracked} already tracked.${unmatchedNote}`,
      );
      setText("");
      onImported?.();
      onClose();
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}>
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
            <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "700", flex: 1 }}>
              Import List 📋
            </Text>
            <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
              <IconSymbol name="xmark.circle.fill" size={24} color={colors.muted} />
            </TouchableOpacity>
          </View>
          <Text style={{ color: colors.muted, fontSize: 14, marginBottom: 12 }}>
            Paste model numbers — one per line, or separated by commas.
          </Text>
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            autoFocus
            numberOfLines={6}
            placeholder={"CRS804-4DDQ-hRM\nCCR2216-1G-12XS-2XQ"}
            placeholderTextColor={colors.muted}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 14,
              color: colors.foreground,
              fontSize: 14,
              minHeight: 120,
              textAlignVertical: "top",
              marginBottom: 12,
            }}
          />
          {parseModelInput(text).length > 0 && (
            <View style={{ marginBottom: 12 }}>
              <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>
                {preview.matched.length} matched · {preview.unmatched.length} not found
              </Text>
              {preview.unmatched.slice(0, PREVIEW_LIMIT).map((m) => (
                <Text key={m} style={{ color: colors.error, fontSize: 12, marginTop: 2 }}>
                  Not found: {m}
                </Text>
              ))}
              {preview.unmatched.length > PREVIEW_LIMIT && (
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                  +{preview.unmatched.length - PREVIEW_LIMIT} more not found
                </Text>
              )}
              {alreadyTracked > 0 && (
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                  {alreadyTracked} already in watchlist
                </Text>
              )}
            </View>
          )}
          <TouchableOpacity
            onPress={handleImport}
            disabled={!canImport}
            style={{
              backgroundColor: canImport ? colors.primary : colors.border,
              borderRadius: 14,
              paddingVertical: 14,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {importing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <IconSymbol name="plus.circle.fill" size={18} color="#fff" />
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>
                  {newProducts.length > 0
                    ? `Import ${newProducts.length} product${newProducts.length === 1 ? "" : "s"}`
                    : "Nothing to import"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
```

ICON CHECK: verify `plus.circle.fill`, `xmark.circle.fill` are mapped in `components/ui/icon-symbol.tsx` (both likely already used elsewhere); adjust if not.

Note: `addToWatchlist(product)` accepts the catalog product shape — same cast pattern as `handleAdd` in `app/search.tsx` (which passes `(typeof PRODUCT_CATALOG)[0]` directly).

- [ ] **Step 2: Wire into `app/search.tsx`**

1. Add state: `const [bulkVisible, setBulkVisible] = useState(false);`
2. In the header row (after the "Add Product" title Text), add:

```tsx
        <TouchableOpacity
          onPress={() => {
            if (Platform.OS !== "web")
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setBulkVisible(true);
          }}
          style={{ padding: 4 }}
        >
          <IconSymbol
            name="square.and.arrow.down"
            size={22}
            color={colors.primary}
          />
        </TouchableOpacity>
```

(`square.and.arrow.down` was added to the icon mapping in Phase 80 — verify.)

3. Below the existing `<TagPickerSheet …>` usage add:

```tsx
      <BulkImportModal
        visible={bulkVisible}
        onClose={() => setBulkVisible(false)}
        trackedIds={trackedIds}
        onImported={loadData}
      />
```

with import `import { BulkImportModal } from "@/components/search/bulk-import-modal";` (`loadData` comes from the existing `useSearchData()` destructure).

- [ ] **Step 3: Verify**

1. Run `pnpm check` — 0 errors
2. Run `pnpm lint` — no new errors
3. Run `pnpm test` — all pass

- [ ] **Step 4: Update `todo.md`**

Append Phase 81 section:

```markdown
## Phase 81: Bulk Watchlist Import (v5.29)

- [x] Add pure parse/match module (separators, quotes, dedupe, exact matching)
- [x] Unit-test parsing and catalog matching edge cases
- [x] Build paste-sheet modal with live matched/not-found preview
- [x] Wire "Import list" button into Search screen header
```

- [ ] **Step 5: Commit and push**

```bash
git add components/search/bulk-import-modal.tsx app/search.tsx todo.md && git commit -m "feat: add bulk watchlist import to search screen"
git push origin main
```

---

## Summary

| Metric | Value |
|--------|-------|
| New pure module | `lib/bulk-import.ts` (~60 lines) |
| New tests | `tests/bulk-import.test.ts` (~8 cases) |
| New component | `bulk-import-modal.tsx` (~180 lines) |
| Modified | `app/search.tsx` (header button + modal) |
