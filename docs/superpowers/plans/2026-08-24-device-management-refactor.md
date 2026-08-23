# Device Management Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Break `components/settings/device-management-section.tsx` (484 lines) into a composition root plus focused sub-components and a hook, adding unit tests for the pure helpers.

**Architecture:** Keep `device-management-section.tsx` at its existing path as a thin composition root (public API unchanged). Extract into `components/settings/device-management/`: pure utils (+ new tests), one hook owning all state/effects/callbacks, three presentational components.

**Tech Stack:** React Native, Expo, TypeScript strict, vitest.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `components/settings/device-management-section.tsx` | Composition root (~90 lines), public API unchanged |
| `components/settings/device-management/device-utils.ts` | `platformLabel`, `formatLastSeen` |
| `components/settings/device-management/use-device-management.ts` | All state + callbacks + effects |
| `components/settings/device-management/current-device-row.tsx` | This-device row + bind action |
| `components/settings/device-management/device-row.tsx` | Per-device row |
| `components/settings/device-management/rename-device-modal.tsx` | Rename bottom sheet |
| `tests/device-utils.test.ts` | New helper tests |

---

## Task 1: Extract utils + tests (TDD)

**Files:**
- Create: `components/settings/device-management/device-utils.ts`
- Test: `tests/device-utils.test.ts`

- [ ] **Step 1: Write failing test `tests/device-utils.test.ts`**

```typescript
import { describe, expect, it } from "vitest";
import {
  formatLastSeen,
  platformLabel,
} from "../components/settings/device-management/device-utils";

describe("platformLabel", () => {
  it("maps known platforms", () => {
    expect(platformLabel("ios")).toBe("iOS");
    expect(platformLabel("android")).toBe("Android");
  });

  it("falls back to Unknown", () => {
    expect(platformLabel(null)).toBe("Unknown");
    expect(platformLabel("web")).toBe("Unknown");
  });
});

describe("formatLastSeen", () => {
  const now = Date.parse("2026-01-01T12:00:00Z");

  it("reports unknown timestamps", () => {
    expect(formatLastSeen(0, now)).toBe("last seen unknown");
  });

  it("reports recent timestamps as just now", () => {
    expect(formatLastSeen(now - 30_000, now)).toBe("last seen just now");
  });

  it("reports minutes", () => {
    expect(formatLastSeen(now - 5 * 60_000, now)).toBe("last seen 5m ago");
    expect(formatLastSeen(now - 59 * 60_000, now)).toBe("last seen 59m ago");
  });

  it("reports hours", () => {
    expect(formatLastSeen(now - 60 * 60_000, now)).toBe("last seen 1h ago");
    expect(formatLastSeen(now - 23 * 60 * 60_000, now)).toBe(
      "last seen 23h ago",
    );
  });

  it("reports days", () => {
    expect(formatLastSeen(now - 24 * 60 * 60_000, now)).toBe(
      "last seen 1d ago",
    );
    expect(formatLastSeen(now - 3 * 24 * 60 * 60_000, now)).toBe(
      "last seen 3d ago",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/device-utils.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Create `components/settings/device-management/device-utils.ts`**

Move verbatim from `device-management-section.tsx`:

```typescript
export function platformLabel(platform: string | null): string {
  if (platform === "ios") return "iOS";
  if (platform === "android") return "Android";
  return "Unknown";
}

export function formatLastSeen(lastSeenAt: number, now: number): string {
  if (!lastSeenAt) return "last seen unknown";
  const diff = Math.max(0, now - lastSeenAt);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "last seen just now";
  if (minutes < 60) return `last seen ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `last seen ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `last seen ${days}d ago`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/device-utils.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Update `device-management-section.tsx`**

Delete the two local helpers; add:
```typescript
import {
  formatLastSeen,
  platformLabel,
} from "@/components/settings/device-management/device-utils";
```

Run `pnpm check` (0 errors) and `pnpm test` (all pass).

- [ ] **Step 6: Commit**

```bash
git add components/settings/device-management tests/device-utils.test.ts components/settings/device-management-section.tsx && git commit -m "refactor: extract device utils with tests"
```

---

## Task 2: Extract useDeviceManagement hook

**Files:**
- Create: `components/settings/device-management/use-device-management.ts`
- Modify: `components/settings/device-management-section.tsx`

- [ ] **Step 1: Create the hook**

Move ALL state hooks, callbacks, and effects verbatim from the section:

```typescript
import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { showAlert } from "@/lib/alert";
import {
  fetchDevices,
  fetchCurrentDeviceBinding,
  renameDevice,
  signOutDevice,
  cleanupStaleDevices,
  bindCurrentDevice,
} from "@/lib/devices";
import type { DeviceInfo } from "@/lib/devices";
import { getDeviceId } from "@/lib/device-id";

export function useDeviceManagement({
  isAuthenticated,
}: {
  isAuthenticated: boolean;
}) {
  const [devices, setDevices] = useState<DeviceInfo[] | null>(null);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const [currentBinding, setCurrentBinding] = useState<{
    userId: number | null;
  } | null>(null);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [bindingAction, setBindingAction] = useState(false);
  const [renameTarget, setRenameTarget] = useState<DeviceInfo | null>(null);
  const [renameLabel, setRenameLabel] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // paste loadDevices, handleBindCurrentDevice, handleSignOutDevice,
  // openRenameModal, handleRename verbatim (bodies unchanged)

  // paste both useEffects verbatim (load-on-auth + 30s clock)

  return {
    devices,
    currentDeviceId,
    currentBinding,
    devicesLoading,
    bindingAction,
    loadDevices,
    handleBindCurrentDevice,
    handleSignOutDevice,
    renameTarget,
    setRenameTarget,
    openRenameModal,
    renameLabel,
    setRenameLabel,
    renaming,
    handleRename,
    now,
  };
}
```

- [ ] **Step 2: Rewire `device-management-section.tsx`**

Replace the moved block with:

```typescript
const {
  devices,
  currentDeviceId,
  currentBinding,
  devicesLoading,
  bindingAction,
  loadDevices,
  handleBindCurrentDevice,
  handleSignOutDevice,
  renameTarget,
  setRenameTarget,
  openRenameModal,
  renameLabel,
  setRenameLabel,
  renaming,
  handleRename,
  now,
} = useDeviceManagement({ isAuthenticated });
```

Remove now-unused imports (`useCallback`, `useEffect`, `useState`, `Haptics`, `Platform`, `showAlert`, all `@/lib/devices` functions except the `DeviceInfo` type if still referenced, `getDeviceId`). Run `pnpm check` + `pnpm test`.

- [ ] **Step 3: Commit**

```bash
git add components/settings/device-management components/settings/device-management-section.tsx && git commit -m "refactor: extract useDeviceManagement hook"
```

---

## Task 3: Extract CurrentDeviceRow

**Files:**
- Create: `components/settings/device-management/current-device-row.tsx`
- Modify: `components/settings/device-management-section.tsx`

- [ ] **Step 1: Create the component**

Move the `<SettingRow icon="iphone" ...>` block verbatim:

```typescript
import { Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { SettingRow } from "@/components/settings/setting-row";

interface CurrentDeviceRowProps {
  devicesLoading: boolean;
  binding: { userId: number | null } | null;
  userId: number;
  bindingAction: boolean;
  onBind: () => void;
}

export function CurrentDeviceRow({
  devicesLoading,
  binding,
  userId,
  bindingAction,
  onBind,
}: CurrentDeviceRowProps) {
  const colors = useColors();

  return (
    /* paste the SettingRow JSX verbatim, substituting:
       devicesLoading → devicesLoading, currentBinding → binding,
       user.id → userId, bindingAction → bindingAction,
       handleBindCurrentDevice → onBind */
  );
}
```

- [ ] **Step 2: Rewire section**

Replace that JSX with:
```tsx
<CurrentDeviceRow
  devicesLoading={devicesLoading}
  binding={currentBinding}
  userId={user.id}
  bindingAction={bindingAction}
  onBind={handleBindCurrentDevice}
/>
```
Remove unused imports (`SettingRow`, possibly `ActivityIndicator`). Verify + commit:

```bash
git add components/settings/device-management components/settings/device-management-section.tsx && git commit -m "refactor: extract CurrentDeviceRow"
```

---

## Task 4: Extract DeviceRow

**Files:**
- Create: `components/settings/device-management/device-row.tsx`
- Modify: `components/settings/device-management-section.tsx`

- [ ] **Step 1: Create the component**

Move the per-device row JSX (the `devices.map((device, idx) => ...)` body) verbatim:

```typescript
import { Text, View, TouchableOpacity } from "react-native";
import { useColors } from "@/hooks/use-colors";
import type { DeviceInfo } from "@/lib/devices";
import { formatLastSeen, platformLabel } from "./device-utils";

interface DeviceRowProps {
  device: DeviceInfo;
  isCurrent: boolean;
  now: number;
  isLast: boolean;
  onRename: (device: DeviceInfo) => void;
  onSignOut: (device: DeviceInfo) => void;
}

export function DeviceRow({
  device,
  isCurrent,
  now,
  isLast,
  onRename,
  onSignOut,
}: DeviceRowProps) {
  const colors = useColors();

  return (
    /* paste the row View JSX verbatim, substituting:
       device.deviceId === currentDeviceId → isCurrent,
       idx < devices.length - 1 ? 1 : 0 → isLast ? 1 : 0,
       formatLastSeen(device.lastSeenAt, now) stays,
       openRenameModal(device) → onRename(device),
       handleSignOutDevice(device) → onSignOut(device) */
  );
}
```

- [ ] **Step 2: Rewire section**

Replace the map body with:
```tsx
{devices.map((device, idx) => (
  <DeviceRow
    key={device.deviceId}
    device={device}
    isCurrent={device.deviceId === currentDeviceId}
    now={now}
    isLast={idx < devices.length - 1}
    onRename={openRenameModal}
    onSignOut={handleSignOutDevice}
  />
))}
```
Remove unused imports (`formatLastSeen`, `platformLabel`, `View`/`Text`/`TouchableOpacity` if no longer used). Verify + commit:

```bash
git add components/settings/device-management components/settings/device-management-section.tsx && git commit -m "refactor: extract DeviceRow"
```

---

## Task 5: Extract RenameDeviceModal + finalize + push

**Files:**
- Create: `components/settings/device-management/rename-device-modal.tsx`
- Modify: `components/settings/device-management-section.tsx`
- Modify: `todo.md`

- [ ] **Step 1: Create the modal**

Move the Rename Modal JSX verbatim:

```typescript
import { Text, View, TextInput, TouchableOpacity, ActivityIndicator, Modal } from "react-native";
import { useColors } from "@/hooks/use-colors";
import type { DeviceInfo } from "@/lib/devices";

interface RenameDeviceModalProps {
  target: DeviceInfo | null;
  label: string;
  setLabel: (label: string) => void;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
}

export function RenameDeviceModal({
  target,
  label,
  setLabel,
  saving,
  onSave,
  onClose,
}: RenameDeviceModalProps) {
  const colors = useColors();

  return (
    <Modal
      visible={!!target}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* paste the bottom-sheet JSX verbatim, substituting:
          renameTarget → target, setRenameTarget(null) → onClose (both places),
          renameLabel/setRenameLabel → label/setLabel,
          renaming → saving, handleRename → onSave */}
    </Modal>
  );
}
```

- [ ] **Step 2: Finalize composition root**

Section should now be ~90 lines: imports, props (unchanged `{ user, isAuthenticated, colors }` signature — do not remove the `colors` prop even though unused, matching today's behavior), `useDeviceManagement` call, early return, header + card with the three child components, modal. Remove all unused imports (`Modal`, `TextInput`, etc.).

Final shape check:

```bash
wc -l components/settings/device-management-section.tsx components/settings/device-management/*.tsx components/settings/device-management/*.ts
```

- [ ] **Step 3: Full verification**

```bash
pnpm check   # 0 errors
pnpm lint    # no new errors
pnpm test    # all pass
```

- [ ] **Step 4: Update `todo.md`**

Append Phase 77 section:

```markdown
## Phase 77: Device Management Refactor (v5.25)

- [x] Extract platformLabel/formatLastSeen to device-utils.ts with unit tests
- [x] Extract useDeviceManagement hook (state, callbacks, effects)
- [x] Extract CurrentDeviceRow to components/settings/device-management/
- [x] Extract DeviceRow to components/settings/device-management/
- [x] Extract RenameDeviceModal to components/settings/device-management/
- [x] Refactor main section to composition root
```

- [ ] **Step 5: Commit and push**

```bash
git add components/settings/device-management components/settings/device-management-section.tsx todo.md && git commit -m "refactor: extract RenameDeviceModal, finalize device management section"
git push origin main
```

---

## Summary

| Metric | Before | After |
|--------|--------|-------|
| `device-management-section.tsx` | 484 lines | ~90 lines |
| New files | — | 5 (utils, hook, 3 components) |
| Helper test coverage | none | 9 unit tests |
| Public API | unchanged | unchanged |
