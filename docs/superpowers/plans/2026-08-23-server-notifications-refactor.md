# Server Notifications Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Break `server/notifications.ts` (670 lines) into a `server/notifications/` directory of focused modules while preserving the public API and behavior byte-for-byte.

**Architecture:** Convert `server/notifications.ts` → `server/notifications/index.ts` (git mv). Split by responsibility into types / memory-store / mappers / build-events / evaluate, with index holding the public entry points (`upsertDeviceConfig`, `processHealthEvents`, `pullPendingEvents`). Dependency flow has no cycles: types ← {mappers, memory-store, build-events} ← evaluate ← index.

**Tech Stack:** TypeScript strict, Drizzle ORM (MySQL), Express backend, vitest.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `server/notifications/types.ts` | `NotificationConfig`, `NotificationEvent`, `MemoryEvent`, `EventDraft` |
| `server/notifications/memory-store.ts` | 3 module-level Maps + `deliveryCount`, `stripScope`, test/memory helpers |
| `server/notifications/mappers.ts` | `rowToConfig`, `draftToEvent`, `rowToEvent` |
| `server/notifications/build-events.ts` | `newEventId`, `dedupKeyFor`, `dedupKeyForHealth`, `buildEvents` |
| `server/notifications/evaluate.ts` | `evaluateNotifications` + memory/db evaluation paths + `aggregateConfigs` |
| `server/notifications/index.ts` | Public API: `upsertDeviceConfig`, `processHealthEvents`, `pullPendingEvents`; re-exports |

**Public API invariant:** `./notifications` exports exactly these at all times: `upsertDeviceConfig`, `evaluateNotifications`, `pullPendingEvents`, `clearNotificationsForTests`, `listMemoryConfigDevices`, `removeMemoryDevice`, `NotificationConfig` (type), `NotificationEvent` (type). Consumers: `server/routers.ts`, `server/prices.ts`, `server/devices.ts`, plus tests importing `clearNotificationsForTests`.

---

## Task 1: Scaffold directory — types, memory-store, mappers

**Files:**
- Rename: `server/notifications.ts` → `server/notifications/index.ts` (git mv)
- Create: `server/notifications/types.ts`
- Create: `server/notifications/memory-store.ts`
- Create: `server/notifications/mappers.ts`
- Modify: `server/notifications/index.ts`

- [ ] **Step 1: Convert file to directory**

```bash
mkdir -p server/notifications && git mv server/notifications.ts server/notifications/index.ts
```

- [ ] **Step 2: Create `server/notifications/types.ts`**

Move verbatim from index.ts: `NotificationConfig`, `NotificationEvent`, `MemoryEvent`, `EventDraft`:

```typescript
import type { InsertNotificationEventRow } from "../../drizzle/schema";

export interface NotificationConfig {
  alerts: Array<{
    id: string;
    productId: string;
    targetPrice: number;
    currency: string;
    distributorId?: string;
  }>;
  stockWatches: Array<{
    id: string;
    productId: string;
    distributorId: string;
    lastKnownStatus?: string;
  }>;
  dateReminders: Array<{
    id: string;
    productId: string;
    distributorId: string;
    reminderDate: string;
  }>;
  healthEvents?: Array<{
    id: string;
    distributorId: string;
    distributorName: string;
    status: "blocked" | "error";
    title: string;
    body: string;
    createdAt: number;
  }>;
}

export interface NotificationEvent {
  id: string;
  type: "price_drop" | "restock" | "reminder";
  title: string;
  body: string;
  alertId?: string;
  watchId?: string;
  reminderId?: string;
  productId: string;
  distributorId?: string;
  targetPrice?: number;
  currency?: string;
  triggeredPrice?: number;
  createdAt: number;
}

export interface MemoryEvent extends NotificationEvent {
  userId: number | null;
  deviceId: string | null;
  dedupKey?: string;
}

export interface EventDraft extends Omit<
  InsertNotificationEventRow,
  "deviceId" | "userId"
> {
  dedupKey: string;
}
```

- [ ] **Step 3: Create `server/notifications/memory-store.ts`**

Move verbatim: the three Maps, `deliveryCount`, `stripScope`, `clearNotificationsForTests`, `listMemoryConfigDevices`, `removeMemoryDevice`. Export the Maps so evaluate/index can use them directly:

```typescript
import type {
  MemoryEvent,
  NotificationConfig,
  NotificationEvent,
} from "./types";

export const memoryConfigs = new Map<
  string,
  { config: NotificationConfig; userId: number | null }
>();
export const memoryEvents = new Map<string, MemoryEvent>();
export const memoryDeliveries = new Map<string, Set<string>>();

export function deliveryCount(eventId: string): number {
  let count = 0;
  for (const delivered of memoryDeliveries.values()) {
    if (delivered.has(eventId)) count += 1;
  }
  return count;
}

export function clearNotificationsForTests(): void {
  memoryConfigs.clear();
  memoryEvents.clear();
  memoryDeliveries.clear();
}

export function listMemoryConfigDevices(): Array<{
  deviceId: string;
  userId: number | null;
}> {
  return [...memoryConfigs.entries()].map(([deviceId, entry]) => ({
    deviceId,
    userId: entry.userId,
  }));
}

export function removeMemoryDevice(deviceId: string): void {
  memoryConfigs.delete(deviceId);
  memoryDeliveries.delete(deviceId);
  for (const [id, event] of memoryEvents) {
    if (event.deviceId === deviceId) memoryEvents.delete(id);
  }
}

export function stripScope(event: MemoryEvent): NotificationEvent {
  return {
    id: event.id,
    type: event.type,
    title: event.title,
    body: event.body,
    alertId: event.alertId,
    watchId: event.watchId,
    reminderId: event.reminderId,
    productId: event.productId,
    distributorId: event.distributorId,
    targetPrice: event.targetPrice,
    currency: event.currency,
    triggeredPrice: event.triggeredPrice,
    createdAt: event.createdAt,
  };
}
```

- [ ] **Step 4: Create `server/notifications/mappers.ts`**

Move verbatim: `rowToConfig`, `draftToEvent`, `rowToEvent`:

```typescript
import type { EventDraft, NotificationConfig, NotificationEvent } from "./types";

export function rowToConfig(row: {
  alerts: unknown;
  stockWatches: unknown;
  dateReminders: unknown;
}): NotificationConfig {
  return {
    alerts: (row.alerts as NotificationConfig["alerts"]) ?? [],
    stockWatches:
      (row.stockWatches as NotificationConfig["stockWatches"]) ?? [],
    dateReminders:
      (row.dateReminders as NotificationConfig["dateReminders"]) ?? [],
  };
}

export function draftToEvent(draft: EventDraft): NotificationEvent {
  const payload = (draft.payload ?? {}) as Record<string, unknown>;
  return {
    id: draft.id,
    type: draft.type as NotificationEvent["type"],
    title: draft.title,
    body: draft.body,
    alertId: payload.alertId as string | undefined,
    watchId: payload.watchId as string | undefined,
    reminderId: payload.reminderId as string | undefined,
    productId: payload.productId as string,
    distributorId: payload.distributorId as string | undefined,
    targetPrice: payload.targetPrice as number | undefined,
    currency: payload.currency as string | undefined,
    triggeredPrice: payload.triggeredPrice as number | undefined,
    createdAt: draft.createdAt,
  };
}

export function rowToEvent(row: {
  id: string;
  type: string;
  title: string;
  body: string;
  payload: unknown;
  createdAt: number;
}): NotificationEvent {
  const payload = (row.payload ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    type: row.type as NotificationEvent["type"],
    title: row.title,
    body: row.body,
    alertId: payload.alertId as string | undefined,
    watchId: payload.watchId as string | undefined,
    reminderId: payload.reminderId as string | undefined,
    productId: payload.productId as string,
    distributorId: payload.distributorId as string | undefined,
    targetPrice: payload.targetPrice as number | undefined,
    currency: payload.currency as string | undefined,
    triggeredPrice: payload.triggeredPrice as number | undefined,
    createdAt: row.createdAt,
  };
}
```

- [ ] **Step 5: Update `server/notifications/index.ts`**

1. Delete the moved definitions (`NotificationConfig`, `NotificationEvent`, `MemoryEvent`, `EventDraft` interfaces; the three Map declarations; `deliveryCount`; `stripScope`; `clearNotificationsForTests`; `listMemoryConfigDevices`; `removeMemoryDevice`; `rowToConfig`; `draftToEvent`; `rowToEvent`).
2. Add imports at top:

```typescript
import type { NotificationConfig, NotificationEvent } from "./types";
import {
  memoryConfigs,
  memoryDeliveries,
  memoryEvents,
  clearNotificationsForTests,
  listMemoryConfigDevices,
  removeMemoryDevice,
  stripScope,
} from "./memory-store";
import { rowToConfig, draftToEvent, rowToEvent } from "./mappers";
```

3. Re-export the public surface so consumers stay unchanged:

```typescript
export type { NotificationConfig, NotificationEvent } from "./types";
export {
  clearNotificationsForTests,
  listMemoryConfigDevices,
  removeMemoryDevice,
} from "./memory-store";
```

4. Everything else stays inline for now (`newEventId`, `dedupKeyForHealth`, `processHealthEvents`, `upsertDeviceConfig`, `evaluateNotifications` + helpers, `aggregateConfigs`, `dedupKeyFor`, `buildEvents`, `pullPendingEvents`). Remove imports that became unused (`InsertDeviceNotificationConfigRow` stays — still used by upsert).

- [ ] **Step 6: Verify**

Run: `pnpm check` — 0 errors.
Run: `pnpm test` — all pass.

- [ ] **Step 7: Commit**

```bash
git add server/notifications && git commit -m "refactor: scaffold server/notifications directory (types, memory store, mappers)"
```

---

## Task 2: Extract build-events

**Files:**
- Create: `server/notifications/build-events.ts`
- Modify: `server/notifications/index.ts`

- [ ] **Step 1: Create `server/notifications/build-events.ts`**

Move verbatim: `newEventId`, `dedupKeyForHealth`, `dedupKeyFor`, `buildEvents`:

```typescript
import { PRODUCT_CATALOG } from "../../lib/catalog";
import { getDistributorById } from "../../lib/distributors";
import { getAllParserIds } from "../../lib/scrapers/registry";
import { getCachedPrice } from "../price-cache";
import { convertPrice, formatPrice } from "../../lib/currency";
import type { EventDraft, NotificationConfig, NotificationEvent } from "./types";

// ... paste newEventId, dedupKeyForHealth, dedupKeyFor, buildEvents verbatim ...

export { newEventId, dedupKeyForHealth, dedupKeyFor, buildEvents };
```

(Adjust import paths: original file used `"../lib/catalog"` etc.; from the subdirectory they become `"../../lib/catalog"`, `"../price-cache"`.)

- [ ] **Step 2: Update `server/notifications/index.ts`**

1. Delete the four moved functions.
2. Add: `import { dedupKeyForHealth, dedupKeyFor } from "./build-events";`
   (`processHealthEvents` uses `dedupKeyForHealth`; `evaluateAnonMemory`/`evaluateUserMemory` use `dedupKeyFor`.)
3. Remove now-unused imports (`PRODUCT_CATALOG`, `getDistributorById`, `getAllParserIds`, `getCachedPrice`, `convertPrice`, `formatPrice`) if nothing else in index uses them.

- [ ] **Step 3: Verify**

Run: `pnpm check` — 0 errors. Run: `pnpm test` — all pass.

- [ ] **Step 4: Commit**

```bash
git add server/notifications && git commit -m "refactor: extract build-events module"
```

---

## Task 3: Extract evaluate

**Files:**
- Create: `server/notifications/evaluate.ts`
- Modify: `server/notifications/index.ts`

- [ ] **Step 1: Create `server/notifications/evaluate.ts`**

Move verbatim: `evaluateNotifications`, `evaluateMemory`, `evaluateAnonMemory`, `evaluateUserMemory`, `aggregateConfigs`, `evaluateConfigDb`, `evaluateUserDb`:

```typescript
import { eq, inArray } from "drizzle-orm";
import {
  deviceNotificationConfigs,
  notificationEvents,
  notificationEventDeliveries,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { sendPushForDevice, sendPushForUser } from "../push-notifications";
import type { NotificationConfig } from "./types";
import {
  memoryConfigs,
  memoryDeliveries,
  memoryEvents,
  deliveryCount,
} from "./memory-store";
import { rowToConfig, draftToEvent } from "./mappers";
import { buildEvents, dedupKeyFor } from "./build-events";

// ... paste the 7 functions verbatim ...

export { evaluateNotifications };
```

- [ ] **Step 2: Update `server/notifications/index.ts`**

1. Delete the seven moved functions.
2. Add: `import { evaluateNotifications } from "./evaluate";` plus re-export:
   `export { evaluateNotifications } from "./evaluate";`
   (Keep one form only — prefer the re-export line; drop the plain import if unused elsewhere in index.)
3. Remove now-unused imports (`deviceNotificationConfigs` stays if upsert still uses it; `inArray` likely unused now; `sendPushForDevice`/`sendPushForUser` still used by processHealthEvents/pull paths — verify before removing).
4. `evaluateAnonMemory`/`evaluateUserMemory` referenced `draftToEvent` and `dedupKeyFor` — those move out of index's usage; if index no longer references them, trim from imports accordingly.

- [ ] **Step 3: Verify**

Run: `pnpm check` — 0 errors. Run: `pnpm test` — all pass.

- [ ] **Step 4: Commit**

```bash
git add server/notifications && git commit -m "refactor: extract evaluate module"
```

---

## Task 4: Finalize index + todo.md + push

**Files:**
- Modify: `server/notifications/index.ts`
- Modify: `todo.md`

- [ ] **Step 1: Clean up `server/notifications/index.ts`**

After Tasks 1–3 the file should contain only:

- Imports (drizzle ops + schema tables used by the remaining three functions, `getDb`, `sendPushForUser`, `sendPushForDevice` if pull/upsert paths need them, memory-store maps, `stripScope`, `rowToEvent`, `dedupKeyForHealth`)
- Re-exports added in Task 1 + `export { evaluateNotifications } from "./evaluate";`
- `processHealthEvents` (uses `dedupKeyForHealth`, `memoryEvents`, db insert into `notificationEvents`, `sendPushForUser`)
- `upsertDeviceConfig` (uses `memoryConfigs`, db + `deviceNotificationConfigs`, `InsertDeviceNotificationConfigRow`, calls `processHealthEvents`)
- `pullPendingEvents` (db path via `notificationEvents`/`notificationEventDeliveries` + `rowToEvent`; memory path via `memoryDeliveries`/`memoryEvents` + `stripScope`)

Verify final shape with:

```bash
grep -n "^export\|^function\|^async function" server/notifications/index.ts
```

Expected exports: `upsertDeviceConfig`, `pullPendingEvents`, plus the re-export lines. No other function bodies remain.

- [ ] **Step 2: Verify public API unchanged**

Run: `pnpm check` — 0 errors.
Run: `pnpm lint` — no new errors.
Run: `pnpm test` — all pass.
Run: `wc -l server/notifications/*.ts` — largest file ~200 lines.

- [ ] **Step 3: Update `todo.md`**

Append Phase 76 section:

```markdown
## Phase 76: Server Notifications Refactor (v5.24)

- [x] Scaffold server/notifications/ directory (types, memory-store, mappers)
- [x] Extract build-events module (event drafting + dedup keys)
- [x] Extract evaluate module (memory/db evaluation paths)
- [x] Finalize index (upsert, health mirroring, pull)
- [x] Public API unchanged (5 functions + 2 types)
```

- [ ] **Step 4: Commit and push**

```bash
git add server/notifications todo.md && git commit -m "refactor: finalize server notifications directory"
git push origin main
```

---

## Summary

| Metric | Before | After |
|--------|--------|-------|
| `server/notifications.ts` | 670 lines / 1 file | 6 focused files |
| Public API | 5 functions + 2 types | Identical |
| Consumer changes | — | 0 expected |
