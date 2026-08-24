# Recent Searches Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remember recent search queries (submit via return key) and show them as tappable chips when the query is empty.

**Architecture:** Standalone injectable module (`lib/recent-searches.ts`, device-local, not synced) + a chips row component + `onSearchSubmit` prop on the existing search bar.

**Tech Stack:** AsyncStorage, React Native, TypeScript strict, vitest.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `lib/recent-searches.ts` | get/record/clear with injectable store |
| `tests/recent-searches.test.ts` | Module tests (in-memory store) |
| `components/search/recent-searches.tsx` | Chips row |
| `components/search/catalog-search-bar.tsx` | +`onSearchSubmit` prop |
| `app/search.tsx` | State + wiring |

---

## Task 1: Module (TDD) + UI wiring

**Files:**
- Create: `lib/recent-searches.ts`
- Test: `tests/recent-searches.test.ts`
- Create: `components/search/recent-searches.tsx`
- Modify: `components/search/catalog-search-bar.tsx`
- Modify: `app/search.tsx`
- Modify: `todo.md`

- [ ] **Step 1: Write failing test `tests/recent-searches.test.ts`**

```typescript
import { describe, expect, it } from "vitest";
import {
  clearRecentSearches,
  getRecentSearches,
  recordSearch,
  type KeyValueStore,
} from "../lib/recent-searches";

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

describe("recent searches", () => {
  it("records queries most-recent-first", async () => {
    const store = memoryStore();
    await recordSearch("crs326", store);
    await recordSearch("hAP ax2", store);
    expect(await getRecentSearches(store)).toEqual(["hAP ax2", "crs326"]);
  });

  it("dedupes case-insensitively and moves to front", async () => {
    const store = memoryStore();
    await recordSearch("CRS326", store);
    await recordSearch("hap", store);
    await recordSearch("crs326 ", store);
    expect(await getRecentSearches(store)).toEqual(["crs326", "hap"]);
  });

  it("caps at 8 entries", async () => {
    const store = memoryStore();
    for (let i = 0; i < 10; i++) await recordSearch(`q${i}`, store);
    const list = await getRecentSearches(store);
    expect(list).toHaveLength(8);
    expect(list[0]).toBe("q9");
  });

  it("ignores empty queries", async () => {
    const store = memoryStore();
    await recordSearch("   ", store);
    expect(await getRecentSearches(store)).toEqual([]);
  });

  it("clears all entries", async () => {
    const store = memoryStore();
    await recordSearch("crs326", store);
    await clearRecentSearches(store);
    expect(await getRecentSearches(store)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/recent-searches.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Create `lib/recent-searches.ts`**

```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "recent_searches";
const MAX_ENTRIES = 8;

export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export async function getRecentSearches(
  store: KeyValueStore = AsyncStorage,
): Promise<string[]> {
  try {
    const raw = await store.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export async function recordSearch(
  query: string,
  store: KeyValueStore = AsyncStorage,
): Promise<string[]> {
  const trimmed = query.trim();
  if (!trimmed) return getRecentSearches(store);
  const list = await getRecentSearches(store);
  const filtered = list.filter(
    (q) => q.toLowerCase() !== trimmed.toLowerCase(),
  );
  const updated = [trimmed, ...filtered].slice(0, MAX_ENTRIES);
  try {
    await store.setItem(KEY, JSON.stringify(updated));
  } catch {
    // Best-effort persistence.
  }
  return updated;
}

export async function clearRecentSearches(
  store: KeyValueStore = AsyncStorage,
): Promise<void> {
  try {
    await store.removeItem(KEY);
  } catch {
    // Best-effort persistence.
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/recent-searches.test.ts` — PASS.

- [ ] **Step 5: Create `components/search/recent-searches.tsx`**

```typescript
import { Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

export function RecentSearches({
  searches,
  onSelect,
  onClear,
}: {
  searches: string[];
  onSelect: (query: string) => void;
  onClear: () => void;
}) {
  const colors = useColors();
  if (searches.length === 0) return null;

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginBottom: 12,
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingTop: 7 }}>
        <IconSymbol name="clock.arrow.circlepath" size={14} color={colors.muted} />
        <Text style={{ color: colors.muted, fontSize: 12 }}>Recent</Text>
        <TouchableOpacity onPress={onClear} hitSlop={8}>
          <Text style={{ color: colors.muted, fontSize: 11, textDecorationLine: "underline" }}>
            Clear
          </Text>
        </TouchableOpacity>
      </View>
      <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {searches.map((s) => (
          <TouchableOpacity
            key={s}
            onPress={() => onSelect(s)}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 12,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.foreground, fontSize: 12 }} numberOfLines={1}>
              {s}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
```

ICON CHECK: verify `clock.arrow.circlepath` has an Android/web mapping in `components/ui/icon-symbol.tsx`; add one (e.g. `"clock.arrow.circlepath": "history"`) or reuse a mapped icon like `arrow.clockwise`.

- [ ] **Step 6: Add `onSearchSubmit` to `components/search/catalog-search-bar.tsx`**

Extend props with `onSearchSubmit?: (query: string) => void` and add to the TextInput:

```tsx
        onSubmitEditing={() => onSearchSubmit?.(query.trim())}
```

- [ ] **Step 7: Wire into `app/search.tsx`**

1. Imports:

```typescript
import { RecentSearches } from "@/components/search/recent-searches";
import {
  clearRecentSearches,
  getRecentSearches,
  recordSearch,
} from "@/lib/recent-searches";
```

2. State + load effect (near other state):

```typescript
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    void getRecentSearches().then(setRecentSearches);
  }, []);
```

(ensure `useEffect` is imported)

3. Handler:

```typescript
  const handleSearchSubmit = useCallback(async () => {
    if (!query.trim()) return;
    setRecentSearches(await recordSearch(query));
  }, [query]);

  const handleClearRecent = useCallback(async () => {
    await clearRecentSearches();
    setRecentSearches([]);
  }, []);
```

4. Pass to `<CatalogSearchBar …>`: `onSearchSubmit={handleSearchSubmit}`.
5. Render below the search bar, above results — only when `query.length === 0`:

```tsx
      {query.length === 0 && (
        <RecentSearches
          searches={recentSearches}
          onSelect={(q) => setQuery(q)}
          onClear={handleClearRecent}
        />
      )}
```

(Place it right after `<CatalogSearchBar … />`; adjust against the actual JSX structure.)

- [ ] **Step 8: Verify**

Run: `pnpm check` — 0 errors. Run: `pnpm lint` — no new errors. Run: `pnpm test` — all pass.

- [ ] **Step 9: Update `todo.md` + commit + push**

Append Phase 89 section:

```markdown
## Phase 89: Recent Searches (v5.37)

- [x] Add recent-searches module with injectable storage + tests
- [x] Add recent chips row under the search bar
- [x] Record queries on submit; tap chip to re-run; clear-all action
```

Then:

```bash
git add lib/recent-searches.ts tests/recent-searches.test.ts components/search/recent-searches.tsx components/search/catalog-search-bar.tsx app/search.tsx todo.md && git commit -m "feat: remember recent searches on search screen"
git push origin main
```

---

## Summary

| Metric | Value |
|--------|-------|
| New module | `lib/recent-searches.ts` (~60 lines) |
| New tests | 5 cases |
| New component | `recent-searches.tsx` (~60 lines) |
| Modified | catalog-search-bar, search screen |
