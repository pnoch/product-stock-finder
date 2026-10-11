# Redesign Plan A — Navigation (Retab + Discover + You + Drops Promotion)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the tab bar to Home · Discover · Watch · Drops · Alerts, add the Discover screen and You stack screen, and promote Drops to a tab without breaking existing routes.

**Architecture:** New `app/(tabs)/discover.tsx` composes existing search/catalog components with Trending + Available sections. New `app/you.tsx` stack screen links to existing Settings/Stats/Rates/Health/Diagnostics routes. Drops gains a tab via a thin re-export wrapper. Rates/Settings stay reachable via `href: null`.

**Tech Stack:** TypeScript, Expo Router 6 (typed routes), NativeWind, React Native.

**Spec:** `docs/superpowers/specs/2026-10-11-android-redesign-design.md` (Sections 1 + 4)

> **Design deviation (spec inconsistency, resolved):** Spec §1 lists tabs as Discover·Watch·Drops·Alerts·You (5, no Home) while §3 describes a Home screen, and §1's own rationale says every tab must be daily-use (Settings/Stats are not). Resolution: tabs = **Home · Discover · Watch · Drops · Alerts**; **You is a stack screen** reached via the Home gear shortcut. This preserves Home, keeps 5 tabs, and honors the daily-use rule.

**Follow-up plans (not this plan):** B = concierge onboarding, C = Home priority feed, D = Watch refresh + visual pass.

---

## File Structure

| File | Purpose |
|------|---------|
| Modify `app/(tabs)/_layout.tsx` | 5-tab retab (add discover + drops, hide rates + settings) |
| Create `app/(tabs)/discover.tsx` | Discover tab screen |
| Create `app/(tabs)/drops.tsx` | Thin re-export of Drops screen for the tab |
| Create `app/you.tsx` | You stack screen (profile + links) |
| Modify `app/(tabs)/index.tsx` | Gear shortcut → `/you` |
| Modify `app/drops.tsx` | Extract screen body to shared component (only if needed) |
| Create `tests/redesign-nav-guard.test.ts` | Wiring guards |

---

### Task 1: Retab the tab layout

**Files:**
- Modify: `app/(tabs)/_layout.tsx`

- [ ] **Step 1: Rewrite the Tabs screens**

Replace the file content with:

```tsx
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { useAlertBadge } from "@/hooks/use-alert-badge";

export default function TabLayout() {
  const colors = useColors();
  const alertBadgeCount = useAlertBadge();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 56 + bottomPadding;

  const screenOptions = {
    tabBarActiveTintColor: colors.tint,
    headerShown: false,
    tabBarButton: HapticTab,
    tabBarStyle: {
      paddingTop: 8,
      paddingBottom: bottomPadding,
      height: tabBarHeight,
      backgroundColor: colors.background,
      borderTopColor: colors.border,
      borderTopWidth: 0.5,
    },
  } as const;

  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="house.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: "Discover",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="magnifyingglass" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="watchlist"
        options={{
          title: "Watch",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="list.bullet" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="drops"
        options={{
          title: "Drops",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="chart.line.downtrend.xyaxis" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: "Alerts",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="bell.fill" color={color} />
          ),
          tabBarBadge: alertBadgeCount > 0 ? alertBadgeCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.error,
            color: "#fff",
            fontSize: 11,
          },
        }}
      />
      <Tabs.Screen
        name="rates"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
```

Verify icon names exist: read `components/ui/icon-symbol.tsx` and confirm `magnifyingglass` and `chart.line.downtrend.xyaxis` are mapped (the latter was used in `app/drops.tsx` empty state per the leaderboard report — confirm; fall back to `tag.fill` / `arrow.down.right` alternatives only if missing, and note the swap).

- [ ] **Step 2: Create placeholder `app/(tabs)/discover.tsx` (unblocks the tab)**

Temporary stub — full screen comes in Task 2. For now, so the tab resolves and typecheck passes:

```tsx
import { Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";

export default function DiscoverScreen() {
  const colors = useColors();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
      <Text style={{ color: colors.foreground }}>Discover — coming in Task 2</Text>
    </View>
  );
}
```

- [ ] **Step 3: Create `app/(tabs)/drops.tsx` re-export**

```tsx
export { default } from "../drops";
```

Verify `app/drops.tsx` has a default export (`export default function DropsScreen` — confirmed at line 150). If the re-export breaks typed routes, fallback: move the file (see Task 4 notes).

- [ ] **Step 4: Run check**

Run: `pnpm check`
Expected: 0 errors. If `magnifyingglass`/`chart.line.downtrend.xyaxis` fail typecheck, swap to verified names.

- [ ] **Step 5: Commit**

```bash
git add "app/(tabs)/_layout.tsx" "app/(tabs)/discover.tsx" "app/(tabs)/drops.tsx"
git commit -m "feat(redesign): retab to Home-Discover-Watch-Drops-Alerts"
```

---

### Task 2: Discover screen

**Files:**
- Modify: `app/(tabs)/discover.tsx` (replace stub)
- Test: none (wiring guard in Task 5)

- [ ] **Step 1: Study the pieces to compose**

Read these (skim, don't memorize):
- `app/search.tsx` lines 1-60 (imports) and 530-600 (CatalogSearchBar + FlatList usage) — how catalog search + add-to-watchlist works.
- `components/home/trending-section.tsx` lines 1-60 — already a self-contained section (used on Home; reusable as-is).
- `components/home/available-section.tsx` lines 1-60 — same.
- `components/search/catalog-search-bar.tsx` — props of the search bar.

- [ ] **Step 2: Write the Discover screen**

Replace `app/(tabs)/discover.tsx` with:

```tsx
import { useState } from "react";
import { ScrollView, View, Text, RefreshControl } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { CatalogSearchBar } from "@/components/search/catalog-search-bar";
import { TrendingSection } from "@/components/home/trending-section";
import { AvailableSection } from "@/components/home/available-section";

export default function DiscoverScreen() {
  const colors = useColors();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            setRefreshKey((k) => k + 1);
            setRefreshing(false);
          }}
        />
      }
    >
      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <Text style={{ color: colors.foreground, fontSize: 28, fontWeight: "700", marginBottom: 12 }}>
          Discover
        </Text>
        <CatalogSearchBar key={`search-${refreshKey}`} />
      </View>
      <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
        <TrendingSection key={`trending-${refreshKey}`} />
      </View>
      <View style={{ paddingHorizontal: 16, marginTop: 8, marginBottom: 24 }}>
        <AvailableSection key={`available-${refreshKey}`} />
      </View>
    </ScrollView>
  );
}
```

Adaptation rules (implementer must verify, not blindly paste):
- Check `CatalogSearchBar`'s actual props — if it requires `query`/`onQueryChange` or navigation props, wire minimal working props (read the component first).
- Check `TrendingSection`/`AvailableSection` props — if they take no props (used bare in index.tsx lines 711-717), use bare. If they need props, pass through.
- The `key={refreshKey}` remount trick only works if the sections fetch on mount — verify they do; otherwise drop the keys and the refresh just re-renders.
- Title uses 28px per the redesign visual direction (§5).

- [ ] **Step 3: Run check + lint**

Run: `pnpm check && pnpm lint`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(tabs)/discover.tsx"
git commit -m "feat(redesign): Discover tab composes search + trending + available"
```

---

### Task 3: You stack screen + Home gear shortcut

**Files:**
- Create: `app/you.tsx`
- Modify: `app/(tabs)/index.tsx` (gear shortcut)

- [ ] **Step 1: Find the Home header gear (or where to add it)**

Search `app/(tabs)/index.tsx` for existing header/settings navigation. If a gear icon exists, reuse its position. Otherwise add a header row at the top of the ScrollView content:

```tsx
<View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 16 }}>
  <Text style={{ color: colors.foreground, fontSize: 28, fontWeight: "700" }}>
    {greeting}
  </Text>
  <TouchableOpacity
    onPress={() => router.push("/you")}
    accessibilityLabel="Open profile and settings"
    accessibilityRole="button"
    style={{ padding: 8 }}
  >
    <IconSymbol size={24} name="gearshape.fill" color={colors.muted} />
  </TouchableOpacity>
</View>
```

(`router` from `useRouter()` — index.tsx already imports it. `greeting` — compute from hour, or skip greeting in this plan and just add the gear to the existing header. Minimal change: only add the gear button; greeting comes with Plan C.)

- [ ] **Step 2: Create `app/you.tsx`**

Profile header + nav rows to existing routes. Reuse the settings-row visual pattern (36px tinted icon box + title/subtitle + chevron — copy from `components/settings/notifications-section.tsx` neighboring rows):

```tsx
import { ScrollView, View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
// + useAuth / getSettings for the profile header (email or "Guest")

const ROWS = [
  { icon: "chart.bar.fill", title: "Statistics", subtitle: "Movers, basket, insights", href: "/stats" },
  { icon: "dollarsign.circle.fill", title: "Exchange rates", subtitle: "Currency trends", href: "/(tabs)/rates" },
  { icon: "heart.text.square.fill", title: "Distributor health", subtitle: "Scraper status", href: "/health" },
  { icon: "bell.badge.fill", title: "Push diagnostics", subtitle: "Delivery status per device", href: "/diagnostics" },
  { icon: "gearshape.fill", title: "Settings", subtitle: "Account, sync, notifications", href: "/(tabs)/settings" },
] as const;
```

Verify each icon name against `components/ui/icon-symbol.tsx`; swap any missing ones for confirmed names. Verify each href resolves (rates/settings are hidden tabs — addressable as `/(tabs)/rates`; confirm via typed-routes check).

Profile header: show auth state — read `hooks/use-auth.ts` for what's exposed (email? displayName?). Signed out → "Guest" + "Sign in" button navigating to settings (where login lives). Keep it to 3 lines of logic; no new auth flows.

- [ ] **Step 3: Run check + lint**

Run: `pnpm check && pnpm lint`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add app/you.tsx "app/(tabs)/index.tsx"
git commit -m "feat(redesign): You stack screen + Home gear shortcut"
```

---

### Task 4: Route compat check (Drops deep links + hidden tabs)

**Files:** none (verification only) — Test: `tests/redesign-nav-guard.test.ts` (create)

- [ ] **Step 1: Create the wiring guard**

Create `tests/redesign-nav-guard.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("redesign navigation wiring", () => {
  it("tab layout has five tabs: index, discover, watchlist, drops, alerts", () => {
    const src = read("app/(tabs)/_layout.tsx");
    for (const name of ['name="index"', 'name="discover"', 'name="watchlist"', 'name="drops"', 'name="alerts"']) {
      expect(src).toContain(name);
    }
  });

  it("rates and settings tabs are hidden but present", () => {
    const src = read("app/(tabs)/_layout.tsx");
    expect(src).toContain('name="rates"');
    expect(src).toContain('name="settings"');
    expect(src).toContain("href: null");
  });

  it("drops tab re-exports the drops screen", () => {
    expect(read("app/(tabs)/drops.tsx")).toContain("../drops");
  });

  it("discover screen composes search + trending + available", () => {
    const src = read("app/(tabs)/discover.tsx");
    expect(src).toContain("CatalogSearchBar");
    expect(src).toContain("TrendingSection");
    expect(src).toContain("AvailableSection");
  });

  it("you screen links to stats, rates, health, diagnostics, settings", () => {
    const src = read("app/you.tsx");
    for (const href of ["/stats", "/health", "/diagnostics", "/(tabs)/settings"]) {
      expect(src).toContain(href);
    }
    expect(src).toContain("rates");
  });

  it("home links to you screen", () => {
    expect(read("app/(tabs)/index.tsx")).toContain("/you");
  });
});
```

Fix assertions to match actual content (keeping intent) if any fail.

- [ ] **Step 2: Verify old routes still resolve**

Run: `pnpm check` (typed routes fail the build on bad hrefs).
Additionally confirm `app/search.tsx`, `app/(tabs)/rates.tsx`, `app/(tabs)/settings.tsx`, `app/drops.tsx` files still exist (no deletions):

```bash
ls app/search.tsx "app/(tabs)/rates.tsx" "app/(tabs)/settings.tsx" app/drops.tsx app/stats.tsx app/health.tsx app/diagnostics.tsx
```

Expected: all listed.

- [ ] **Step 3: Run guard + full test files touched**

Run: `pnpm exec vitest run tests/redesign-nav-guard.test.ts`
Expected: all pass.

- [ ] **Step 4: Run check + lint, then full verify**

Run: `pnpm check && pnpm lint`
Expected: 0 errors. Then `pnpm verify` — expect exit 0. Fix in-scope failures; report BLOCKED with evidence for unrelated ones.

- [ ] **Step 5: Append todo.md entry**

Read tail of `todo.md` for next number (expect 1140) and style. Append:

```markdown
## Phase 1140: Redesign A — navigation retab

- [x] Tab bar: Home · Discover · Watch · Drops · Alerts; rates/settings hidden (`href: null`).
- [x] Discover tab composes CatalogSearchBar + Trending + Available sections.
- [x] You stack screen (profile + stats/rates/health/diagnostics/settings links) + Home gear shortcut.
- [x] Drops promoted to tab via re-export; `/drops` deep links keep working.
- [x] Old routes intact (search, rates, settings). TypeScript: 0 errors.
```

(Adjust number if taken. Note the You-as-stack deviation from spec §1 in the entry.)

- [ ] **Step 6: Commit**

```bash
git add tests/redesign-nav-guard.test.ts todo.md
git commit -m "test(redesign): nav wiring guards + Phase entry"
```

---

## Self-Review

**Spec coverage:**
- ✅ §1 retab (Task 1) — with documented You-as-stack deviation
- ✅ §4 Discover (Task 2), You (Task 3), Drops promotion (Tasks 1+4)
- ✅ §1 compat: old routes intact (Task 4 step 2)
- ❌ Concierge (§2) → Plan B. Home feed (§3) → Plan C. Watch refresh + visual pass (§4 partial, §5) → Plan D. Explicitly out of this plan.

**Placeholder scan:** None — Task 2/3 include adaptation rules with concrete fallbacks, not placeholders.

**Type consistency:** Route hrefs use typed-routes strings verified by `pnpm check`. Icon names verified against the mapping in-task.
