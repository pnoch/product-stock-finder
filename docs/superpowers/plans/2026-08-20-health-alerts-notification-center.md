# Health Alerts in the Notification Center (v5.13) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record health outage/recovery notifications into the in-app notification center so users can review them and tap through to the distributor's health drill-down page.

**Architecture:** Add a `"health"` type + `healthStatus` discriminator + optional `productId` to `NotificationHistoryEntry`; record history entries inside `scheduleHealthAlert`/`scheduleHealthRecovery` via the existing `recordNotificationEvent`; render health entries in the notification center with status-dependent icon/color and branch navigation to `/health/[distributorId]`.

**Tech Stack:** TypeScript 5.9 (strict), React Native 0.81, expo-notifications, vitest.

**Spec:** `docs/superpowers/specs/2026-08-20-health-alerts-notification-center-design.md`

---

### Task 1: `NotificationHistoryEntry` type changes

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Update the type**

In `lib/types.ts`, change the `NotificationHistoryEntry` interface (around lines 116-127):

```ts
export interface NotificationHistoryEntry {
  id: string;
  type: "price_drop" | "restock" | "reminder" | "health";
  title: string;
  body: string;
  productId?: string;
  distributorId?: string;
  healthStatus?: "blocked" | "error" | "recovered";
  triggeredPrice?: number;
  currency?: string;
  createdAt: number;
  read: boolean;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm check`
Expected: 0 TypeScript errors. (If any test or component literal constructs a `NotificationHistoryEntry` without `productId`, TypeScript will flag it — fix by adding the field to that literal.)

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat: health type in NotificationHistoryEntry"
```

---

### Task 2: Record history entries in health notifications

**Files:**
- Modify: `lib/notifications.ts`
- Test: `tests/health-notifications.test.ts` (new)

- [ ] **Step 1: Write the failing tests**

Create `tests/health-notifications.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  platform: "ios",
  scheduled: [] as Array<{ content: { title: string; body: string } }>,
  recorded: [] as Array<Record<string, unknown>>,
}));

vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return state.platform;
    },
  },
}));

vi.mock("expo-notifications", () => ({
  scheduleNotificationAsync: vi.fn(
    async (opts: { content: { title: string; body: string } }) => {
      state.scheduled.push(opts);
      return "notif-id";
    },
  ),
}));

vi.mock("../lib/storage", () => ({
  recordDisplayedEventId: vi.fn(),
  recordNotificationEvent: vi.fn(async (event: Record<string, unknown>) => {
    state.recorded.push(event);
  }),
}));

import { scheduleHealthAlert, scheduleHealthRecovery } from "../lib/notifications";

describe("scheduleHealthAlert history recording", () => {
  beforeEach(() => {
    state.platform = "ios";
    state.scheduled.length = 0;
    state.recorded.length = 0;
  });

  it("records a health entry with status blocked after scheduling", async () => {
    await scheduleHealthAlert("Winncom", "blocked", "blocked by site");
    expect(state.recorded).toHaveLength(1);
    const entry = state.recorded[0] as Record<string, unknown>;
    expect(entry.type).toBe("health");
    expect(entry.healthStatus).toBe("blocked");
    expect(entry.distributorId).toBe("Winncom");
    expect(entry.title).toContain("Blocked");
    expect(entry.body).toContain("Winncom");
  });

  it("records a health entry with status error", async () => {
    await scheduleHealthAlert("Winncom", "error");
    const entry = state.recorded[0] as Record<string, unknown>;
    expect(entry.healthStatus).toBe("error");
    expect(entry.title).toContain("Down");
  });

  it("does not record on web", async () => {
    state.platform = "web";
    await scheduleHealthAlert("Winncom", "blocked");
    expect(state.recorded).toHaveLength(0);
  });
});

describe("scheduleHealthRecovery history recording", () => {
  beforeEach(() => {
    state.platform = "ios";
    state.scheduled.length = 0;
    state.recorded.length = 0;
  });

  it("records a health entry with status recovered", async () => {
    await scheduleHealthRecovery("Winncom", "error");
    const entry = state.recorded[0] as Record<string, unknown>;
    expect(entry.type).toBe("health");
    expect(entry.healthStatus).toBe("recovered");
    expect(entry.distributorId).toBe("Winncom");
    expect(entry.title).toContain("Recovered");
  });

  it("does not record on web", async () => {
    state.platform = "web";
    await scheduleHealthRecovery("Winncom", "error");
    expect(state.recorded).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/health-notifications.test.ts`
Expected: FAIL — `scheduleHealthAlert`/`scheduleHealthRecovery` don't call `recordNotificationEvent` yet.

- [ ] **Step 3: Implement recording**

In `lib/notifications.ts`, add `recordNotificationEvent` to the storage import:

```ts
import { recordDisplayedEventId, recordNotificationEvent } from "./storage";
```

In `scheduleHealthAlert`, after the `scheduleNotificationAsync` call succeeds (inside the try, after `const id = ...`), add:

```ts
    await recordNotificationEvent({
      id: `health-${distributorName}-${Date.now()}`,
      type: "health",
      title:
        status === "blocked" ? "🟠 Distributor Blocked" : "🔴 Distributor Down",
      body: `${distributorName} has been ${status} for ${HEALTH_ALERT_THRESHOLD} consecutive probes${reason ? ` — ${reason}` : ""}`,
      distributorId: distributorName,
      healthStatus: status,
      createdAt: Date.now(),
    });
```

In `scheduleHealthRecovery`, after the `scheduleNotificationAsync` call succeeds, add:

```ts
    await recordNotificationEvent({
      id: `health-${distributorName}-${Date.now()}`,
      type: "health",
      title: "🟢 Distributor Recovered",
      body: `${distributorName} is back online after being ${status}`,
      distributorId: distributorName,
      healthStatus: "recovered",
      createdAt: Date.now(),
    });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/health-notifications.test.ts`
Expected: PASS (all 5 tests).

- [ ] **Step 5: Typecheck + lint**

Run: `pnpm check`
Expected: 0 TypeScript errors.

Run: `pnpm lint`
Expected: clean (only pre-existing MODULE_TYPELESS warning).

- [ ] **Step 6: Commit**

```bash
git add lib/notifications.ts tests/health-notifications.test.ts
git commit -m "feat: record health notifications in history"
```

---

### Task 3: Notification center rendering + navigation

**Files:**
- Create: `lib/notification-center-helpers.ts`
- Modify: `components/notification-center.tsx`
- Test: `tests/notification-center-helpers.test.ts` (new)

NOTE: The pure helpers live in a standalone `lib/notification-center-helpers.ts` module (not inside the component file). Importing them from the component file would load its heavy module graph (expo-symbols, expo-router, expo-haptics, storage), which fails to parse in the vitest node environment. The component imports the helpers from this module.

- [ ] **Step 1: Write the failing tests**

Create `tests/notification-center-helpers.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { healthColor, healthIcon } from "../lib/notification-center-helpers";

describe("healthIcon", () => {
  it("returns checkmark for recovered", () => {
    expect(healthIcon("recovered")).toBe("checkmark.circle.fill");
  });

  it("returns warning triangle for blocked", () => {
    expect(healthIcon("blocked")).toBe("exclamationmark.triangle.fill");
  });

  it("returns warning triangle for error", () => {
    expect(healthIcon("error")).toBe("exclamationmark.triangle.fill");
  });

  it("returns warning triangle when status is undefined", () => {
    expect(healthIcon(undefined)).toBe("exclamationmark.triangle.fill");
  });
});

describe("healthColor", () => {
  it("returns success for recovered", () => {
    expect(healthColor("recovered")).toBe("success");
  });

  it("returns warning for blocked", () => {
    expect(healthColor("blocked")).toBe("warning");
  });

  it("returns warning for error", () => {
    expect(healthColor("error")).toBe("warning");
  });

  it("returns warning when status is undefined", () => {
    expect(healthColor(undefined)).toBe("warning");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/notification-center-helpers.test.ts`
Expected: FAIL — module `../lib/notification-center-helpers` does not exist.

- [ ] **Step 3: Implement the helpers module**

Create `lib/notification-center-helpers.ts`:

```ts
export type HealthIconName =
  | "checkmark.circle.fill"
  | "exclamationmark.triangle.fill";

export function healthIcon(status?: string): HealthIconName {
  return status === "recovered" ? "checkmark.circle.fill" : "exclamationmark.triangle.fill";
}
export function healthColor(status?: string): "warning" | "success" {
  return status === "recovered" ? "success" : "warning";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/notification-center-helpers.test.ts`
Expected: PASS (all 8 tests).

- [ ] **Step 5: Wire the helpers into the component**

In `components/notification-center.tsx`:

1. Add the import after the existing imports:

```ts
import { healthColor, healthIcon } from "@/lib/notification-center-helpers";
```

2. Extend `TypeIconName` union and `TYPE_ICONS` map:

```ts
type TypeIconName =
  | "dollarsign.circle.fill"
  | "checkmark.circle.fill"
  | "clock.fill"
  | "exclamationmark.triangle.fill";

const TYPE_ICONS: Record<HistoryType, TypeIconName> = {
  price_drop: "dollarsign.circle.fill",
  restock: "checkmark.circle.fill",
  reminder: "clock.fill",
  health: "exclamationmark.triangle.fill",
};
```

3. In `handleOpen`, replace the navigation line:

```ts
      router.push(`/product/${item.productId}`);
```

with:

```ts
      if (item.type === "health") {
        router.push(`/health/${item.distributorId}`);
      } else {
        router.push(`/product/${item.productId}`);
      }
```

4. In `renderItem`, replace the `IconSymbol` block:

```tsx
          <IconSymbol
            name={TYPE_ICONS[item.type]}
            size={22}
            color={item.type === "reminder" ? colors.warning : colors.success}
          />
```

with:

```tsx
          <IconSymbol
            name={
              item.type === "health"
                ? healthIcon(item.healthStatus)
                : TYPE_ICONS[item.type]
            }
            size={22}
            color={
              item.type === "health"
                ? colors[healthColor(item.healthStatus)]
                : item.type === "reminder"
                  ? colors.warning
                  : colors.success
            }
          />
```

- [ ] **Step 6: Typecheck + lint**

Run: `pnpm check`
Expected: 0 TypeScript errors.

Run: `pnpm lint`
Expected: clean (only pre-existing MODULE_TYPELESS warning).

- [ ] **Step 7: Commit**

```bash
git add lib/notification-center-helpers.ts components/notification-center.tsx tests/notification-center-helpers.test.ts
git commit -m "feat: health entries in notification center"
```

---

### Task 4: Docs + full verification

**Files:**
- Modify: `todo.md`

- [ ] **Step 1: Run the full verification suite**

Run: `pnpm check`
Expected: 0 TypeScript errors.

Run: `pnpm lint`
Expected: clean (only pre-existing MODULE_TYPELESS warning).

Run: `pnpm test`
Expected: all pass (existing 809 + new health-notifications + notification-center-helpers tests).

- [ ] **Step 2: Browser smoke test**

With the DB-backed server + HTTPS static server running (see `/tmp/opencode/webpush/run-server-db.sh` and `/tmp/opencode/webpush/https-static.cjs`), rebuild the web export and verify:

```bash
npx expo export -p web --clear
```

Then in headed Chromium at `https://localhost:8443/settings`:
1. The app loads without JS errors.
2. No regression in the notification center (open it if reachable; at minimum verify the settings screen renders).

NOTE: Health history entries only appear after a real outage/recovery fires, which can't be triggered in a smoke test — so this is a regression check only. If the smoke servers are not running or you cannot launch a headed browser, attempt to start them via the scripts in `/tmp/opencode/webpush/`. If you genuinely cannot complete the browser smoke test, report back clearly that it was skipped and why — do NOT fake results.

- [ ] **Step 3: Update `todo.md`**

Append a Phase 65 section at the end of the file:

```markdown
## Phase 65: Health Alerts in Notification Center (v5.13)

- [x] NotificationHistoryEntry gains health type + healthStatus + optional productId
- [x] scheduleHealthAlert/scheduleHealthRecovery record history entries
- [x] Notification center renders health entries (status icon/color) + navigates to /health/[id]
- [x] Tests: health-notifications, notification-center-helpers
```

- [ ] **Step 4: Commit**

```bash
git add todo.md
git commit -m "docs: Phase 65 health alerts notification center (v5.13) in todo.md"
```

---

## Self-Review Notes

- **Spec coverage:** `NotificationHistoryEntry` type changes (Task 1), recording in both schedule functions (Task 2), notification center rendering + navigation (Task 3), docs + verification (Task 4). All three decisions (health drill-down navigation, single "health" type, status-differentiated icon/color) are implemented.
- **Type consistency:** `healthStatus?: "blocked" | "error" | "recovered"` defined in Task 1, written in Task 2 (`healthStatus: status` / `healthStatus: "recovered"`), read in Task 3 (`healthIcon(item.healthStatus)` / `healthColor(item.healthStatus)`). `healthIcon(status?: string)` and `healthColor(status?: string)` defined and exported in the standalone `lib/notification-center-helpers.ts` module (Task 3), imported in both the component and the Task 3 test. `TypeIconName` extended with `"exclamationmark.triangle.fill"` in Task 3 — the icon already exists in `components/ui/icon-symbol.tsx` (maps to Material `"warning"`).
- **Test isolation:** `tests/health-notifications.test.ts` mocks `expo-notifications`, `react-native` Platform, and `lib/storage` (following the `tests/push-event-tracking.test.ts` pattern). `tests/notification-center-helpers.test.ts` imports only the pure helpers from the standalone module — no React/component render needed. The helpers were moved out of the component file because importing the component loads its heavy module graph (expo-symbols, expo-router, expo-haptics, storage), which fails to parse in the vitest node environment (verified).
- **No schema/sync changes:** reads/writes existing `notification_history` storage key only; no server, sync, or settings changes.