# Android App Redesign — Design Spec

**Date:** 2026-10-11
**Status:** Approved (5/5 sections)
**Scope:** `app/` (ships Android + iOS + web together; Android-only fork explicitly rejected)

---

## 1. Navigation

**Discover · Watch · Drops · Alerts · You** — 5 tabs, same count, new meaning:

| Tab | Contains | Today |
|---|---|---|
| Discover | Search + Available Now + Trending + concierge entry | New screen merging 3 |
| Watch | Watchlist (filters, groups, bulk ops, tags) | Same power, refreshed rows |
| Drops | Leaderboard full screen (Your/Global tabs) | Promoted from hidden route |
| Alerts | Alerts + Reminders + Notifications | Same IA, visual refresh |
| You | Settings + Stats + Rates + Health + Diagnostics | New, absorbs 4 screens |

Rates leaves the tab bar (becomes a You section). No More menu — every tab is a daily-use surface. A gear shortcut on the Home header links to You/Settings.

Existing routes stay valid (Rates route remains, unlisted from tabs). Old deep links keep working.

## 2. First Run (Concierge)

Replaces the 3-slide carousel + country picker (`components/onboarding/`).

1. **"What are you hunting for?"** — free text → catalog match via existing search infra. Multi-select up to 5 products. Skip allowed.
2. **"Where do you ship?"** — existing country picker (auto-detect locale). Sets ship-to + display currency + tax-exempt.
3. **"Notify me when…"** — three toggles, defaults: price drops ON, back-in-stock ON, weekly digest OFF. Creates one alert per tracked product (10% under current best price) + restock watches.

**Done screen:** "You're set — tracking N products across 25 stores" → lands on Home with data present (never empty on first run).

Rules: Skip on any step jumps to Discover. Sign-in deferred to You tab (no auth wall). Existing users never see it (keep the `has_seen_onboarding` AsyncStorage gate).

## 3. Home (Priority Feed)

Answers "do I need to act?" Sections render only when non-empty, in urgency order:

1. **Greeting header** — time-of-day greeting + date + gear shortcut + connection dot. No stat cards (stats live in You).
2. **Alerts fired** — only when triggered alerts exist. Rows: product, old→new price, View / Re-arm actions (deep-link from Alerts logic).
3. **Big drops** — top 3 from `computeLocalDrops` (7d, %). "See all →" navigates to Drops tab.
4. **Back in stock** — restock watches flipped to in_stock, with Visit/buy action.
5. **All quiet** — shown when 2–4 are empty: "Nothing needs you. N prices fell this week." Calm retention hook.
6. **Watchlist preview** — top 3 by recent activity + "Open watchlist →".

Pull-to-refresh refreshes all. Away-summary dissolves into the feed (its items become feed cards, no separate card). Trending + Available Now move to Discover. Drops preview reuses leaderboard logic.

## 4. Other Tabs

- **Discover** (new `app/(tabs)/discover.tsx`; existing `app/search.tsx` route stays as a deep-link target and shares its list components): search bar → Trending horizontal cards → Available Now grid → category/brand chips filtering everything. Inline "＋ Track" per card (adds to watchlist, no navigation). The Search tab is replaced by the Discover tab; `/search` deep links keep working.
- **Watch**: same power, cleaner rows — 56px min touch targets, swipe actions (alert / acquired / remove), single collapsed filter bar ("Show acquired" + filters together). Acquired dimming stays.
- **Drops**: unchanged from Phase 1138 + tab icon.
- **Alerts**: same 3 sub-tabs, visual refresh; triggered alerts keep inline Re-arm.
- **You**: profile header (avatar initial, sign-in state) → Stats summary → Rates → Health → Diagnostics → Devices → Settings → About. Reuses existing screens as sections/routes.

Net new code: Discover screen + concierge flow + Home feed reorder. Everything else is restyle + rewire.

## 5. Visual Language + Compatibility

Evolution, not rebrand: keep sapphire/emerald tokens (`theme.config.js`). Screen titles 24→28px. 16px card radius everywhere. One row pattern (title + subtitle + right meta, 56px touch target). App-wide urgency colors: red alert / emerald drop / green stock / neutral quiet. Dark mode first-class (all colors via `useColors()`).

Compatibility: same AsyncStorage keys (no migration). Same route paths where they exist. Desktop parity deferred to a separate plan. Advanced screens (build-order, sourcing, compare, health detail) keep logic, get row/card refresh only.

## Out of Scope

- Android-only fork of `app/`.
- New backend endpoints (feed reuses alerts/drops/restock/away data).
- Desktop redesign (separate plan).
- Monetization/paywall changes.
- Recommendation engine.
