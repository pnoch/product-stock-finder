# Device Management Refactor — Design Spec

**Date:** 2026-08-24
**Goal:** Break `components/settings/device-management-section.tsx` (484 lines) into a composition root plus focused sub-components and a hook, adding unit tests for the currently-untested pure helpers.

## Current State

One component holds everything:

- Pure helpers: `platformLabel`, `formatLastSeen` (untested)
- 9 state hooks: devices, currentDeviceId, currentBinding, devicesLoading, bindingAction, renameTarget, renameLabel, renaming, now
- 5 callbacks: loadDevices, handleBindCurrentDevice, handleSignOutDevice, openRenameModal, handleRename
- 2 effects: load-on-auth (with stale-device cleanup), 30s clock tick
- JSX: "This device" SettingRow with bind button; device list rows (label, badge, platform/last-seen, Rename/Sign-out); rename bottom-sheet modal

## Target Architecture

```
components/settings/
  device-management-section.tsx   composition root (~80 lines) — unchanged path/API
  device-management/
    device-utils.ts               platformLabel, formatLastSeen (~25)
    use-device-management.ts      all state + callbacks + effects (~110)
    current-device-row.tsx        This-device SettingRow + bind action (~70)
    device-row.tsx                per-device row (~120)
    rename-device-modal.tsx       rename bottom sheet (~110)

tests/device-utils.test.ts        new — formatLastSeen + platformLabel cases
```

## Interface Contracts

- `useDeviceManagement({ user, isAuthenticated })` returns:
  `{ devices, devicesLoading, currentDeviceId, currentBinding, bindingAction, loadDevices, handleBindCurrentDevice, handleSignOutDevice, openRenameModal, renameTarget, setRenameTarget, renameLabel, setRenameLabel, renaming, handleRename, now }`
  (same names as today's locals — mechanical move)
- `CurrentDeviceRow` props: `{ loading, binding, userId, bindAction, onBind }`
- `DeviceRow` props: `{ device, isCurrent, now, onRename, onSignOut, isLast }`
- `RenameDeviceModal` props: `{ target, label, setLabel, saving, onSave, onClose }`
- `DeviceManagementSection` props unchanged: `{ user, isAuthenticated, colors }`; `settings.tsx` untouched.

## Behavior Invariants

- Haptic feedback points (bind/rename tap → Medium impact; sign-out confirm → Warning notification) move verbatim into the hook.
- Sign-out confirm dialog copy identical.
- Load-on-auth effect runs cleanupStaleDevices then loadDevices; 30s clock only while authenticated.
- Render states preserved: loading spinner / error+Retry / empty message / list.

## Testing

New vitest suite for the pure helpers (`formatLastSeen`: unknown/just-now/minutes/hours/days boundaries; `platformLabel`: ios/android/other). Existing tests must pass unchanged. Full suite per task.

## Extraction Order (one commit each)

1. `device-utils.ts` + tests (TDD)
2. `use-device-management.ts` hook
3. `current-device-row.tsx`
4. `device-row.tsx`
5. `rename-device-modal.tsx` + finalize composition root + todo.md + push

**Key metrics:** 484-line single component → 5 focused files + thin root; helpers gain test coverage.
