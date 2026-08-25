# Digest Schedule Settings — Design Spec

**Date:** 2026-09-21
**Goal:** Add digest frequency (Off/Daily/Weekly) and day-of-week pickers to Settings' notifications section, and gate weekly digests on the chosen weekday.

## Discovery

`digestFrequency` exists in AppSettings but has NO settings UI — users cannot enable digests today. This phase adds the UI plus the day-of-week control.

## Type

`AppSettings.digestDayOfWeek?: number` (0=Sunday…6=Saturday). No DEFAULT_SETTINGS changes — absent keeps current behavior (`?? "off"` frequency, `?? 0` day).

## Evaluation (lib/price-digest.ts maybeSendDigest)

Weekly branch: fire when `elapsed >= intervalMs` **AND** `new Date(now).getDay() === (settings.digestDayOfWeek ?? 0)`. Daily unchanged. If the app isn't opened on the chosen weekday, fires on next open still matching.

## Settings UI

In `components/settings/notifications-section.tsx`, after Health Alerts:

1. **Price Digest** row via PillPicker: Off / Daily / Weekly → `updateSetting("digestFrequency", v)`
2. **Digest Day** PillPicker row (Sun–Sat), rendered only when `settings.digestFrequency === "weekly"` → `updateSetting("digestDayOfWeek", n)` (store as number via String→Number conversion at the PillPicker boundary)

## Testing

Extend `tests/price-digest.test.ts`:
- weekly + wrong weekday + elapsed ≥7d → no send
- weekly + matching weekday + elapsed ≥7d → sends
- daily ignores weekday gate
