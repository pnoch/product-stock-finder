# Push Delivery Diagnostics — Design Spec

**Date:** 2026-10-11
**Status:** Approved
**Version:** 5.19.0 (planned)

---

## Overview

A dedicated Diagnostics screen showing push notification delivery health per device. The server checks Expo receipts inline after each send and persists the per-device outcome. Users can see last-send status and fire a live test push from the screen.

**Goal:** Close the trust loop on the alert pipeline. Today pushes fire into the void — if a notification never reaches the device, nobody knows. This makes failures visible and actionable.

---

## Server Changes

### Receipt Checking (`server/push-notifications.ts`)

In `sendPushForDevice`, after `sendPushNotificationsAsync` returns tickets:

1. Collect ticket IDs from tickets with `status === "ok"` (have an `id` field).
2. Wait ~15 seconds (`await new Promise((r) => setTimeout(r, 15_000))`). Expo recommends a delay before receipts are available.
3. Call `expo.getPushNotificationReceiptsAsync(ticketIds)`.
4. For each receipt:
   - `status === "ok"` → delivered.
   - `status === "error"` → record `details?.error` string.
5. Persist via `recordPushOutcome(deviceId, { status, error, sentAt, eventCount })`.
6. Keep the existing inline `DeviceNotRegistered` ticket-time pruning unchanged.
7. All receipt logic is best-effort: wrap in try/catch, log warnings, never throw (must not break the send path).

Cap: only check receipts when `ticketIds.length > 0` and `ticketIds.length <= 100` (Expo chunk limit). Skip receipt checking in tests (guard with `NODE_ENV`/existing test hooks).

### Outcome Persistence

New function `recordPushOutcome(deviceId, outcome)` in `server/push-notifications.ts`:

- DB mode: upsert into `pushDeliveryLog` (one row per device, last-write-wins).
- Memory mode: `Map<string, PushOutcome>` module-level, plus existing `clearPushTokensForTests` clears it too (new `clearPushOutcomesForTests`, or extend the existing clearer).

```typescript
export interface PushOutcome {
  status: "ok" | "error";
  error: string | null;      // Expo receipt error code, null when ok
  sentAt: number;            // epoch ms
  eventCount: number;        // events in the batch
  ticketId: string | null;   // first ticket id (dev aid)
}
```

### New Endpoints (`server/routers/notifications.ts`)

**`pushStatusAll`** (protected query):
- Resolves the caller's user id from context.
- Returns all devices owned by the user with their last outcome + token state:
```typescript
{
  devices: {
    deviceId: string;          // truncated for display? No — full, client truncates
    label: string | null;      // from deviceLabels
    platform: string | null;   // ios | android | web | null (no token)
    hasToken: boolean;
    outcome: PushOutcome | null; // null = never sent
  }[];
}
```
- Rate limit: same bucket as `pull` (read-heavy, cheap).

**`sendTestPush`** (protected mutation):
- Resolves the caller's device id from context (session claim → `x-device-id` header, same as existing endpoints).
- Sends a single "Test notification ✅ / If you see this, push is working" event via `sendPushForDevice` (which now records the receipt outcome inline).
- Returns the fresh outcome for that device: `PushOutcome`.
- Rate limit: 1 per minute per device (new bucket `notifications.testPush`, strict — prevents receipt-API abuse).

### Schema (`drizzle/schema.ts`)

New table `pushDeliveryLog`:

```typescript
export const pushDeliveryLog = mysqlTable("push_delivery_log", {
  deviceId: varchar("deviceId", { length: 128 }).notNull().primaryKey(),
  status: varchar("status", { length: 16 }).notNull(),   // "ok" | "error"
  error: varchar("error", { length: 64 }),               // Expo error code
  sentAt: bigint("sentAt", { mode: "number" }).notNull(),
  eventCount: bigint("eventCount", { mode: "number" }).notNull(),
  ticketId: varchar("ticketId", { length: 64 }),
});
```

One row per device (PK on deviceId), upsert on each send. No history table (last-write-wins by design).

Migration: `pnpm db:push` (drizzle-kit generate + migrate, requires DATABASE_URL).

---

## Client — Mobile

### Route (`app/diagnostics.tsx`)

New Expo Router route:

- **Header**: back button + "Push Diagnostics" title + refresh icon (re-fetches `pushStatusAll`).
- **Device list** (FlatList): one card per device:
  - Device label (or truncated device id) + platform badge (iOS/Android/Web icon).
  - Status row: green check "Delivered · 2h ago" / red X "Failed: DeviceNotRegistered · 5m ago" / gray "No pushes sent yet".
  - Sub-rows: token registered (yes/no), last batch size, ticket id (truncated, monospace).
  - Failed rows show the mapped help text (see Error Mapping).
  - "This device" pill on the current device (match via `getDeviceId()`).
- **"Send test push" button** (footer or per-device? Per-device — each card gets its own button; the current-device card is emphasized). Flow: spinner → `sendTestPush` → refetch → toast "Test push delivered ✅" or "Test push failed: <reason>".
- Loading skeleton while first fetch is in flight; error card with Retry on fetch failure.
- All colors via `useColors()`; NativeWind for layout.

### Entry Point

Settings → Notifications section → new row "Push delivery status →" navigating to `/diagnostics`. Reuse the existing settings-row component pattern.

### Wrappers (`lib/server-notifications.ts`)

```typescript
export async function fetchPushStatusAll(): Promise<PushStatusDevice[]>;
export async function sendTestPush(): Promise<PushOutcome>;
```

Follow the existing tRPC wrapper patterns in that file (client creation, error mapping to `null`/throw).

---

## Client — Desktop

### Page (`desktop/src/pages/Diagnostics.tsx`)

Same device-list UI in Tailwind (table or card list). Same `pushStatusAll` query via `../lib/trpc`. Same per-device test-push button. No sidebar entry (diagnostics is reached from Settings → Notifications, matching mobile).

### Settings Entry

Desktop Settings → Notifications section → "Push delivery status →" link to `/drops`-style route (`/diagnostics`). Register route in `desktop/src/App.tsx` (lazy).

---

## Error Mapping (client help text)

| Expo error | User-facing message |
|---|---|
| `DeviceNotRegistered` | "This device unregistered from push — reopen the app to reconnect" |
| `MessageTooBig` | "Notification payload too large — please report this as a bug" |
| `MessageRateExceeded` | "Sending too fast — wait a minute and retry" |
| `InvalidCredentials` | "Server push credentials are invalid — contact support" |
| (network/timeout/other) | "Couldn't confirm delivery — try again" |

Unknown error codes: show the raw code plus "Couldn't confirm delivery".

---

## Testing Strategy

- **Unit**: `recordPushOutcome` memory-mode round-trip; error-code mapping function.
- **Router**: `pushStatusAll` returns owned devices only (authz test: user B sees no user A devices); `sendTestPush` rate limit (second call within 60s rejected).
- **Receipt logic**: mock `Expo` class (send tickets + receipts) — assert outcome recorded as ok/error; assert send path doesn't throw when receipt fetch fails.
- **Screen**: diagnostics route renders device list, test button calls mutation, failure shows help text.
- **Wiring guards**: route files exist, router exposes both endpoints, schema table present, settings entries link to `/diagnostics`.

DB-backed tests gated on `RUN_DB_TESTS` + `TEST_DATABASE_URL` per repo convention.

---

## Out of Scope

- Web-push delivery receipts (no receipt API; send-time errors only — deferred).
- Client-side receive confirmation / heartbeat.
- Historical send log (last-write-wins per device only).
- Auto-retry of failed pushes.
- Server share-link style public diagnostics page.
