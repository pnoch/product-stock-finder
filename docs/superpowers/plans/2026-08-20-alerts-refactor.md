# Alerts Screen Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Break `app/(tabs)/alerts.tsx` (1,200 lines) into smaller components, reducing it to ~350-400 lines.

**Architecture:** Extract 6 presentational components + 1 custom hook into `components/alerts/` and `hooks/`. The main screen becomes a thin composition root calling the hook and rendering extracted components.

**Tech Stack:** React Native, Expo, TypeScript, expo-haptics, expo-router, AsyncStorage (via lib/storage.ts), NativeWind/useColors for theming.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `components/alerts/tab-switcher.tsx` | 3-segment pill tab switcher (Alerts/Reminders/Notifications) |
| `components/alerts/alert-card.tsx` | Active price alert card with Switch toggle + delete |
| `components/alerts/triggered-alert-card.tsx` | Triggered/price-drop-history alert with re-arm + delete |
| `components/alerts/stock-watch-card.tsx` | Restock watch card with status dot, watching badge, delete |
| `components/alerts/reminder-card.tsx` | Date reminder card with past-due badge, reschedule, delete |
| `components/alerts/reschedule-modal.tsx` | Bottom-sheet modal with DateTimePicker + Cancel/Reschedule |
| `hooks/use-alerts-data.ts` | Custom hook: 10 state hooks + loadData + 6 action callbacks |
| `app/(tabs)/alerts.tsx` | Composition root (~350-400 lines) |

---

## Task 1: Extract TabSwitcher

**Files:**
- Create: `components/alerts/tab-switcher.tsx`
- Modify: `app/(tabs)/alerts.tsx:264-326` (remove inline JSX, use component)

- [ ] **Step 1: Create `components/alerts/tab-switcher.tsx`**

```typescript
import { Text, View, TouchableOpacity, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

export type ActiveTab = "alerts" | "reminders" | "notifications";

interface TabSwitcherProps {
  active: ActiveTab;
  counts: Record<ActiveTab, number>;
  onChange: (tab: ActiveTab) => void;
}

export function TabSwitcher({ active, counts, onChange }: TabSwitcherProps) {
  const colors = useColors();

  return (
    <View
      style={{
        flexDirection: "row",
        marginHorizontal: 20,
        marginBottom: 12,
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 4,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      {(["alerts", "reminders", "notifications"] as ActiveTab[]).map((tab) => (
        <TouchableOpacity
          key={tab}
          onPress={() => {
            if (Platform.OS !== "web")
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onChange(tab);
          }}
          style={{
            flex: 1,
            paddingVertical: 8,
            borderRadius: 9,
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "center",
            gap: 6,
            backgroundColor:
              active === tab ? colors.primary : "transparent",
          }}
        >
          <IconSymbol
            name={
              tab === "alerts"
                ? "bell.fill"
                : tab === "reminders"
                  ? "calendar"
                  : "bell.badge.fill"
            }
            size={15}
            color={active === tab ? "#fff" : colors.muted}
          />
          <Text
            style={{
              color: active === tab ? "#fff" : colors.muted,
              fontWeight: "600",
              fontSize: 14,
            }}
          >
            {tab === "alerts"
              ? "Alerts"
              : tab === "reminders"
                ? "Reminders"
                : "Notifications"}
            {counts[tab] > 0 ? ` (${counts[tab]})` : ""}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
```

- [ ] **Step 2: Update `app/(tabs)/alerts.tsx` to use TabSwitcher**

Remove lines 264-326 (the inline tab switcher) and replace with:
```typescript
import { TabSwitcher, ActiveTab } from "@/components/alerts/tab-switcher";

// Remove the type definition at line 41:
// type ActiveTab = "alerts" | "reminders" | "notifications";

// In the render, replace the inline tab switcher with:
<TabSwitcher
  active={activeTab}
  counts={tabCount}
  onChange={setActiveTab}
/>
```

- [ ] **Step 3: Run `pnpm check` — 0 errors**

- [ ] **Step 4: Run `pnpm test` — all pass**

- [ ] **Step 5: Commit**

```bash
git add components/alerts/tab-switcher.tsx app/\(tabs\)/alerts.tsx
git commit -m "refactor: extract TabSwitcher to components/alerts/"
```

---

## Task 2: Extract AlertCard

**Files:**
- Create: `components/alerts/alert-card.tsx`
- Modify: `app/(tabs)/alerts.tsx:608-702` (remove inline JSX, use component)

- [ ] **Step 1: Create `components/alerts/alert-card.tsx`**

```typescript
import { Text, View, Switch, TouchableOpacity, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { formatPrice } from "@/lib/currency";
import { PriceAlert } from "@/lib/types";

interface AlertCardProps {
  alert: PriceAlert;
  productName: string;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

export function AlertCard({
  alert,
  productName,
  onToggle,
  onDelete,
}: AlertCardProps) {
  const colors = useColors();

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: alert.triggeredAt
          ? colors.success + "44"
          : colors.border,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text
            style={{
              color: colors.foreground,
              fontWeight: "600",
              fontSize: 14,
            }}
            numberOfLines={2}
          >
            {productName}
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 6,
              gap: 6,
            }}
          >
            <IconSymbol name="tag.fill" size={14} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: 13 }}>
              Target: {formatPrice(alert.targetPrice, alert.currency)}
            </Text>
          </View>
          {alert.triggeredAt && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: 4,
                gap: 6,
              }}
            >
              <IconSymbol
                name="checkmark.circle.fill"
                size={14}
                color={colors.success}
              />
              <Text style={{ color: colors.success, fontSize: 12 }}>
                Triggered{" "}
                {new Date(alert.triggeredAt).toLocaleDateString()}
              </Text>
            </View>
          )}
        </View>
        <View style={{ alignItems: "flex-end", gap: 8 }}>
          {!alert.triggeredAt && (
            <Switch
              value={alert.isActive}
              onValueChange={() => onToggle(alert.id)}
              trackColor={{
                false: colors.border,
                true: colors.primary + "88",
              }}
              thumbColor={alert.isActive ? colors.primary : colors.muted}
            />
          )}
          <TouchableOpacity
            onPress={() => onDelete(alert.id)}
            style={{ padding: 4 }}
          >
            <IconSymbol name="trash.fill" size={16} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Update `app/(tabs)/alerts.tsx` to use AlertCard**

Remove lines 608-702 (the inline alert card renderItem) and replace with:
```typescript
import { AlertCard } from "@/components/alerts/alert-card";

// In the FlatList renderItem:
renderItem={({ item }) => (
  <AlertCard
    alert={item}
    productName={getProductName(item.productId)}
    onToggle={handleToggle}
    onDelete={handleDeleteAlert}
  />
)}
```

- [ ] **Step 3: Run `pnpm check` — 0 errors**

- [ ] **Step 4: Run `pnpm test` — all pass**

- [ ] **Step 5: Commit**

```bash
git add components/alerts/alert-card.tsx app/\(tabs\)/alerts.tsx
git commit -m "refactor: extract AlertCard to components/alerts/"
```

---

## Task 3: Extract TriggeredAlertCard

**Files:**
- Create: `components/alerts/triggered-alert-card.tsx`
- Modify: `app/(tabs)/alerts.tsx:444-571` (remove inline JSX, use component)

- [ ] **Step 1: Create `components/alerts/triggered-alert-card.tsx`**

```typescript
import { Text, View, TouchableOpacity, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { formatPrice } from "@/lib/currency";
import { PriceAlert } from "@/lib/types";

interface TriggeredAlertCardProps {
  alert: PriceAlert;
  productName: string;
  onRearm: (id: string) => void;
  onDelete: (id: string) => void;
}

export function TriggeredAlertCard({
  alert,
  productName,
  onRearm,
  onDelete,
}: TriggeredAlertCardProps) {
  const colors = useColors();

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: colors.success + "44",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text
            style={{
              color: colors.foreground,
              fontWeight: "600",
              fontSize: 14,
            }}
            numberOfLines={2}
          >
            {productName}
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 5,
              gap: 5,
            }}
          >
            <IconSymbol name="tag.fill" size={13} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: 13 }}>
              Target: {formatPrice(alert.targetPrice, alert.currency)}
            </Text>
            {alert.triggeredPrice != null && (
              <Text
                style={{
                  color: colors.success,
                  fontSize: 13,
                  fontWeight: "600",
                }}
              >
                → {formatPrice(alert.triggeredPrice, alert.currency)}
              </Text>
            )}
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 4,
              gap: 5,
            }}
          >
            <IconSymbol
              name="checkmark.circle.fill"
              size={13}
              color={colors.success}
            />
            <Text style={{ color: colors.success, fontSize: 12 }}>
              Triggered{" "}
              {new Date(alert.triggeredAt!).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </Text>
          </View>
        </View>
        <View style={{ alignItems: "flex-end", gap: 8 }}>
          <TouchableOpacity
            onPress={() => onRearm(alert.id)}
            style={{
              backgroundColor: colors.primary + "18",
              borderRadius: 8,
              paddingHorizontal: 8,
              paddingVertical: 4,
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
            }}
          >
            <IconSymbol
              name="arrow.clockwise"
              size={12}
              color={colors.primary}
            />
            <Text
              style={{
                color: colors.primary,
                fontSize: 12,
                fontWeight: "600",
              }}
            >
              Watch Again
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onDelete(alert.id)}
            style={{ padding: 4 }}
          >
            <IconSymbol name="trash.fill" size={15} color={colors.muted} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Update `app/(tabs)/alerts.tsx` to use TriggeredAlertCard**

Remove lines 444-571 (the inline triggered alert map) and replace with:
```typescript
import { TriggeredAlertCard } from "@/components/alerts/triggered-alert-card";

// In the ListFooterComponent:
{triggeredAlerts.map((item) => (
  <TriggeredAlertCard
    key={item.id}
    alert={item}
    productName={getProductName(item.productId)}
    onRearm={handleRearmAlert}
    onDelete={handleDeleteAlert}
  />
))}
```

- [ ] **Step 3: Run `pnpm check` — 0 errors**

- [ ] **Step 4: Run `pnpm test` — all pass**

- [ ] **Step 5: Commit**

```bash
git add components/alerts/triggered-alert-card.tsx app/\(tabs\)/alerts.tsx
git commit -m "refactor: extract TriggeredAlertCard to components/alerts/"
```

---

## Task 4: Extract StockWatchCard

**Files:**
- Create: `components/alerts/stock-watch-card.tsx`
- Modify: `app/(tabs)/alerts.tsx:751-869` (remove inline JSX, use component)

- [ ] **Step 1: Create `components/alerts/stock-watch-card.tsx`**

```typescript
import { Text, View, TouchableOpacity } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BackOrderReminder } from "@/lib/types";

interface StockWatchCardProps {
  watch: BackOrderReminder;
  onDelete: (watch: BackOrderReminder) => void;
}

export function StockWatchCard({ watch, onDelete }: StockWatchCardProps) {
  const colors = useColors();

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: colors.warning + "44",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text
            style={{
              color: colors.foreground,
              fontWeight: "600",
              fontSize: 14,
            }}
            numberOfLines={2}
          >
            {watch.productName}
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 5,
              gap: 5,
            }}
          >
            <IconSymbol name="globe" size={13} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: 13 }}>
              {watch.distributorName}
            </Text>
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 4,
              gap: 5,
            }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor:
                  watch.lastKnownStatus === "in_stock"
                    ? colors.success
                    : colors.warning,
              }}
            />
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {watch.lastKnownStatus === "back_order"
                ? "Back Order"
                : watch.lastKnownStatus === "out_of_stock"
                  ? "Out of Stock"
                  : watch.lastKnownStatus === "in_stock"
                    ? "In Stock"
                    : "Unknown"}
            </Text>
            <Text
              style={{
                color: colors.muted,
                fontSize: 12,
                opacity: 0.6,
              }}
            >
              · last checked
            </Text>
          </View>
        </View>
        <View style={{ alignItems: "flex-end", gap: 8 }}>
          <View
            style={{
              backgroundColor: colors.warning + "22",
              borderRadius: 8,
              paddingHorizontal: 8,
              paddingVertical: 3,
            }}
          >
            <Text
              style={{
                color: colors.warning,
                fontSize: 11,
                fontWeight: "600",
              }}
            >
              👀 Watching
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => onDelete(watch)}
            style={{ padding: 4 }}
          >
            <IconSymbol name="trash.fill" size={16} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Update `app/(tabs)/alerts.tsx` to use StockWatchCard**

Remove lines 751-869 (the inline stock watch map) and replace with:
```typescript
import { StockWatchCard } from "@/components/alerts/stock-watch-card";

// In the ListHeaderComponent:
{stockWatches.map((watch) => (
  <StockWatchCard
    key={watch.id}
    watch={watch}
    onDelete={handleRemoveStockWatch}
  />
))}
```

- [ ] **Step 3: Run `pnpm check` — 0 errors**

- [ ] **Step 4: Run `pnpm test` — all pass**

- [ ] **Step 5: Commit**

```bash
git add components/alerts/stock-watch-card.tsx app/\(tabs\)/alerts.tsx
git commit -m "refactor: extract StockWatchCard to components/alerts/"
```

---

## Task 5: Extract ReminderCard

**Files:**
- Create: `components/alerts/reminder-card.tsx`
- Modify: `app/(tabs)/alerts.tsx:934-1063` (remove inline JSX, use component)

- [ ] **Step 1: Create `components/alerts/reminder-card.tsx`**

```typescript
import { Text, View, TouchableOpacity, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BackOrderReminder } from "@/lib/types";

interface ReminderCardProps {
  reminder: BackOrderReminder;
  onReschedule: (reminder: BackOrderReminder) => void;
  onDelete: (reminder: BackOrderReminder) => void;
}

export function ReminderCard({
  reminder,
  onReschedule,
  onDelete,
}: ReminderCardProps) {
  const colors = useColors();
  const reminderDate = new Date(reminder.reminderDate);
  const isPast = reminderDate < new Date();

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: isPast ? colors.warning + "44" : colors.border,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text
            style={{
              color: colors.foreground,
              fontWeight: "600",
              fontSize: 14,
            }}
            numberOfLines={2}
          >
            {reminder.productName}
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 5,
              gap: 5,
            }}
          >
            <IconSymbol name="globe" size={13} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: 13 }}>
              {reminder.distributorName}
            </Text>
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 4,
              gap: 5,
            }}
          >
            <IconSymbol
              name="calendar"
              size={13}
              color={isPast ? colors.warning : colors.primary}
            />
            <Text
              style={{
                color: isPast ? colors.warning : colors.primary,
                fontSize: 13,
                fontWeight: "500",
              }}
            >
              {isPast ? "Was due " : "Remind on "}
              {reminderDate.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </Text>
          </View>
        </View>
        <View style={{ alignItems: "flex-end", gap: 8 }}>
          {isPast && (
            <View
              style={{
                backgroundColor: colors.warning + "22",
                borderRadius: 8,
                paddingHorizontal: 8,
                paddingVertical: 3,
              }}
            >
              <Text
                style={{
                  color: colors.warning,
                  fontSize: 11,
                  fontWeight: "600",
                }}
              >
                Past Due
              </Text>
            </View>
          )}
          <TouchableOpacity
            onPress={() => {
              if (Platform.OS !== "web")
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onReschedule(reminder);
            }}
            style={{ padding: 4 }}
          >
            <IconSymbol name="pencil" size={16} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onDelete(reminder)}
            style={{ padding: 4 }}
          >
            <IconSymbol name="trash.fill" size={16} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Update `app/(tabs)/alerts.tsx` to use ReminderCard**

Remove lines 934-1063 (the inline reminder renderItem) and replace with:
```typescript
import { ReminderCard } from "@/components/alerts/reminder-card";

// In the FlatList renderItem:
renderItem={({ item }) => (
  <ReminderCard
    reminder={item}
    onReschedule={(r) => {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      setRescheduleDate(nextWeek);
      setShowReschedulePicker(false);
      setRescheduleTarget(r);
    }}
    onDelete={handleDeleteReminder}
  />
)}
```

- [ ] **Step 3: Run `pnpm check` — 0 errors**

- [ ] **Step 4: Run `pnpm test` — all pass**

- [ ] **Step 5: Commit**

```bash
git add components/alerts/reminder-card.tsx app/\(tabs\)/alerts.tsx
git commit -m "refactor: extract ReminderCard to components/alerts/"
```

---

## Task 6: Extract RescheduleModal

**Files:**
- Create: `components/alerts/reschedule-modal.tsx`
- Modify: `app/(tabs)/alerts.tsx:1072-1197` (remove inline JSX, use component)

- [ ] **Step 1: Create `components/alerts/reschedule-modal.tsx`**

```typescript
import { Text, View, TouchableOpacity, Modal, Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import DateTimePicker from "@react-native-community/datetimepicker";
import { BackOrderReminder } from "@/lib/types";

interface RescheduleModalProps {
  visible: boolean;
  target: BackOrderReminder | null;
  date: Date;
  showPicker: boolean;
  onDateChange: (date: Date) => void;
  onShowPicker: (show: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RescheduleModal({
  visible,
  target,
  date,
  showPicker,
  onDateChange,
  onShowPicker,
  onConfirm,
  onCancel,
}: RescheduleModalProps) {
  const colors = useColors();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      >
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
          }}
        >
          <Text
            style={{
              color: colors.foreground,
              fontSize: 20,
              fontWeight: "700",
              marginBottom: 4,
            }}
          >
            Reschedule Reminder 📅
          </Text>
          <Text
            style={{ color: colors.muted, fontSize: 14, marginBottom: 20 }}
          >
            Choose a new date for{" "}
            <Text style={{ fontWeight: "600", color: colors.foreground }}>
              {target?.distributorName}
            </Text>{" "}
            · {target?.productName}
          </Text>
          <TouchableOpacity
            onPress={() => onShowPicker(true)}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 20,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              <IconSymbol name="calendar" size={20} color={colors.primary} />
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 17,
                  fontWeight: "600",
                }}
              >
                {date.toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </Text>
            </View>
            <IconSymbol
              name="chevron.right"
              size={16}
              color={colors.muted}
            />
          </TouchableOpacity>
          {showPicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display={Platform.OS === "ios" ? "inline" : "default"}
              minimumDate={new Date()}
              onChange={(_, selected) => {
                onShowPicker(Platform.OS === "ios");
                if (selected) onDateChange(selected);
              }}
            />
          )}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity
              onPress={onCancel}
              style={{
                flex: 1,
                backgroundColor: colors.surface,
                borderRadius: 14,
                paddingVertical: 14,
                alignItems: "center",
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text
                style={{ color: colors.foreground, fontWeight: "600" }}
              >
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onConfirm}
              style={{
                flex: 1,
                backgroundColor: colors.primary,
                borderRadius: 14,
                paddingVertical: 14,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "600" }}>
                Reschedule
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
```

- [ ] **Step 2: Update `app/(tabs)/alerts.tsx` to use RescheduleModal**

Remove lines 1072-1197 (the inline reschedule modal) and replace with:
```typescript
import { RescheduleModal } from "@/components/alerts/reschedule-modal";

// In the render:
<RescheduleModal
  visible={!!rescheduleTarget}
  target={rescheduleTarget}
  date={rescheduleDate}
  showPicker={showReschedulePicker}
  onDateChange={setRescheduleDate}
  onShowPicker={setShowReschedulePicker}
  onConfirm={handleReschedule}
  onCancel={() => {
    setRescheduleTarget(null);
    setShowReschedulePicker(false);
  }}
/>
```

- [ ] **Step 3: Run `pnpm check` — 0 errors**

- [ ] **Step 4: Run `pnpm test` — all pass**

- [ ] **Step 5: Commit**

```bash
git add components/alerts/reschedule-modal.tsx app/\(tabs\)/alerts.tsx
git commit -m "refactor: extract RescheduleModal to components/alerts/"
```

---

## Task 7: Extract useAlertsData hook + cleanup

**Files:**
- Create: `hooks/use-alerts-data.ts`
- Modify: `app/(tabs)/alerts.tsx` (use hook, remove inline state/callbacks)
- Modify: `todo.md` (add Phase 71)

- [ ] **Step 1: Create `hooks/use-alerts-data.ts`**

```typescript
import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { ActiveTab } from "@/components/alerts/tab-switcher";
import {
  getAlerts,
  removeAlert,
  toggleAlert,
  getWatchlist,
  getBackOrderReminders,
  removeBackOrderReminder,
  addBackOrderReminder,
  getStockWatches,
  removeStockWatch,
  rearmAlert,
  getUnreadNotificationCount,
} from "@/lib/storage";
import { PriceAlert, Product, BackOrderReminder } from "@/lib/types";
import { convertPrice } from "@/lib/currency";
import { showAlert } from "@/lib/alert";
import {
  cancelNotification,
  scheduleBackOrderReminder,
} from "@/lib/notifications";

export function useAlertsData() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("alerts");
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [reminders, setReminders] = useState<BackOrderReminder[]>([]);
  const [stockWatches, setStockWatches] = useState<BackOrderReminder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [rescheduleTarget, setRescheduleTarget] =
    useState<BackOrderReminder | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<Date>(new Date());
  const [showReschedulePicker, setShowReschedulePicker] = useState(false);

  const loadData = useCallback(async () => {
    const [a, p, r, w, n] = await Promise.all([
      getAlerts(),
      getWatchlist(),
      getBackOrderReminders(),
      getStockWatches(),
      getUnreadNotificationCount(),
    ]);
    setAlerts(a);
    setProducts(p);
    setReminders(r);
    setStockWatches(w);
    setUnreadNotifications(n);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleToggle = useCallback(
    async (alertId: string) => {
      if (Platform.OS !== "web")
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await toggleAlert(alertId);
      await loadData();
    },
    [loadData],
  );

  const handleDeleteAlert = useCallback(
    async (alertId: string) => {
      if (Platform.OS !== "web")
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await removeAlert(alertId);
      await loadData();
    },
    [loadData],
  );

  const handleDeleteReminder = useCallback(
    async (reminder: BackOrderReminder) => {
      showAlert(
        "Cancel Reminder",
        `Cancel the reminder for ${reminder.productName} at ${reminder.distributorName}?`,
        [
          { text: "Keep", style: "cancel" },
          {
            text: "Cancel Reminder",
            style: "destructive",
            onPress: async () => {
              if (Platform.OS !== "web")
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Warning,
                );
              if (reminder.notificationId) {
                await cancelNotification(reminder.notificationId);
              }
              await removeBackOrderReminder(reminder.id);
              await loadData();
            },
          },
        ],
      );
    },
    [loadData],
  );

  const handleRemoveStockWatch = useCallback(
    async (watch: BackOrderReminder) => {
      showAlert(
        "Remove Watch",
        `Stop watching ${watch.distributorName} for ${watch.productName}?`,
        [
          { text: "Keep", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              if (Platform.OS !== "web")
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              await removeStockWatch(watch.id);
              await loadData();
            },
          },
        ],
      );
    },
    [loadData],
  );

  const handleReschedule = useCallback(async () => {
    if (!rescheduleTarget) return;
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (rescheduleTarget.notificationId) {
      await cancelNotification(rescheduleTarget.notificationId);
    }
    const notifId = await scheduleBackOrderReminder(
      rescheduleTarget.productName,
      rescheduleTarget.distributorName,
      rescheduleDate,
    );
    await addBackOrderReminder({
      ...rescheduleTarget,
      reminderDate: rescheduleDate.toISOString(),
      notificationId: notifId ?? undefined,
    });
    if (Platform.OS !== "web")
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setRescheduleTarget(null);
    setShowReschedulePicker(false);
    await loadData();
    showAlert(
      "Reminder Rescheduled ✅",
      `You'll be reminded on ${rescheduleDate.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}.`,
    );
  }, [rescheduleTarget, rescheduleDate, loadData]);

  const handleRearmAlert = useCallback(
    async (alertId: string) => {
      if (Platform.OS !== "web")
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await rearmAlert(alertId);
      await loadData();
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [loadData],
  );

  const getProductName = (productId: string) =>
    products.find((p) => p.id === productId)?.name ?? "Unknown Product";

  const triggeredAlerts = alerts.filter((a) => a.triggeredAt);

  const totalSaved = triggeredAlerts.reduce((sum, a) => {
    if (a.triggeredPrice != null) {
      const savedUsd = convertPrice(
        Math.max(0, a.targetPrice - a.triggeredPrice),
        a.currency,
        "USD",
      );
      return sum + savedUsd;
    }
    return sum;
  }, 0);

  const tabCount = {
    alerts: alerts.length,
    reminders: reminders.length + stockWatches.length,
    notifications: unreadNotifications,
  };

  return {
    activeTab,
    setActiveTab,
    alerts,
    reminders,
    stockWatches,
    products,
    refreshing,
    onRefresh,
    unreadNotifications,
    setUnreadNotifications,
    handleToggle,
    handleDeleteAlert,
    handleDeleteReminder,
    handleRemoveStockWatch,
    handleReschedule,
    handleRearmAlert,
    getProductName,
    triggeredAlerts,
    totalSaved,
    tabCount,
    rescheduleTarget,
    setRescheduleTarget,
    rescheduleDate,
    setRescheduleDate,
    showReschedulePicker,
    setShowReschedulePicker,
  };
}
```

- [ ] **Step 2: Update `app/(tabs)/alerts.tsx` to use the hook**

Replace all state hooks and callbacks with:
```typescript
import { useAlertsData } from "@/hooks/use-alerts-data";

export default function AlertsScreen() {
  const router = useRouter();
  const colors = useColors();
  const {
    activeTab, setActiveTab,
    alerts, reminders, stockWatches, products,
    refreshing, onRefresh,
    unreadNotifications, setUnreadNotifications,
    handleToggle, handleDeleteAlert, handleDeleteReminder,
    handleRemoveStockWatch, handleReschedule, handleRearmAlert,
    getProductName, triggeredAlerts, totalSaved, tabCount,
    rescheduleTarget, setRescheduleTarget,
    rescheduleDate, setRescheduleDate,
    showReschedulePicker, setShowReschedulePicker,
  } = useAlertsData();

  // ... render section (now ~350 lines with all cards extracted)
}
```

- [ ] **Step 3: Remove unused imports from `app/(tabs)/alerts.tsx`**

Remove: `useState`, `useCallback`, `useEffect`, `Platform`, `Haptics`, `showAlert`, `getAlerts`, `removeAlert`, `toggleAlert`, `getWatchlist`, `getBackOrderReminders`, `removeBackOrderReminder`, `addBackOrderReminder`, `getStockWatches`, `removeStockWatch`, `rearmAlert`, `getUnreadNotificationCount`, `PriceAlert`, `Product`, `BackOrderReminder`, `convertPrice`, `cancelNotification`, `scheduleBackOrderReminder`, `DateTimePicker`.

- [ ] **Step 4: Update `todo.md`**

Append Phase 71 section:
```
## Phase 71: Alerts Screen Refactor (v5.19)

- [x] Extract TabSwitcher to components/alerts/
- [x] Extract AlertCard to components/alerts/
- [x] Extract TriggeredAlertCard to components/alerts/
- [x] Extract StockWatchCard to components/alerts/
- [x] Extract ReminderCard to components/alerts/
- [x] Extract RescheduleModal to components/alerts/
- [x] Extract useAlertsData hook to hooks/
- [x] Refactor main component to composition root
```

- [ ] **Step 5: Run `pnpm check` — 0 errors**

- [ ] **Step 6: Run `pnpm test` — all pass**

- [ ] **Step 7: Run `wc -l app/\(tabs\)/alerts.tsx` — should be ~350-400 lines**

- [ ] **Step 8: Commit and push**

```bash
git add app/\(tabs\)/alerts.tsx hooks/use-alerts-data.ts todo.md
git commit -m "refactor: extract useAlertsData hook, cleanup alerts.tsx"
git push origin main
```

---

## Summary

| File | Before | After |
|------|--------|-------|
| `app/(tabs)/alerts.tsx` | 1,200 | ~350-400 |
| New: `components/alerts/` (6 files) | — | ~660 |
| New: `hooks/use-alerts-data.ts` | — | ~180 |
| **Net** | 1,200 | ~1,190 |

**Key metrics:**
- alerts.tsx: 67-71% reduction
- 6 new component files + 1 hook
- Same decomposition pattern as watchlist/settings
