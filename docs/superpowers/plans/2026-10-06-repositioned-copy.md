# Repositioned Copy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align every user-facing string (mobile + desktop) with the "global stock & price radar for hard-to-find hardware" positioning, without changing the app name, slug, or bundle ID.

**Architecture:** Pure string edits across onboarding, home, About, notification permission, and `app.config`, mirrored on desktop. A source-guard test pins the key strings; the existing desktop parity guards are updated to the new strings.

**Tech Stack:** TypeScript, React Native / React, vitest.

**Spec:** `docs/superpowers/specs/2026-10-06-repositioned-copy-design.md`

---

## File Structure

- Modify `components/onboarding/onboarding-screen.tsx` — slide copy.
- Modify `app/(tabs)/index.tsx` — header subtitle + empty state.
- Modify `components/settings/about-section.tsx` — tagline + origin line.
- Modify `app.config.ts` — notification permission + store description.
- Modify `lib/notifications.ts` — permission description.
- Modify `desktop/src/components/OnboardingModal.tsx` — slide copy.
- Modify `desktop/src/pages/Home.tsx` — header subtitle + empty state.
- Create `tests/repositioned-copy.test.ts` — guard.
- Modify `tests/desktop-onboarding.test.ts`, `tests/desktop-chart-guard.test.ts` — new strings.

---

### Task 1: Mobile onboarding + home copy

**Files:** Modify `components/onboarding/onboarding-screen.tsx`, `app/(tabs)/index.tsx`

- [ ] **Step 1: Update the onboarding slides**

In `components/onboarding/onboarding-screen.tsx`, replace the `SLIDES` array:

```ts
const SLIDES = [
  {
    icon: "cart.fill",
    title: "Find It Anywhere",
    body: "One search across 25 global distributors — see who actually has it in stock.",
  },
  {
    icon: "sparkles",
    title: "Know the Real Price",
    body: "Landed cost to your country: price + shipping + tax, ranked. No surprises at checkout.",
  },
  {
    icon: "bell",
    title: "Never Miss a Restock",
    body: "Price alerts, restock watches, and digests tell you the second it's back or cheaper.",
  },
] as const;
```

- [ ] **Step 2: Update the home header + empty state**

In `app/(tabs)/index.tsx`:
- Header subtitle: `Global availability monitor` → `Find it anywhere. Landed to your door.`
- Empty-state title: `No products tracked yet` → `Nothing on the radar yet`
- Empty-state body: `Tap + to add a product to your watchlist and track prices across 25 distributors` → `Tap + and paste a model number — we'll check all 25 distributors and alert you the moment it's in stock.`

- [ ] **Step 3: Verify it compiles**

Run: `pnpm check`
Expected: 0 type errors.

- [ ] **Step 4: Commit**

```bash
git add components/onboarding/onboarding-screen.tsx app/\(tabs\)/index.tsx
git commit -m "copy: reposition mobile onboarding + home"
```

---

### Task 2: About + notification permission copy

**Files:** Modify `components/settings/about-section.tsx`, `app.config.ts`, `lib/notifications.ts`

- [ ] **Step 1: Update the About tagline + origin line**

In `components/settings/about-section.tsx`, replace the tagline `Track smarter. Buy better.` with `Find it anywhere. Landed to your door.` and add an origin line below it:

```tsx
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          Product Stock Finder · v{Constants.expoConfig?.version ?? "dev"}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>
          Find it anywhere. Landed to your door.
        </Text>
        <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
          Built because I couldn't find a CRS804 during a global shortage.
        </Text>
```

- [ ] **Step 2: Update the notification permission strings**

In `app.config.ts`, replace the `NSUserNotificationsUsageDescription` value with:

```
"Product Stock Finder alerts you the moment a watched part is back in stock or drops below your target price, anywhere in the world.",
```

In `lib/notifications.ts`, replace the permission `description` `Notifications when a product drops below your target price` with:

```
"Alerts when a watched part restocks or drops below your target price.",
```

- [ ] **Step 3: Add the store description**

In `app.config.ts`, add a top-level `description` to the `config` object (after `slug`):

```ts
  description:
    "Global stock & price radar for hard-to-find hardware. Find who has it worldwide, at the best landed price, and get told the second it restocks.",
```

- [ ] **Step 4: Verify it compiles**

Run: `pnpm check`
Expected: 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add components/settings/about-section.tsx app.config.ts lib/notifications.ts
git commit -m "copy: reposition About + notification permission + store description"
```

---

### Task 3: Desktop parity copy

**Files:** Modify `desktop/src/components/OnboardingModal.tsx`, `desktop/src/pages/Home.tsx`

- [ ] **Step 1: Update the desktop onboarding slides**

In `desktop/src/components/OnboardingModal.tsx`, replace the `SLIDES` titles/bodies to match mobile:

```ts
const SLIDES = [
  {
    icon: ShoppingCart,
    title: "Find It Anywhere",
    body: "One search across 25 global distributors — see who actually has it in stock.",
  },
  {
    icon: Sparkles,
    title: "Know the Real Price",
    body: "Landed cost to your country: price + shipping + tax, ranked. No surprises at checkout.",
  },
  {
    icon: Bell,
    title: "Never Miss a Restock",
    body: "Price alerts, restock watches, and digests tell you the second it's back or cheaper.",
  },
];
```

- [ ] **Step 2: Update the desktop home header + empty state**

In `desktop/src/pages/Home.tsx`:
- Header subtitle: `Global availability monitor` → `Find it anywhere. Landed to your door.`
- Empty-state `title`: `No products tracked yet` → `Nothing on the radar yet`
- Empty-state `description`: `Click Add Product to add a product to your watchlist and track prices across 25 distributors` → `Click Add Product and paste a model number — we'll check all 25 distributors and alert you the moment it's in stock.`

- [ ] **Step 3: Verify it compiles**

Run: `pnpm --filter desktop build` (or `pnpm check:desktop`)
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add desktop/src/components/OnboardingModal.tsx desktop/src/pages/Home.tsx
git commit -m "copy: reposition desktop onboarding + home"
```

---

### Task 4: Guard test + update parity guards

**Files:** Create `tests/repositioned-copy.test.ts`; Modify `tests/desktop-onboarding.test.ts`, `tests/desktop-chart-guard.test.ts`

- [ ] **Step 1: Write the guard test**

Create `tests/repositioned-copy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

// Pins the repositioned positioning so a future edit can't silently revert it
// to generic price-tracker copy.
describe("repositioned copy", () => {
  it("mobile onboarding leads with find/landed/restock", () => {
    const src = read("components/onboarding/onboarding-screen.tsx");
    expect(src).toContain("Find It Anywhere");
    expect(src).toContain("Know the Real Price");
    expect(src).toContain("Never Miss a Restock");
  });

  it("mobile home uses the radar subtitle and empty state", () => {
    const src = read("app/(tabs)/index.tsx");
    expect(src).toContain("Find it anywhere. Landed to your door.");
    expect(src).toContain("Nothing on the radar yet");
  });

  it("About carries the tagline and origin line", () => {
    const src = read("components/settings/about-section.tsx");
    expect(src).toContain("Find it anywhere. Landed to your door.");
    expect(src).toContain("CRS804 during a global shortage");
  });

  it("desktop mirrors the onboarding + home copy", () => {
    expect(read("desktop/src/components/OnboardingModal.tsx")).toContain("Find It Anywhere");
    const home = read("desktop/src/pages/Home.tsx");
    expect(home).toContain("Find it anywhere. Landed to your door.");
    expect(home).toContain("Nothing on the radar yet");
  });
});
```

- [ ] **Step 2: Run the guard test**

Run: `pnpm exec vitest run tests/repositioned-copy.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 3: Update the desktop parity guards**

In `tests/desktop-onboarding.test.ts`, replace the asserted titles:

```ts
    expect(text).toContain("Find It Anywhere");
    expect(text).toContain("Know the Real Price");
    expect(text).toContain("Never Miss a Restock");
```

In `tests/desktop-chart-guard.test.ts`:
- In `matches mobile's Home header on desktop`: `Global availability monitor` → `Find it anywhere. Landed to your door.`
- In `matches mobile's Home empty state on desktop`: `title="No products tracked yet"` → `title="Nothing on the radar yet"`

- [ ] **Step 4: Run the updated guards**

Run: `pnpm exec vitest run tests/desktop-onboarding.test.ts tests/desktop-chart-guard.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/repositioned-copy.test.ts tests/desktop-onboarding.test.ts tests/desktop-chart-guard.test.ts
git commit -m "test: guard repositioned copy + update desktop parity guards"
```

---

### Task 5: Full verification + docs

**Files:** `todo.md`

- [ ] **Step 1: Run the full gate**

Run: `pnpm verify`
Expected: exit 0.

- [ ] **Step 2: Document**

Add a `todo.md` phase entry (next number 1117): the repositioned copy across
mobile + desktop, the origin line, and the guard test; note the app name/slug/
bundle ID are unchanged.

- [ ] **Step 3: Commit**

```bash
git add todo.md
git commit -m "docs: repositioned copy (Phase 1117)"
```

---

## Self-Review

- **Spec coverage:** mobile onboarding + home (Task 1), About + notification + store description (Task 2), desktop parity (Task 3), guard + parity-guard updates (Task 4), verify + docs (Task 5). App name/slug/bundle ID are explicitly unchanged per the spec.
- **Placeholders:** none — every string is given verbatim.
- **Consistency:** the same three onboarding titles and the same home subtitle/empty-state strings appear on both platforms; the guard test and the updated parity guards assert those exact strings.
