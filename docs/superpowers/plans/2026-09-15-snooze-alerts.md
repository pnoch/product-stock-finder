# Snooze Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users pause a price alert for 1/7/30 days; both evaluators skip snoozed alerts. Also fix the discovered `direction` passthrough bug in the notification config upload.

**Architecture:** `PriceAlert.snoozedUntil?: string` (ISO). New storage method `snoozeAlert(alertId, days)`; both evaluators skip alerts whose `snoozedUntil > now`; AlertCard gains a moon button with a day-choice sheet; the config upload mapping gains `direction` + `snoozedUntil`.

**Tech Stack:** TypeScript strict, vitest, React Native, tRPC/Zod.

---

## File Structure

| File | Change |
|------|--------|
| `lib/types.ts` | `PriceAlert.snoozedUntil?: string` |
| `lib/storage/alerts.ts` | `snoozeAlert` |
| `lib/storage/index.ts` | compose + named export |
| `lib/background-tasks/price-check.ts` | skip snoozed |
| `lib/server-notifications.ts` | direction + snoozedUntil passthrough |
| `server/routers.ts`, `server/notifications/types.ts` | schema/type fields |
| `server/notifications/build-events.ts` | skip snoozed |
| `components/alerts/alert-card.tsx` | moon button + badge + dim |
| `app/(tabs)/alerts.tsx`, `hooks/use-alerts-data.ts` | handler + wiring |
| `todo.md` | append Phase 99 |

---

## Task 1: Snooze end-to-end

**Files:** all of the above except todo.md steps split at the end.

- [ ] **Step 1: Type**

`lib/types.ts` — add to PriceAlert:
```typescript
  snoozedUntil?: string;
```

- [ ] **Step 2: Storage method**

In `lib/storage/alerts.ts`, add inside the factory (following toggleAlert's pattern):

```typescript
  async function snoozeAlert(alertId: string, days: number): Promise<void> {
    await enqueue(KEYS.ALERTS, async () => {
      const alerts = await getAlerts();
      const updated = alerts.map((a) =>
        a.id === alertId
          ? {
              ...a,
              snoozedUntil:
                days > 0
                  ? new Date(Date.now() + days * 86400000).toISOString()
                  : undefined,
            }
          : a,
      );
      await saveAlerts(updated);
      notify("alerts", alertId);
    });
  }
```

Add `snoozeAlert` to the returned object and to `lib/storage/index.ts` composition + named exports destructuring.

- [ ] **Step 3: Client evaluator skip**

In `lib/background-tasks/price-check.ts`, change:

```typescript
  const activeAlerts = alerts.filter((a) => a.isActive && !a.triggeredAt);
```

to:

```typescript
  const now = Date.now();
  const activeAlerts = alerts.filter(
    (a) =>
      a.isActive &&
      !a.triggeredAt &&
      (!a.snoozedUntil || new Date(a.snoozedUntil).getTime() <= now),
  );
```

- [ ] **Step 4: Server skip + passthrough**

1. `server/notifications/types.ts` — alerts entries gain:
```typescript
    direction?: "drop" | "rise";
    snoozedUntil?: string;
```
2. `server/routers.ts` uploadConfig Zod alerts object gains the same two optional fields.
3. `server/notifications/build-events.ts` — in the `config.alerts` loop, after the product lookup add:
```typescript
    if (
      alert.snoozedUntil &&
      new Date(alert.snoozedUntil).getTime() > now
    ) {
      continue;
    }
```
(`now` is the buildEvents timestamp parameter — verify its local name.)

- [ ] **Step 5: Direction/snooze passthrough fix**

In `lib/server-notifications.ts` (~line 97), extend the client mapping:

```typescript
      .map((a) => ({
        id: a.id,
        productId: a.productId,
        targetPrice: a.targetPrice,
        currency: a.currency,
        distributorId: a.distributorId,
        direction: a.direction,
        snoozedUntil: a.snoozedUntil,
      }));
```

- [ ] **Step 6: UI**

1. `components/alerts/alert-card.tsx`:
   - New prop `onSnooze?: (id: string) => void`.
   - Compute `snoozed = alert.snoozedUntil && new Date(alert.snoozedUntil) > new Date()`.
   - Card container style: add `opacity: snoozed ? 0.6 : 1`.
   - Under the target row (after the distributor badge from Phase 86):
   ```tsx
          {snoozed && (
            <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
              😴 Snoozed until{" "}
              {new Date(alert.snoozedUntil!).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </Text>
          )}
   ```
   - Next to the delete button (locate the existing delete TouchableOpacity in the card header area), add a moon button:
   ```tsx
            <TouchableOpacity
              onPress={() => onSnooze?.(alert.id)}
              style={{ padding: 6 }}
            >
              <IconSymbol name="moon.zzz.fill" size={16} color={colors.muted} />
            </TouchableOpacity>
   ```
   ICON CHECK: verify/add `"moon.zzz.fill": "bedtime"` in icon-symbol mappings.

2. `hooks/use-alerts-data.ts`: import `snoozeAlert` from `@/lib/storage`; add:

```typescript
  const handleSnoozeAlert = useCallback(
    async (alertId: string) => {
      showAlert(
        "Snooze Alert",
        "Pause notifications for this alert.",
        [
          { text: "1 day", onPress: () => void snoozeAlert(alertId, 1) },
          { text: "7 days", onPress: () => void snoozeAlert(alertId, 7) },
          { text: "30 days", onPress: () => void snoozeAlert(alertId, 30) },
          { text: "Wake now", onPress: () => void snoozeAlert(alertId, 0) },
          { text: "Cancel", style: "cancel" as const },
        ],
      );
      void loadAlerts();
    },
    [loadAlerts],
  );
```

(Adapt to the hook's actual refresh function name and showAlert import pattern; return `handleSnoozeAlert` from the hook.)

3. `app/(tabs)/alerts.tsx`: destructure `handleSnoozeAlert` from the hook; pass `onSnooze={handleSnoozeAlert}` to `<AlertCard … />`.

- [ ] **Step 7: Verify**

Run: `pnpm check` — 0 errors. Run: `pnpm lint` — no new errors. Run: `pnpm test` — all pass.

- [ ] **Step 8: Update `todo.md` + commit + push**

Append Phase 99 section:

```markdown
## Phase 99: Snooze Alerts (v5.47)

- [x] Add snoozedUntil field + snoozeAlert storage method
- [x] Skip snoozed alerts in client + server evaluation
- [x] Fix direction passthrough in notification config upload
- [x] Add snooze button, choice sheet, and snoozed badge on alert cards
```

Then:

```bash
git add lib/types.ts lib/storage lib/background-tasks/price-check.ts lib/server-notifications.ts server/routers.ts server/notifications/types.ts server/notifications/build-events.ts components/alerts/alert-card.tsx hooks/use-alerts-data.ts app/\(tabs\)/alerts.tsx todo.md && git commit -m "feat: add snooze for price alerts"
git push origin main
```

---

## Summary

| Metric | Value |
|--------|-------|
| Type change | `snoozedUntil?: string` (backward-compatible) |
| Bug fixed | direction stripped from config upload |
| UI | moon button + day-choice sheet + snoozed badge/dim |
