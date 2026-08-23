# Settings Screen Refactor (v5.17)

## Goal

Break `app/(tabs)/settings.tsx` (1,611 lines) into focused, single-responsibility components. No behavior changes — pure structural refactoring.

## Current State

`settings.tsx` contains:
- 2 local helper components (`SettingRow`, `SectionHeader`)
- 2 utility functions (`platformLabel`, `formatLastSeen`)
- 1 massive main component with 14 state hooks, 9 callbacks, and all JSX
- 27 total hooks (14 useState, 9 useCallback, 4 useEffect)

## Extraction Plan

### New shared components

| Component | Source | Lines | Destination |
|-----------|--------|-------|-------------|
| `SettingRow` | `settings.tsx:58-117` | 60 | `components/settings/setting-row.tsx` |
| `SectionHeader` | `settings.tsx:119-137` | 19 | `components/settings/section-header.tsx` |
| `PillPicker` | Generic (replaces currency + region pickers) | ~40 | `components/settings/pill-picker.tsx` |
| `RadioPicker` | Generic (replaces interval + digest pickers) | ~40 | `components/settings/radio-picker.tsx` |

### Screen sub-components

| Component | Source lines | Size | Props |
|-----------|-------------|------|-------|
| `ConnectionSection` | 480–537 | 58 | none (calls useConnection internally) |
| `AccountSection` | 539–656 | 118 | isAuthenticated, user, syncMeta, syncing, onSyncNow, onSignOut, onSignIn |
| `DeviceManagementSection` | 658–976 | 319 | user, isAuthenticated, colors |
| `NotificationsSection` | 978–1156 | 179 | settings, updateSetting, onTestNotification |
| `ScraperStatusSection` | 1420–1521 | 119 | products, onReenableDistributor |
| `AboutSection` | 1541–1611 | 71 | none (pure display) |

### Main component after refactor

`settings.tsx` becomes ~540 lines:
1. State declarations (~30 lines) — 14 useState hooks
2. Data loading — useEffect for initial load
3. Callbacks — updateSetting, handleSyncNow, handleTestNotification, handleReenableDistributor
4. JSX composition — imports all sub-components, passes props

## Prop Architecture

- `updateSetting` is the most cross-cutting — passed to 5 sections (Notifications, Currency, Region, Interval, Digest)
- Device Management is nearly self-contained — owns 8 state hooks and 6 callbacks
- `products` state stays in parent since it's shared between Scraper Status and Device Management
- `useAuth()` and `useConnection()` can be called directly in extracted components
- SettingRow/SectionHeader move to `components/settings/` for reuse

## Testing

- Existing 833+ tests pass without modification
- Add snapshot tests for PillPicker and RadioPicker in `tests/components/settings/`
- Verification: `pnpm check` (0 errors), `pnpm lint`, `pnpm test`

## Commit Plan

1. Extract shared components (SettingRow, SectionHeader, PillPicker, RadioPicker)
2. Extract screen sub-components (Connection, Account, Device Management, Notifications, Scraper Status, About)
3. Refactor main component to composition root
4. Add picker tests + update todo.md
5. Final verification pass
