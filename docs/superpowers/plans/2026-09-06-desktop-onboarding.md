# Desktop Onboarding Tour Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** First-run desktop users see a 3-slide welcome modal, shown once.

**Architecture:** New `OnboardingModal` built on the shared `Modal` component (Esc/backdrop/focus-trap already handled); visibility state in `App.tsx`; persistence via shared `hasSeenOnboarding`/`setOnboardingSeen` with an injected localStorage store. No server or mobile changes.

**Tech Stack:** React, vitest.

**Spec:** `docs/superpowers/specs/2026-09-06-desktop-onboarding-design.md`

---

### Task 1: Guard tests for onboarding

**Files:**
- Create: `tests/desktop-onboarding.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop onboarding", () => {
  it("has a 3-slide welcome modal", async () => {
    const text = await readFile("desktop/src/components/OnboardingModal.tsx", "utf8");
    expect(text).toContain("Track Prices Everywhere");
    expect(text).toContain("Add Anything");
    expect(text).toContain("Never Miss a Drop");
  });

  it("shows once via shared seen-flag helpers", async () => {
    const app = await readFile("desktop/src/App.tsx", "utf8");
    const modal = await readFile("desktop/src/components/OnboardingModal.tsx", "utf8");
    expect(app).toContain("OnboardingModal");
    expect(modal).toContain("hasSeenOnboarding");
    expect(modal).toContain("setOnboardingSeen");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/desktop-onboarding.test.ts 2>&1 | tail -4`
Expected: FAIL (2 failed — second fails on missing file; if any string already exists, report instead of committing).

- [ ] **Step 3: Commit the failing tests**

```bash
git add tests/desktop-onboarding.test.ts
git commit -m "test: guard desktop onboarding tour"
```

---

### Task 2: OnboardingModal + App wiring

**Files:**
- Create: `desktop/src/components/OnboardingModal.tsx`
- Modify: `desktop/src/App.tsx`

- [ ] **Step 1: Read Modal conventions first**

Read `desktop/src/components/Modal.tsx` fully (props: `open`, `onClose`, `title`, `children`; backdrop/Esc/focus-trap built in). Also read the inline `ShortcutsOverlay` in App.tsx (~line 82) for content styling precedent if needed.

- [ ] **Step 2: Create the modal**

```tsx
import { useState } from "react";
import { Modal } from "./Modal";

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

export function OnboardingModal({
  open,
  onComplete,
}: {
  open: boolean;
  onComplete: () => void;
}) {
  const [index, setIndex] = useState(0);
  const last = index === SLIDES.length - 1;
  const slide = SLIDES[index];

  return (
    <Modal open={open} onClose={onComplete} title="Welcome">
      <div className="text-center space-y-3 py-2">
        <div className="text-5xl" aria-hidden="true">{slide.emoji}</div>
        <h3 className="text-lg font-bold">{slide.title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">{slide.body}</p>
        <div className="flex items-center justify-center gap-1.5" aria-hidden="true">
          {SLIDES.map((s, i) => (
            <span
              key={s.title}
              className={`h-1.5 rounded-full ${i === index ? "w-6 bg-brand-600" : "w-1.5 bg-gray-300 dark:bg-gray-600"}`}
            />
          ))}
        </div>
        <div className="flex items-center justify-between gap-2 pt-2">
          <button
            onClick={onComplete}
            className="px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400"
            aria-label="Skip tour"
          >
            Skip
          </button>
          <div className="flex gap-2">
            {index > 0 && (
              <button
                onClick={() => setIndex(index - 1)}
                className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium"
                aria-label="Previous slide"
              >
                Back
              </button>
            )}
            <button
              onClick={() => (last ? onComplete() : setIndex(index + 1))}
              className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
              aria-label={last ? "Finish tour" : "Next slide"}
            >
              {last ? "Get started" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
```
Verify `Modal`'s exact prop contract by reading (title required? children wrapper expectations). Adjust only prop usage, not structure. `role="dialog"` comes from Modal itself — verify; if Modal lacks it, add `role`/`aria-label` on the content div is unnecessary — check and match.

- [ ] **Step 3: Wire visibility + persistence in App.tsx**

Read the App state block first (`searchModalOpen`, `shortcutsOpen` at ~lines 200-201). Add:
```tsx
import { hasSeenOnboarding, setOnboardingSeen } from "../../../lib/onboarding";
import { OnboardingModal } from "./components/OnboardingModal";

const localStore = {
  getItem: (k: string) => Promise.resolve(localStorage.getItem(k)),
  setItem: (k: string, v: string): Promise<void> => {
    localStorage.setItem(k, v);
    return Promise.resolve();
  },
};
```
(`lib/onboarding.ts` imports AsyncStorage at top — importing it into desktop pulls `@react-native-async-storage/async-storage`, which desktop vite STUBS (precedent: desktop builds with async-storage stubs; the import is only for the DEFAULT param, never called since we always pass our store). Verify the desktop build passes in step 4 — if the stub breaks, FALL BACK: inline the two 5-line functions in App.tsx instead of importing, and report it.)
State + effect (near other modal state):
```tsx
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const seen = await hasSeenOnboarding(localStore);
        if (!cancelled && !seen) setOnboardingOpen(true);
      } catch {
        // treat as seen — never block the app
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const completeOnboarding = useCallback(async () => {
    setOnboardingOpen(false);
    try {
      await setOnboardingSeen(localStore);
    } catch {
      // best-effort
    }
  }, []);
```
Check `useCallback` import in App.tsx; add if missing. Render beside ShortcutsOverlay:
```tsx
          <OnboardingModal open={onboardingOpen} onClose={completeOnboarding} />
```
`localStore` at module scope (stable, no deps needed).

- [ ] **Step 4: Verify**

Run: `pnpm vitest run tests/desktop-onboarding.test.ts` (both pass), `pnpm check` (clean), workdir `desktop/` `pnpm build` (exit 0 — validates the lib/onboarding import bundles).

- [ ] **Step 5: Commit**

```bash
git add desktop/src/components/OnboardingModal.tsx desktop/src/App.tsx
git commit -m "Feat: desktop first-run onboarding tour modal. TypeScript: 0 errors."
```

---

### Task 3: Full verification + push

**Files:** none (verification only)

- [ ] **Step 1: Lint + full suite**

`pnpm lint` (0 errors, no new warnings in the 2 touched files), `pnpm test` (all pass, 0 failures).

- [ ] **Step 2: Desktop build**

Workdir `desktop/`: `pnpm build` (exit 0).

- [ ] **Step 3: Push**

`git push origin main` (`main -> main`), `git status --short` empty.
