# Desktop Onboarding Tour — Design

Date: 2026-09-06. Scope: first-run welcome modal on desktop
(approved).

## Problem

Desktop has no first-run experience: new users land on an empty
watchlist with no orientation. Mobile gates on a 3-slide intro
(`OnboardingScreen`, `has_seen_onboarding` flag).

## Approach

Modal overlay with the same 3 slides and copy; persistence reuses
the shared helpers with an injected localStorage store. No full-page
block, no new data layers.

## Persistence

- Local adapter in desktop code:
```ts
const localStore = {
  getItem: (k: string) => Promise.resolve(localStorage.getItem(k)),
  setItem: (k: string, v: string): Promise<void> => {
    localStorage.setItem(k, v);
    return Promise.resolve();
  },
};
```
  passed to `hasSeenOnboarding` / `setOnboardingSeen` from
  `lib/onboarding.ts` (same `has_seen_onboarding` key; per-storage
  namespaces mean desktop shows once independently).
- Guard `localStorage` access with try/catch (private mode): treat
  failure as seen (never block the app).

## Modal

- New `desktop/src/components/OnboardingModal.tsx`: props
  `{ open: boolean; onClose: () => void }`. Same 3 slides and copy
  as mobile (🛒 Track Prices Everywhere / ✨ Add Anything / 🔔
  Never Miss a Drop). Dots indicator, Back/Next, Skip, Get started
  on last slide. `role="dialog"` + `aria-label`, Esc key and
  backdrop click dismiss.
- Rendered in `desktop/src/App.tsx` shell beside
  `ShortcutsOverlay`. Visibility state in App: on mount, check the
  flag; show if unseen. Complete (Get started), Skip, and dismiss
  (Esc/backdrop) ALL persist seen + hide — no nagging, no re-entry
  affordance (out of scope).

## Testing

- Source-guard tests: modal exists with 3 slides + persistence
  wiring (`has_seen_onboarding` via shared helpers), rendered in
  App shell, dismiss persists.
- Verification: `pnpm check` (0 errors), `pnpm lint` (no new
  warnings), `pnpm test` (full suite green), desktop `pnpm build`.

## Non-goals

- Tour re-entry button, product tour hotspots, per-slide
  illustrations beyond emoji.
- Mobile code untouched.
