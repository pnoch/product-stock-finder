# Settings-Driven Background Task Cadence (v5.9) Design

## Goal

Apply the `checkInterval` setting change immediately: when the user changes the check interval in Settings, re-register both the price-check task and the health probe task with the new interval (or unregister both when set to `manual`). Currently both tasks are registered only on app launch (`app/_layout.tsx`), so an interval change takes effect only after restart.

## Background

`registerPriceCheckTask()` and `registerHealthProbeTask()` in `lib/background-price-check.ts` both read `settings.checkInterval` and register/unregister their task accordingly:
- `manual` → unregister
- `hourly` → `minimumInterval: 60`
- `daily` → `minimumInterval: 1440`

Both are web-safe (return early on `Platform.OS === "web"`) and swallow errors internally. Both are called once on app launch from `app/_layout.tsx:104-106`. The setting is changed in `app/(tabs)/settings.tsx` via `updateSetting("checkInterval", value)` which calls `saveSettings`.

## Decisions (from brainstorming)

1. **Scope: both tasks** — re-register the price-check task and the health probe task together, since both read the same setting.
2. **Trigger: combined helper** — a new `syncBackgroundTasks()` in `lib/background-price-check.ts`, called from the settings screen when `checkInterval` changes.
3. **Approach A:** explicit helper + thin settings hook; no storage listeners or app-focus re-sync.

## Architecture

### New helper: `syncBackgroundTasks()` (modify `lib/background-price-check.ts`)

```ts
export async function syncBackgroundTasks() {
  await registerPriceCheckTask();
  await registerHealthProbeTask();
}
```

- Sequential (awaited) so the price-check task finishes before the health probe task — deterministic and testable.
- On web, both inner calls return early — the helper is a no-op.
- On native, each inner call reads current settings and registers/unregisters with the correct interval; because both functions re-register when already registered, an interval change is applied immediately.

### Settings hook (modify `app/(tabs)/settings.tsx`)

In `updateSetting`, after `await saveSettings(updated)`:

```tsx
if (key === "checkInterval") {
  void syncBackgroundTasks();
}
```

- `syncBackgroundTasks` imported from `@/lib/background-price-check`.
- Fire-and-forget (`void`) keeps the tap snappy; both inner calls swallow errors, so no unhandled rejection.
- Applies to all three interval values (`manual` / `hourly` / `daily`); `manual` unregisters both tasks immediately.

### No change to `app/_layout.tsx`

Launch-time registration stays as the initial setup.

## Data Flow

User taps an interval row in Settings → `updateSetting("checkInterval", value)` → `setSettings` + `saveSettings` → `syncBackgroundTasks()` → `registerPriceCheckTask()` + `registerHealthProbeTask()` → both tasks registered with the new interval (or unregistered for `manual`).

## Error Handling

- Both inner calls already guard `Platform.OS === "web"` and wrap everything in try/catch — the helper needs no additional handling.
- Fire-and-forget cannot produce an unhandled rejection because the inner functions never throw.

## Testing

`tests/price-check.test.ts` (mirroring the existing `registerHealthProbeTask` describe block's mocks: `expo-background-task`, `expo-task-manager`, `react-native` Platform = iOS, `state.taskRegistered` / `state.settingsStore` drive behavior):

- `syncBackgroundTasks` with `checkInterval: "hourly"` → both `PRICE_CHECK_TASK` and `HEALTH_PROBE_TASK` registered with `minimumInterval: 60`.
- `syncBackgroundTasks` with `checkInterval: "daily"` → both registered with `minimumInterval: 1440`.
- `syncBackgroundTasks` with `checkInterval: "manual"` → both unregistered.

Verification: `pnpm check`, `pnpm lint`, `pnpm test`.

Browser smoke: change `checkInterval` in Settings on web → no crash (web no-op path); native behavior covered by unit tests.

## Out of Scope

- Re-registering on app focus or via storage listeners.
- Per-task interval settings (both tasks share `checkInterval`).
- Server-side scheduling changes.