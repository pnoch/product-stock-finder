# Repositioned Copy — Design Spec

**Date:** 2026-10-06
**Status:** Draft for review

## Goal

Align every user-facing string with the repositioned product: a **global stock &
price radar for hard-to-find hardware** — availability-first, landed cost to your
door, built from a real shortage. The app is already named "Product Stock Finder";
this is a **copy pass**, not a rename.

## Problem

The mechanics are repositioned (Phases 1114–1116) but the words are not. Current
copy is generic price-tracker language:

- Onboarding: "Track Prices Everywhere" / "Monitor products across 25 global
  distributors in one watchlist."
- Home header: "Global availability monitor".
- Empty state: "track prices across 25 distributors".
- About tagline: "Track smarter. Buy better."
- Notification permission: "drops below your target price, comes back in stock".

None of it says the thing that makes the product different: **find who has a
hard-to-find part worldwide, what it costs landed at your door, and get told the
second it restocks or drops.**

## Scope

**In scope:** user-facing copy strings — onboarding slides, home header/empty
state, About tagline, notification permission strings, app.config description.

**Out of scope:** the app name/slug/bundle ID (already "Product Stock Finder" /
`com.app.stocktrackerpro` — changing the bundle ID would break existing installs);
icons/splash; store listing assets; any logic.

## The Message

**One line:** *Find who has it worldwide, at the best landed price, and get told
the second it restocks or drops.*

**Origin line (About / store):** *Built because I couldn't find a CRS804 during a
global shortage.*

**Voice:** direct, practical, a little insider (the audience knows MikroTik,
homelab, lead times). No hype, no emoji.

## Copy Changes

### 1. Onboarding slides — `components/onboarding/onboarding-screen.tsx`

| # | Title | Body |
| --- | --- | --- |
| 1 | "Find It Anywhere" | "One search across 25 global distributors — see who actually has it in stock." |
| 2 | "Know the Real Price" | "Landed cost to your country: price + shipping + tax, ranked. No surprises at checkout." |
| 3 | "Never Miss a Restock" | "Price alerts, restock watches, and digests tell you the second it's back or cheaper." |

(The 4th destination step already asks "Where do you ship to?" — unchanged.)

### 2. Home header — `app/(tabs)/index.tsx`

- Title stays "Product Stock Finder".
- Subtitle: "Global availability monitor" → **"Find it anywhere. Landed to your door."**

### 3. Home empty state — `app/(tabs)/index.tsx`

- "No products tracked yet" → **"Nothing on the radar yet"**
- Body: "Tap + to add a product to your watchlist and track prices across 25
  distributors" → **"Tap + and paste a model number — we'll check all 25
  distributors and alert you the moment it's in stock."**

### 4. About tagline — `components/settings/about-section.tsx`

- "Track smarter. Buy better." → **"Find it anywhere. Landed to your door."**
- Add a one-line origin under the version: **"Built because I couldn't find a
  CRS804 during a global shortage."**

### 5. Notification permission strings — `app.config.ts` + `lib/notifications.ts`

- app.config `NSUserNotificationsUsageDescription`: "Product Stock Finder notifies
  you when a watched product drops below your target price, comes back in stock,
  or a reminder is due." → **"Product Stock Finder alerts you the moment a watched
  part is back in stock or drops below your target price, anywhere in the world."**
- `lib/notifications.ts` permission description: "Notifications when a product
  drops below your target price" → **"Alerts when a watched part restocks or drops
  below your target price."**

### 6. app.config description

Add an Android/iOS store description field if the config supports it:
**"Global stock & price radar for hard-to-find hardware. Find who has it
worldwide, at the best landed price, and get told the second it restocks."**

### 7. Desktop parity — `desktop/src/`

The desktop app mirrors the mobile copy, with parity guards
(`tests/desktop-onboarding.test.ts`, `tests/desktop-chart-guard.test.ts`). Apply
the same strings so the two platforms stay in lockstep:

- `desktop/src/components/OnboardingModal.tsx` `SLIDES` → the same 3 titles/bodies
  as §1.
- `desktop/src/pages/Home.tsx` header subtitle → "Find it anywhere. Landed to your
  door."; empty state title → "Nothing on the radar yet"; empty state description
  → the same as §3.
- Update the parity guards to assert the new strings (they currently pin the old
  ones).

## Data Flow

None — copy only. No state, no logic, no schema.

## Error Handling

None.

## Testing

- A source-guard test (`tests/repositioned-copy.test.ts`) pinning the key strings
  (onboarding titles, home subtitle, About tagline) so a future edit can't silently
  revert the positioning. Mirrors the existing `screen-fixes-source-guards` style.
- Update the desktop parity guards (`tests/desktop-onboarding.test.ts`,
  `tests/desktop-chart-guard.test.ts`) to the new strings.
- Existing onboarding/home/about tests stay green (update any that assert the old
  strings).

## Success Criteria

- Every user-facing string above reflects the scarcity-radar + landed-cost story.
- No app name/slug/bundle-ID change.
- `pnpm verify` stays green.

## Risks

- **Over-claiming** → copy says "estimated"/"landed" honestly, consistent with
  Phase 1116's estimate labelling.
- **Breaking tests that assert old strings** → update them in the same change.
