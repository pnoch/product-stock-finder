# Settings Screen Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Break `app/(tabs)/settings.tsx` (1,611 lines) into focused, single-responsibility components. No behavior changes — pure structural refactoring.

**Architecture:** Extract 4 shared components (SettingRow, SectionHeader, PillPicker, RadioPicker) + 6 screen sub-components. Main screen becomes a ~540-line composition root.

**Tech Stack:** React Native, Expo Router, NativeWind, TypeScript

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `components/settings/setting-row.tsx` | Reusable row with icon + label + right slot |
| Create | `components/settings/section-header.tsx` | Uppercase section label |
| Create | `components/settings/pill-picker.tsx` | Generic pill-style picker (currency, region) |
| Create | `components/settings/radio-picker.tsx` | Generic radio-style picker (interval, digest) |
| Create | `components/settings/connection-section.tsx` | Connection card |
| Create | `components/settings/account-section.tsx` | Account card with sync status |
| Create | `components/settings/device-management-section.tsx` | Device list + rename modal |
| Create | `components/settings/notifications-section.tsx` | Notification toggles |
| Create | `components/settings/scraper-status-section.tsx` | Distributor health table |
| Create | `components/settings/about-section.tsx` | Version, privacy, support links |
| Modify | `app/(tabs)/settings.tsx` | Slim down to composition root (~540 lines) |
| Create | `tests/components/settings/pill-picker.test.tsx` | PillPicker tests |
| Create | `tests/components/settings/radio-picker.test.tsx` | RadioPicker tests |

---

### Task 1: Create shared foundational components

**Files:**
- Create: `components/settings/setting-row.tsx`
- Create: `components/settings/section-header.tsx`

- [ ] **Step 1: Create SettingRow**

```typescript
// components/settings/setting-row.tsx
import { Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

export function SettingRow({
  icon,
  label,
  description,
  descriptionColor,
  right,
}: {
  icon: React.ComponentProps<typeof IconSymbol>["name"];
  label: string;
  description?: string;
  descriptionColor?: string;
  right: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: colors.primary + "22",
          alignItems: "center",
          justifyContent: "center",
          marginRight: 12,
        }}
      >
        <IconSymbol name={icon} size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{ color: colors.foreground, fontWeight: "500", fontSize: 15 }}
        >
          {label}
        </Text>
        {description && (
          <Text
            style={{
              color: descriptionColor ?? colors.muted,
              fontSize: 12,
              marginTop: 1,
            }}
          >
            {description}
          </Text>
        )}
      </View>
      {right}
    </View>
  );
}
```

- [ ] **Step 2: Create SectionHeader**

```typescript
// components/settings/section-header.tsx
import { Text } from "react-native";
import { useColors } from "@/hooks/use-colors";

export function SectionHeader({ title }: { title: string }) {
  const colors = useColors();
  return (
    <Text
      style={{
        color: colors.muted,
        fontSize: 12,
        fontWeight: "600",
        textTransform: "uppercase",
        letterSpacing: 0.8,
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 8,
      }}
    >
      {title}
    </Text>
  );
}
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm check`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add components/settings/setting-row.tsx components/settings/section-header.tsx
git commit -m "refactor: extract SettingRow + SectionHeader to components/settings/"
```

---

### Task 2: Create PillPicker + RadioPicker

**Files:**
- Create: `components/settings/pill-picker.tsx`
- Create: `components/settings/radio-picker.tsx`

- [ ] **Step 1: Create PillPicker**

```typescript
// components/settings/pill-picker.tsx
import { Text, View, TouchableOpacity } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

export function PillPicker({
  icon,
  label,
  options,
  value,
  onSelect,
}: {
  icon: React.ComponentProps<typeof IconSymbol>["name"];
  label: string;
  options: string[];
  value: string;
  onSelect: (v: string) => void;
}) {
  const colors = useColors();
  return (
    <View style={{ paddingVertical: 14, paddingHorizontal: 16 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: colors.primary + "22",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          <IconSymbol name={icon} size={18} color={colors.primary} />
        </View>
        <Text
          style={{
            color: colors.foreground,
            fontWeight: "500",
            fontSize: 15,
          }}
        >
          {label}
        </Text>
      </View>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
          paddingLeft: 48,
        }}
      >
        {options.map((opt) => (
          <TouchableOpacity
            key={opt}
            onPress={() => onSelect(opt)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 6,
              borderRadius: 20,
              backgroundColor:
                value === opt ? colors.primary : colors.border,
            }}
          >
            <Text
              style={{
                color: value === opt ? "#fff" : colors.foreground,
                fontWeight: "600",
                fontSize: 13,
              }}
            >
              {opt}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Create RadioPicker**

```typescript
// components/settings/radio-picker.tsx
import { Text, View, TouchableOpacity } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

export function RadioPicker({
  icon,
  label,
  options,
  value,
  onSelect,
}: {
  icon: React.ComponentProps<typeof IconSymbol>["name"];
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onSelect: (v: string) => void;
}) {
  const colors = useColors();
  return (
    <View style={{ paddingVertical: 14, paddingHorizontal: 16 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: colors.primary + "22",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          <IconSymbol name={icon} size={18} color={colors.primary} />
        </View>
        <Text
          style={{
            color: colors.foreground,
            fontWeight: "500",
            fontSize: 15,
          }}
        >
          {label}
        </Text>
      </View>
      <View style={{ paddingLeft: 48, gap: 8 }}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onSelect(opt.value)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingVertical: 8,
            }}
          >
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                borderWidth: 2,
                borderColor:
                  value === opt.value ? colors.primary : colors.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {value === opt.value && (
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: colors.primary,
                  }}
                />
              )}
            </View>
            <Text
              style={{
                color: colors.foreground,
                fontSize: 14,
              }}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm check`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add components/settings/pill-picker.tsx components/settings/radio-picker.tsx
git commit -m "refactor: extract PillPicker + RadioPicker to components/settings/"
```

---

### Task 3: Extract screen sub-components

**Files:**
- Create: `components/settings/connection-section.tsx`
- Create: `components/settings/account-section.tsx`
- Create: `components/settings/device-management-section.tsx`
- Create: `components/settings/notifications-section.tsx`
- Create: `components/settings/scraper-status-section.tsx`
- Create: `components/settings/about-section.tsx`

- [ ] **Step 1: Create ConnectionSection**

Read lines 480-537 from `app/(tabs)/settings.tsx` and extract into an exported component. It calls `useConnection()` internally, no props needed.

- [ ] **Step 2: Create AccountSection**

Read lines 539-656 and extract. Props: `isAuthenticated`, `user`, `syncMeta`, `syncing`, `onSyncNow`, `onSignOut`, `onSignIn`, `syncStatus`.

- [ ] **Step 3: Create DeviceManagementSection**

Read lines 658-976 and extract. This is the largest section (319 lines). It encapsulates its own state (devices, currentDeviceId, rename modal, etc.). Props: `user`, `isAuthenticated`, `colors`.

- [ ] **Step 4: Create NotificationsSection**

Read lines 978-1156 and extract. Props: `settings`, `updateSetting`, `onTestNotification`, `setSettings`.

- [ ] **Step 5: Create ScraperStatusSection**

Read lines 1420-1521 and extract. Props: `products`, `onReenableDistributor`.

- [ ] **Step 6: Create AboutSection**

Read lines 1541-1611 and extract. No props needed (pure display).

- [ ] **Step 7: Run typecheck**

Run: `pnpm check`
Expected: 0 errors

- [ ] **Step 8: Commit**

```bash
git add components/settings/
git commit -m "refactor: extract settings sub-components to components/settings/"
```

---

### Task 4: Refactor main settings.tsx to composition root

**Files:**
- Modify: `app/(tabs)/settings.tsx`

- [ ] **Step 1: Rewrite main component**

Replace the file content with a composition root that:
1. Imports all extracted components
2. Keeps state declarations, callbacks, derived state
3. Replaces inline JSX with imported sub-components
4. Passes props down

Key things to preserve:
- All 14 useState hooks
- `updateSetting` callback
- `handleSyncNow`, `handleTestNotification`, `handleReenableDistributor` callbacks
- `distributorStatuses` IIFE + `getDistributorHealth` function
- Constant arrays (currencies, regions, intervals, digestFrequencies)
- Page header JSX

- [ ] **Step 2: Run typecheck**

Run: `pnpm check`
Expected: 0 errors

- [ ] **Step 3: Run tests**

Run: `pnpm test`
Expected: All pass

- [ ] **Step 4: Commit**

```bash
git add app/\(tabs\)/settings.tsx
git commit -m "refactor: slim settings.tsx to composition root (~540 lines)"
```

---

### Task 5: Picker tests + final verification

**Files:**
- Create: `tests/components/settings/pill-picker.test.tsx`
- Create: `tests/components/settings/radio-picker.test.tsx`

- [ ] **Step 1: Create PillPicker test**

```typescript
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react-native";
import React from "react";
import { PillPicker } from "@/components/settings/pill-picker";

vi.mock("@/hooks/use-colors", () => ({
  useColors: () => ({
    primary: "#0F52BA",
    foreground: "#000",
    muted: "#6B7280",
    border: "#E5E7EB",
  }),
}));

vi.mock("@/components/ui/icon-symbol", () => ({
  IconSymbol: () => null,
}));

describe("PillPicker", () => {
  it("renders label and options", () => {
    render(
      <PillPicker
        icon="dollarsign.circle.fill"
        label="Currency"
        options={["USD", "EUR", "GBP"]}
        value="USD"
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText("Currency")).toBeTruthy();
    expect(screen.getByText("USD")).toBeTruthy();
    expect(screen.getByText("EUR")).toBeTruthy();
    expect(screen.getByText("GBP")).toBeTruthy();
  });

  it("calls onSelect when option pressed", () => {
    const onSelect = vi.fn();
    render(
      <PillPicker
        icon="dollarsign.circle.fill"
        label="Currency"
        options={["USD", "EUR"]}
        value="USD"
        onSelect={onSelect}
      />,
    );
    fireEvent.press(screen.getByText("EUR"));
    expect(onSelect).toHaveBeenCalledWith("EUR");
  });
});
```

- [ ] **Step 2: Create RadioPicker test**

```typescript
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react-native";
import React from "react";
import { RadioPicker } from "@/components/settings/radio-picker";

vi.mock("@/hooks/use-colors", () => ({
  useColors: () => ({
    primary: "#0F52BA",
    foreground: "#000",
    muted: "#6B7280",
    border: "#E5E7EB",
  }),
}));

vi.mock("@/components/ui/icon-symbol", () => ({
  IconSymbol: () => null,
}));

describe("RadioPicker", () => {
  it("renders label and options", () => {
    render(
      <RadioPicker
        icon="clock"
        label="Check Interval"
        options={[
          { value: "manual", label: "Manual only" },
          { value: "hourly", label: "Every hour" },
        ]}
        value="manual"
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText("Check Interval")).toBeTruthy();
    expect(screen.getByText("Manual only")).toBeTruthy();
    expect(screen.getByText("Every hour")).toBeTruthy();
  });

  it("calls onSelect when option pressed", () => {
    const onSelect = vi.fn();
    render(
      <RadioPicker
        icon="clock"
        label="Check Interval"
        options={[
          { value: "manual", label: "Manual only" },
          { value: "hourly", label: "Every hour" },
        ]}
        value="manual"
        onSelect={onSelect}
      />,
    );
    fireEvent.press(screen.getByText("Every hour"));
    expect(onSelect).toHaveBeenCalledWith("hourly");
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/components/settings/`
Expected: All pass

- [ ] **Step 4: Update todo.md**

Append Phase 69 section to `todo.md`:
```markdown

## Phase 69: Settings Screen Refactor (v5.17)

- [x] Extract SettingRow + SectionHeader to components/settings/
- [x] Extract PillPicker + RadioPicker (generic pickers)
- [x] Extract ConnectionSection, AccountSection, DeviceManagementSection
- [x] Extract NotificationsSection, ScraperStatusSection, AboutSection
- [x] Refactor main component to composition root
- [x] Picker tests + verification
```

- [ ] **Step 5: Commit**

```bash
git add tests/components/settings/ todo.md
git commit -m "refactor: picker tests + Phase 69 docs"
```

---

### Task 6: Final verification + push

- [ ] **Step 1: Verify line count reduction**

Run: `wc -l app/\(tabs\)/settings.tsx`
Expected: ~540 lines (down from 1,611)

- [ ] **Step 2: Full verification**

Run: `pnpm check && pnpm lint && pnpm test`
Expected: 0 TypeScript errors, lint clean, all tests pass

- [ ] **Step 3: Push**

```bash
git push origin main
```
