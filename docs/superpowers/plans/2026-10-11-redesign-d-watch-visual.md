# Redesign Plan D — Watch Refresh + Visual Pass

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh Watch rows (multi-action swipe, collapsed filter bar) and normalize the visual language (16px cards, 56px targets, 28px titles) across key screens.

**Architecture:** Extend `SwipeableCard` with alert/acquired actions; collapse the Watch filter UI into one bar with an active-count badge; sweep card radii / touch targets / titles on Watch, Alerts, Drops, Home feed, You, Discover.

**Tech Stack:** TypeScript, Expo Router, React Native, `react-native-gesture-handler`, NativeWind + `useColors()`.

**Spec:** `docs/superpowers/specs/2026-10-11-android-redesign-design.md` (Sections 4-5, Watch + visual rows)

---

## File Structure

| File | Purpose |
|------|---------|
| Modify `components/watchlist/swipeable-card.tsx` | Alert/acquired/remove swipe actions |
| Modify `app/(tabs)/watchlist.tsx` | Wire swipe handlers + collapsed filter bar |
| Modify `app/(tabs)/alerts.tsx`, `app/drops.tsx`, `components/home/feed-card.tsx`, `app/you.tsx`, `app/(tabs)/discover.tsx` | Radius/target/title normalization |
| Create `tests/redesign-d-guard.test.ts` | Wiring guards |

---

### Task 1: Multi-action swipe (alert / acquired / remove)

**Files:**
- Modify: `components/watchlist/swipeable-card.tsx`
- Modify: `app/(tabs)/watchlist.tsx` (wire handlers)

- [ ] **Step 1: Extend `SwipeableCard` props**

Current props: `{ children, onDelete, enabled }`. New props:

```tsx
export function SwipeableCard({
  children,
  onDelete,
  onToggleAlert,
  onToggleAcquired,
  isAcquired,
  hasAlert,
  enabled = true,
}: {
  children: React.ReactNode;
  onDelete: () => void;
  onToggleAlert?: () => void;
  onToggleAcquired?: () => void;
  isAcquired?: boolean;
  hasAlert?: boolean;
  enabled?: boolean;
})
```

Render three right-side action buttons (widen container from 88 to ~216 = 3×72): Alert (primary tint, `bell.fill`, label "Alert"/"Muted" by `hasAlert`), Acquired (emerald tint, `checkmark.circle.fill`, label "Owned"/"Want" by `isAcquired`), Remove (error, existing). Each: RectButton with a11y label/hint, haptic on press, `swipeableRef.current?.close()` before firing. If a handler is undefined, omit that button and shrink container accordingly (compute width = 72 × visibleCount). Keep existing animation (scale/opacity interpolation — adjust inputRange upper bound from -88 to `-width`).

Verify icon names in mapping first.

- [ ] **Step 2: Wire handlers in `app/(tabs)/watchlist.tsx`**

At the `SwipeableCard` usage (~line 790), pass:
- `onToggleAlert`: navigate to alert creation for the product (read how the card's existing alert action works — copy it; likely `router.push` to product detail alert sheet or inline `addAlert`; use whatever the row's alert button does today).
- `onToggleAcquired`: call the existing `handleToggleAcquired`-equivalent for the row (the acquired toggle already exists per Phase 1137 — find its handler and reuse).
- `isAcquired={isAcquired(item)}`, `hasAlert={...}` (check how the row knows an alert exists — alerts list lookup by productId; copy the row's existing logic).

- [ ] **Step 3: Run check + lint**

Run: `pnpm check && pnpm lint`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add components/watchlist/swipeable-card.tsx "app/(tabs)/watchlist.tsx"
git commit -m "feat(redesign): watch swipe actions (alert/acquired/remove)"
```

---

### Task 2: Collapsed filter bar

**Files:**
- Modify: `app/(tabs)/watchlist.tsx`

- [ ] **Step 1: Study the current filter UI**

Read `app/(tabs)/watchlist.tsx` around lines 1090-1180 (Show acquired switch, clear-filters, and neighboring filter controls: region, tags, status, price, in-stock). Map every control.

- [ ] **Step 2: Collapse into one bar**

Requirements:
- One "Filters" toggle button in the list header showing active-filter count badge (count = number of non-default filters INCLUDING showAcquired-on and inStockOnly-on and query/tags/status/price/region deviations).
- Tapping toggles a collapsible panel containing ALL filter controls (existing components moved verbatim inside; Show acquired switch moves in too).
- Collapsed by default when zero active filters; expanded state persists per session (useState, no storage).
- "Clear all" inside the panel resets everything including `setShowAcquired(true)` (keep existing behavior from line ~1170).
- No filtering logic changes — move components only.

- [ ] **Step 3: Run check + lint, commit**

Run: `pnpm check && pnpm lint`
Expected: 0 errors.

```bash
git add "app/(tabs)/watchlist.tsx"
git commit -m "feat(redesign): collapsed watch filter bar with count badge"
```

---

### Task 3: Visual pass (radius / targets / titles)

**Files:**
- Modify: `app/(tabs)/watchlist.tsx`, `app/(tabs)/alerts.tsx`, `app/drops.tsx`, `components/home/feed-card.tsx`, `app/you.tsx`, `app/(tabs)/discover.tsx` (only as needed)

Rules (from spec §5):
- **Cards → 16px radius.** Change card-container `borderRadius: 8/12` to 16. Chips/badges/buttons/pills stay as-is (only card containers).
- **Touch targets → 56px min height** for tappable rows (product rows, alert rows, drop rows, feed cards, settings/you rows). Add `minHeight: 56` + `justifyContent: "center"` where rows are shorter. Do not touch already-tall rows.
- **Titles → 28px** screen titles (`fontSize: 28, fontWeight: "700"`). Audit each touched screen's title; Discover already 28px (skip if confirmed).

- [ ] **Step 1: Audit**

For each file, grep `borderRadius` and `fontSize: 2[024]` and list what changes. Tappable-row heights: read the row styles (paddingVertical + content height) and compute.

- [ ] **Step 2: Apply + verify**

Apply the changes, then `pnpm check && pnpm lint` (0 errors).

- [ ] **Step 3: Commit**

```bash
git add "app/(tabs)/watchlist.tsx" "app/(tabs)/alerts.tsx" app/drops.tsx components/home/feed-card.tsx app/you.tsx "app/(tabs)/discover.tsx"
git commit -m "feat(redesign): visual pass (16px cards, 56px targets, 28px titles)"
```

(Stage only files actually changed.)

---

### Task 4: Guards + todo.md + verify

**Files:**
- Create: `tests/redesign-d-guard.test.ts`
- Modify: `todo.md`

- [ ] **Step 1: Create guard**

```typescript
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("redesign D wiring", () => {
  it("swipe card supports alert/acquired/remove", () => {
    const src = read("components/watchlist/swipeable-card.tsx");
    expect(src).toContain("onToggleAlert");
    expect(src).toContain("onToggleAcquired");
  });

  it("watchlist wires swipe handlers", () => {
    const src = read("app/(tabs)/watchlist.tsx");
    expect(src).toContain("onToggleAlert");
    expect(src).toContain("onToggleAcquired");
  });

  it("filter bar collapses with count", () => {
    const src = read("app/(tabs)/watchlist.tsx");
    expect(src).toContain("Filters");
  });

  it("cards use 16px radius on key screens", () => {
    for (const f of ["app/(tabs)/alerts.tsx", "app/drops.tsx", "components/home/feed-card.tsx"]) {
      expect(read(f)).toContain("borderRadius: 16");
    }
  });
});
```

Fix assertions to match reality (keeping intent).

- [ ] **Step 2: Run tests + verify**

Run guard test, then `pnpm check && pnpm lint`, then `pnpm verify` (exit 0; fix in-scope, BLOCKED otherwise).

- [ ] **Step 3: todo.md entry** (next number, expect 1143):

```markdown
## Phase 1143: Redesign D — Watch refresh + visual pass

- [x] Swipe actions (alert/acquired/remove) on watch rows.
- [x] Collapsed filter bar with active-count badge.
- [x] 16px cards, 56px targets, 28px titles on key screens.
- [x] Guards. TypeScript: 0 errors.
```

- [ ] **Step 4: Commit**

```bash
git add tests/redesign-d-guard.test.ts todo.md
git commit -m "test(redesign): Plan D guards + Phase entry"
```

---

## Self-Review

**Spec coverage (§4 Watch + §5 visual):**
- ✅ Swipe actions (Task 1)
- ✅ Collapsed filter bar (Task 2)
- ✅ Radius/targets/titles (Task 3)
- Acquired dimming: already shipped (Phase 1137, kept).

**Placeholder scan:** None.

**Type consistency:** `onToggleAlert?`, `onToggleAcquired?`, `isAcquired?`, `hasAlert?` optional props used consistently between card and watchlist wiring.
