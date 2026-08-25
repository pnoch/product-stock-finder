# Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** First-launch 3-slide intro gated before the app renders; completion persists via the legacy `has_seen_onboarding` key.

**Architecture:** Injectable module + full-screen pager component + early-return gate in `_layout.tsx` (no routing).

**Tech Stack:** React Native, TypeScript strict, vitest.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `lib/onboarding.ts` | has/set flag with injectable store |
| `tests/onboarding.test.ts` | module tests |
| `components/onboarding/onboarding-screen.tsx` | 3-slide pager |
| `app/_layout.tsx` | gate |

---

## Task 1: Module (TDD) + screen + gate

**Files:** all of the above + todo.md

- [ ] **Step 1: Write failing test `tests/onboarding.test.ts`**

```typescript
import { describe, expect, it } from "vitest";
import {
  hasSeenOnboarding,
  setOnboardingSeen,
  type KeyValueStore,
} from "../lib/onboarding";

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
  };
}

describe("onboarding", () => {
  it("defaults to not seen", async () => {
    expect(await hasSeenOnboarding(memoryStore())).toBe(false);
  });

  it("persists completion", async () => {
    const store = memoryStore();
    await setOnboardingSeen(store);
    expect(await hasSeenOnboarding(store)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/onboarding.test.ts` — FAIL (module not found).

- [ ] **Step 3: Create `lib/onboarding.ts`**

```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "has_seen_onboarding";

export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export async function hasSeenOnboarding(
  store: KeyValueStore = AsyncStorage,
): Promise<boolean> {
  try {
    return (await store.getItem(KEY)) === "true";
  } catch {
    return false;
  }
}

export async function setOnboardingSeen(
  store: KeyValueStore = AsyncStorage,
): Promise<void> {
  try {
    await store.setItem(KEY, "true");
  } catch {
    // Best-effort persistence.
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/onboarding.test.ts` — PASS.

- [ ] **Step 5: Create `components/onboarding/onboarding-screen.tsx`**

Horizontal paging FlatList of slides; dots; Skip top-right; Next/Get Started button. Slide data:

```typescript
import { useRef, useState } from "react";
import {
  FlatList,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { setOnboardingSeen } from "@/lib/onboarding";

const SLIDES = [
  {
    emoji: "🛒",
    title: "Track Prices Everywhere",
    body: "Monitor products across 25 global distributors in one watchlist.",
  },
  {
    emoji: "✨",
    title: "Add Anything",
    body: "Search the catalog, paste a list of model numbers, or add any product manually with AI.",
  },
  {
    emoji: "🔔",
    title: "Never Miss a Drop",
    body: "Price alerts, restock watches, and weekly digests keep you ahead.",
  },
];

export function OnboardingScreen({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const colors = useColors();
  const listRef = useRef<FlatList>(null);
  const [index, setIndex] = useState(0);

  const finish = async () => {
    await setOnboardingSeen();
    if (Platform.OS !== "web")
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onComplete();
  };

  const goNext = () => {
    if (index < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: index + 1, animated: true });
    } else {
      void finish();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TouchableOpacity
        onPress={() => void finish()}
        style={{ position: "absolute", top: 52, right: 20, zIndex: 1, padding: 8 }}
      >
        <Text style={{ color: colors.muted, fontSize: 14 }}>Skip</Text>
      </TouchableOpacity>

      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) =>
          setIndex(Math.round(e.nativeEvent.contentOffset.x / 360))
        }
        renderItem={({ item }) => (
          <View
            style={{
              width: 360,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 40,
            }}
          >
            <Text style={{ fontSize: 72 }}>{item.emoji}</Text>
            <Text
              style={{
                color: colors.foreground,
                fontSize: 24,
                fontWeight: "700",
                textAlign: "center",
                marginTop: 20,
              }}
            >
              {item.title}
            </Text>
            <Text
              style={{
                color: colors.muted,
                fontSize: 15,
                textAlign: "center",
                marginTop: 12,
                lineHeight: 22,
              }}
            >
              {item.body}
            </Text>
          </View>
        )}
        keyExtractor={(_, i) => String(i)}
      />

      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          gap: 8,
          marginBottom: 24,
        }}
      >
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={{
              width: i === index ? 22 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: i === index ? colors.primary : colors.border,
            }}
          />
        ))}
      </View>

      <TouchableOpacity
        onPress={goNext}
        style={{
          marginHorizontal: 32,
          marginBottom: 48,
          paddingVertical: 15,
          borderRadius: 14,
          backgroundColor: colors.primary,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>
          {index === SLIDES.length - 1 ? "Get Started" : "Next"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
```

Note: FlatList slide width is hard-coded 360 — acceptable for v1 (matches other fixed-width surfaces); adjust with Dimensions if desired.

- [ ] **Step 6: Gate in `app/_layout.tsx`**

1. Imports: `hasSeenOnboarding`, `setOnboardingSeen`, `OnboardingScreen`.
2. After existing hooks (before the early web/desktop returns), add:

```typescript
  const [onboardingState, setOnboardingState] = useState<
    "checking" | "app" | "intro"
  >("checking");
  useEffect(() => {
    void hasSeenOnboarding().then((seen) =>
      setOnboardingState(seen ? "app" : "intro"),
    );
  }, []);
```

3. Immediately after those hooks:

```typescript
  if (onboardingState === "checking") {
    return (
      <ThemeProvider>
        <View style={{ flex: 1, backgroundColor: "#F8FAFC" }} />
      </ThemeProvider>
    );
  }
  if (onboardingState === "intro") {
    return (
      <ThemeProvider>
        <OnboardingScreen
          onComplete={() => {
            setOnboardingState("app");
            void setOnboardingSeen();
          }}
        />
      </ThemeProvider>
    );
  }
```

CRITICAL: all hooks must already be declared above this point — verify the gate sits AFTER every hook in the component and BEFORE both return variants (`shouldOverrideSafeArea` branch). If the two return variants have different provider stacks, keep the gate's providers minimal as shown (theme only — onboarding needs colors? It uses useColors → requires ThemeProvider).

Also call `setOnboardingSeen()` inside finish (component does it) AND in the gate's onComplete for belt-and-braces — pick one: component already persists; gate's onComplete just flips state. Simplify: gate onComplete = `() => setOnboardingState("app")`.

- [ ] **Step 7: Verify**

Run: `pnpm check` — 0 errors. Run: `pnpm lint` — no new errors. Run: `pnpm test` — all pass.

- [ ] **Step 8: Update `todo.md` + commit + push**

Append Phase 103 section:

```markdown
## Phase 103: Onboarding (v6.3)

- [x] Add onboarding flag module with injectable storage + tests
- [x] Add 3-slide intro pager (Welcome / Add Anything / Alerts)
- [x] Gate first launch in root layout
```

Then:

```bash
git add lib/onboarding.ts tests/onboarding.test.ts components/onboarding app/_layout.tsx todo.md && git commit -m "feat: add first-run onboarding"
git push origin main
```

---

## Summary

| Metric | Value |
|--------|-------|
| New module | `lib/onboarding.ts` (~30 lines) |
| New tests | 2 cases |
| New component | `onboarding-screen.tsx` (~160 lines) |
