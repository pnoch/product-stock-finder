# Phase 71: Alerts Screen Refactor — Design Spec

## Goal

Break `app/(tabs)/alerts.tsx` (1,200 lines) into smaller components following the same decomposition pattern used in Phase 69 (Settings) and Phase 70 (Watchlist).

## Current State

`alerts.tsx` contains:
- 10 state hooks (activeTab, alerts, reminders, stockWatches, products, refreshing, unreadNotifications, rescheduleTarget, rescheduleDate, showReschedulePicker)
- 9 callbacks (loadData, onRefresh, handleToggle, handleDeleteAlert, handleDeleteReminder, handleRemoveStockWatch, handleReschedule, handleRearmAlert, getProductName)
- 4 render sections: Alerts tab (~377 lines), Reminders tab (~360 lines), Notifications tab (delegates to NotificationCenter), Reschedule modal (~126 lines)

## Approach: Full Decomposition

Extract 6 presentational components + 1 custom hook into `components/alerts/`.

## New Files

### `components/alerts/tab-switcher.tsx`
- 3-segment pill (Alerts / Reminders / Notifications) with icons and counts
- Source: lines 264–326 (63 lines)
- Props: `tabs: ActiveTab[], active: ActiveTab, counts: Record<ActiveTab, number>, onChange: (tab: ActiveTab) => void`

### `components/alerts/alert-card.tsx`
- Active price alert card with Switch toggle + delete
- Source: lines 608–702 (95 lines)
- Props: `alert: PriceAlert, productName: string, onToggle: (id: string) => void, onDelete: (id: string) => void`

### `components/alerts/triggered-alert-card.tsx`
- Triggered/price-drop-history alert with re-arm + delete
- Source: lines 444–571 (128 lines)
- Props: `alert: PriceAlert, productName: string, onRearm: (id: string) => void, onDelete: (id: string) => void`

### `components/alerts/stock-watch-card.tsx`
- Restock watch with status dot, watching badge, delete
- Source: lines 751–869 (119 lines)
- Props: `watch: BackOrderReminder, onDelete: (watch: BackOrderReminder) => void`

### `components/alerts/reminder-card.tsx`
- Date reminder with past-due badge, reschedule, delete
- Source: lines 934–1063 (130 lines)
- Props: `reminder: BackOrderReminder, onReschedule: (reminder: BackOrderReminder) => void, onDelete: (reminder: BackOrderReminder) => void`

### `components/alerts/reschedule-modal.tsx`
- Bottom-sheet modal with DateTimePicker + Cancel/Reschedule buttons
- Source: lines 1072–1197 (126 lines)
- Props: `visible: boolean, target: BackOrderReminder | null, date: Date, onDateChange: (date: Date) => void, onConfirm: () => void, onCancel: () => void`

### `hooks/use-alerts-data.ts`
- Custom hook encapsulating all 10 state hooks + loadData + 6 action callbacks
- Returns everything the screen needs in a single call
- All callbacks call loadData() internally after mutation

## Main File After Refactor

`alerts.tsx` becomes ~350–400 lines:
- Imports + hook call (~20 lines)
- Screen header (inline, ~43 lines)
- TabSwitcher usage
- Alerts FlatList (inline — needs products + callbacks, ~200 lines of glue)
- Reminders FlatList (inline — needs products + callbacks, ~150 lines of glue)
- RescheduleModal usage

## Files Not Touched

- `components/notification-center.tsx` — already used as-is for Notifications tab
- `app/restock-watches.tsx` — separate screen, out of scope

## Verification

1. `pnpm check` — 0 errors
2. `pnpm lint` — clean
3. `pnpm test` — all pass
4. `alerts.tsx` reduced from 1,200 → ~350–400 lines (67–71% reduction)
5. 6 new files in `components/alerts/` + 1 new hook in `hooks/`
